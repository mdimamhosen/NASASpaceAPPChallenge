#!/usr/bin/env python3
"""Snapshot SWIM 2.0 subsurface-ice consistency around Jezero Crater.

SWIM (Subsurface Water Ice Mapping, NASA-funded, Planetary Science Institute) publishes global ice-consistency
GeoTIFFs at 3 km/pixel for 60°S–60°N. Each file is ~71 MB, so this script reads the TIFF header with HTTP range
requests and downloads only the strips that cover the Jezero window.

Output: data/resources/swim-ice-jezero.json (window grid, source URL, Last-Modified, sha256 of the window bytes).
Values: ice consistency C_i in [-1, 1]; positive = data consistent with ice, negative = inconsistent; -30 = no data.
Standard library only.
"""

from __future__ import annotations

import hashlib
import json
import math
import ssl
import struct
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "resources" / "swim-ice-jezero.json"
LAYERS = {
    "0-1m": "https://swim.psi.edu/output/SWIM2/Global/Composite/SWIM2_c0_1.tif",
    "1-5m": "https://swim.psi.edu/output/SWIM2/Global/Composite/SWIM2_c1_5.tif",
}
PRODUCTS_PAGE = "https://swim.psi.edu/SWIM2Products.php"
CENTER = (18.4447, 77.4508)  # Perseverance landing (PDS PLACES sol 0)
HALF_DEG = 3.0
try:  # same TLS setup as the other refresh scripts
    import certifi

    TLS = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    # python.org builds ship no CA bundle; macOS and most Linux distros have one here.
    TLS = ssl.create_default_context(cafile="/etc/ssl/cert.pem" if Path("/etc/ssl/cert.pem").exists() else None)
# Python 3.13+ adds VERIFY_X509_STRICT, which rejects the cross-signed USERTrust root in psi.edu's chain.
# The chain and hostname are still verified; only the strict RFC 5280 extension checks are relaxed.
TLS.verify_flags &= ~getattr(ssl, "VERIFY_X509_STRICT", 0)
UA = {"User-Agent": "MarsExplorer/1.0 (NASA Space Apps; research snapshot)"}


def fetch(url: str, start: int, end: int) -> bytes:
    req = urllib.request.Request(url, headers={**UA, "Range": f"bytes={start}-{end}"})
    with urllib.request.urlopen(req, timeout=120, context=TLS) as res:
        if res.status != 206:
            raise RuntimeError(f"{url}: server ignored the byte range (HTTP {res.status})")
        return res.read()


def head(url: str) -> dict[str, str]:
    req = urllib.request.Request(url, headers=UA, method="HEAD")
    with urllib.request.urlopen(req, timeout=60, context=TLS) as res:
        return {k.lower(): v for k, v in res.headers.items()}


class Tiff:
    """Minimal classic-TIFF reader over HTTP ranges: one IFD, strips or tiles, uncompressed float32."""

    TYPES = {1: ("B", 1), 2: ("c", 1), 3: ("H", 2), 4: ("I", 4), 11: ("f", 4), 12: ("d", 8), 16: ("Q", 8)}

    def __init__(self, url: str):
        self.url = url
        self.buf = fetch(url, 0, 262_143)
        self.e = "<" if self.buf[:2] == b"II" else ">"
        magic, ifd = struct.unpack(self.e + "HI", self.buf[2:8])
        if magic != 42:
            raise RuntimeError("BigTIFF or not a TIFF; unsupported")
        self.tags = self._ifd(ifd)

    def _bytes(self, offset: int, size: int) -> bytes:
        if offset + size <= len(self.buf):
            return self.buf[offset : offset + size]
        return fetch(self.url, offset, offset + size - 1)

    def _ifd(self, offset: int) -> dict[int, tuple]:
        (n,) = struct.unpack(self.e + "H", self._bytes(offset, 2))
        raw = self._bytes(offset + 2, n * 12)
        tags = {}
        for i in range(n):
            tag, typ, count = struct.unpack(self.e + "HHI", raw[i * 12 : i * 12 + 8])
            fmt, size = self.TYPES.get(typ, ("B", 1))
            total = size * count
            data = raw[i * 12 + 8 : i * 12 + 12] if total <= 4 else self._bytes(struct.unpack(self.e + "I", raw[i * 12 + 8 : i * 12 + 12])[0], total)
            tags[tag] = data[:total].decode("latin1").rstrip("\x00") if typ == 2 else struct.unpack(self.e + fmt * count, data[:total])
        return tags


