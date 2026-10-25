#!/usr/bin/env python3
"""Snapshot Ingenuity's 72 flight ground tracks from NASA's Mars 2020 MMGIS map layer.

Source GeoJSON gives per flight: Flight, Sol, Length_m, SCLK_START/END and a 2D LineString (no altitude).
Output: data/ingenuity/flights.json, tracks thinned to <= 60 points. Standard library only.
"""

from __future__ import annotations

import hashlib
import json
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "ingenuity" / "flights.json"
URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/m20_heli_flight_path.json"
try:
    import certifi

    TLS = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    TLS = ssl.create_default_context(cafile="/etc/ssl/cert.pem" if Path("/etc/ssl/cert.pem").exists() else None)


def main() -> None:
    raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 MarsExplorer/1.0"}), context=TLS, timeout=120).read()
    flights = []
    for f in json.loads(raw)["features"]:
        p, coords = f["properties"], f["geometry"]["coordinates"]
        step = max(1, len(coords) // 60)
        pts = coords[::step] + ([coords[-1]] if (len(coords) - 1) % step else [])
        flights.append({
            "flight": p["Flight"], "sol": p["Sol"], "lengthM": round(p["Length_m"], 1),
            "durationS": round(p["SCLK_END"] - p["SCLK_START"], 1),
            "track": [[round(lat, 6), round(lon, 6)] for lon, lat in pts],
        })
    flights.sort(key=lambda x: x["flight"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": URL, "sourcePage": "https://mars.nasa.gov/mars2020/mission/where-is-the-rover/", "sha256": hashlib.sha256(raw).hexdigest(), "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "note": "Ground tracks only; the layer has no altitude. Duration = SCLK end - start.", "flights": flights}, separators=(",", ":")) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(flights)} flights, {sum(f['lengthM'] for f in flights) / 1000:.2f} km total")


if __name__ == "__main__":
    main()