def window(url: str) -> dict:
    t = Tiff(url)
    g = t.tags
    width, height = g[256][0], g[257][0]
    if g.get(259, (1,))[0] != 1 or g.get(258, (32,))[0] != 32 or g.get(339, (3,))[0] != 3:
        raise RuntimeError("expected uncompressed float32 samples")
    sx, sy = g[33550][0], g[33550][1]
    x0, y0 = g[33922][3], g[33922][4]
    # Equirectangular, centre longitude 0: the full width spans 360°, so metres per degree = width * sx / 360.
    m_per_deg = width * sx / 360.0
    lat_c, lon_c = CENTER
    c0, c1 = int((((lon_c - HALF_DEG) * m_per_deg) - x0) // sx), int((((lon_c + HALF_DEG) * m_per_deg) - x0) // sx)
    r0, r1 = int((y0 - (lat_c + HALF_DEG) * m_per_deg) // sy), int((y0 - (lat_c - HALF_DEG) * m_per_deg) // sy)
    if not (0 <= c0 < c1 < width and 0 <= r0 < r1 < height):
        raise RuntimeError(f"window outside the raster: cols {c0}..{c1} of {width}, rows {r0}..{r1} of {height}")
    rows: list[list[float | None]] = []
    raw_window = bytearray()
    ncols = c1 - c0 + 1
    if 322 in g:  # tiled: fetch each whole tile that overlaps the window once
        tw, tl = g[322][0], g[323][0]
        across = (width + tw - 1) // tw
        offsets, counts = g[324], g[325]
        tiles: dict[tuple[int, int], tuple] = {}
        for ty in range(r0 // tl, r1 // tl + 1):
            for tx in range(c0 // tw, c1 // tw + 1):
                i = ty * across + tx
                tiles[(ty, tx)] = struct.unpack(t.e + "f" * (tw * tl), fetch(url, offsets[i], offsets[i] + counts[i] - 1))
        for r in range(r0, r1 + 1):
            line = [tiles[(r // tl, c // tw)][(r % tl) * tw + (c % tw)] for c in range(c0, c1 + 1)]
            raw_window += struct.pack(t.e + "f" * ncols, *line)
            rows.append([None if (v <= -29 or math.isnan(v)) else round(v, 4) for v in line])
    else:
        rps, offsets = g[278][0], g[273]
        for r in range(r0, r1 + 1):
            strip, within = divmod(r, rps)
            base = offsets[strip] + within * width * 4
            line = fetch(url, base + c0 * 4, base + (c1 + 1) * 4 - 1)
            raw_window += line
            rows.append([None if (v <= -29 or math.isnan(v)) else round(v, 4) for v in struct.unpack(t.e + "f" * ncols, line)])
    # Grid is north-up: rows[0] is the northern edge. Cell centres:
    lat_top = (y0 - (r0 + 0.5) * sy) / m_per_deg
    lon_left = (x0 + (c0 + 0.5) * sx) / m_per_deg
    return {
        "url": url,
        "pixelMeters": sx,
        "latTop": round(lat_top, 5),
        "lonLeft": round(lon_left, 5),
        "stepDeg": round(sx / m_per_deg, 6),
        "rows": rows,
        "windowSha256": hashlib.sha256(raw_window).hexdigest(),
        "lastModified": head(url).get("last-modified"),
        "sourceBytes": head(url).get("content-length"),
    }


def main() -> None:
    layers = {name: window(url) for name, url in LAYERS.items()}
    out = {
        "product": "SWIM 2.0 combined ice consistency (C_i), global 60S-60N, 3 km/pixel",
        "provider": "Subsurface Water Ice Mapping (SWIM), Planetary Science Institute, NASA-funded",
        "sourcePage": PRODUCTS_PAGE,
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "center": {"lat": CENTER[0], "lon": CENTER[1], "halfWindowDeg": HALF_DEG},
        "valueMeaning": "C_i from -1 (all data inconsistent with ice) to +1 (all data consistent with ice); null = no data",
        "nonCertifying": True,
        "layers": layers,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    for name, layer in layers.items():
        vals = [v for r in layer["rows"] for v in r if v is not None]
        print(f"{name}: {len(layer['rows'])}x{len(layer['rows'][0])} cells, {len(vals)} with data, range {min(vals) if vals else None}..{max(vals) if vals else None}")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
