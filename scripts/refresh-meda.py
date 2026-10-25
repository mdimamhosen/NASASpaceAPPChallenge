#!/usr/bin/env python3
"""Snapshot Perseverance MEDA weather for a spread of sols (PDS Atmospheres Node, Mars 2020 MEDA bundle).

For each chosen sol, streams two CSVs and bins them by local true solar time hour:
- data_calibrated_env  CAL_TIRS  -> AIR_TEMP, GROUND_TEMP (K)
- data_derived_env     DER_PS    -> PRESSURE (Pa)
Output: data/weather/meda-jezero.json with per-file URL and sha256. Standard library only.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import ssl
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "weather" / "meda-jezero.json"
BASE = "https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda"
SOLS = [int(s) for s in sys.argv[1:]] or [30, 150, 300, 450, 600, 750, 900, 1050, 1200, 1350]
try:
    import certifi

    TLS = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    TLS = ssl.create_default_context(cafile="/etc/ssl/cert.pem" if Path("/etc/ssl/cert.pem").exists() else None)
TLS.verify_flags &= ~getattr(ssl, "VERIFY_X509_STRICT", 0)
UA = {"User-Agent": "MarsExplorer/1.0 (NASA Space Apps; research snapshot)"}


def get(url: str, timeout: int = 300) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), context=TLS, timeout=timeout) as res:
        return res.read()


def range_dir(collection: str, sol: int, cache: dict[str, list[str]]) -> str | None:
    if collection not in cache:
        cache[collection] = re.findall(r'href="(sol_\d{4}_\d{4})/"', get(f"{BASE}/{collection}/", 60).decode())
    for d in cache[collection]:
        a, b = map(int, d[4:].split("_"))
        if a <= sol <= b:
            return d
    return None


def binned(raw: bytes, columns: list[str]) -> dict[int, dict[str, float]]:
    sums: dict[int, dict[str, list[float]]] = {}
    for row in csv.DictReader(io.StringIO(raw.decode("latin1"))):
        try:
            hour = int(row["LTST"].split(" ")[1][:2])
        except (KeyError, IndexError, ValueError):
            continue
        for c in columns:
            v = row.get(c, "")
            try:
                x = float(v)
            except ValueError:
                continue
            if abs(x) >= 1e8:  # 999999999 = no data
                continue
            sums.setdefault(hour, {}).setdefault(c, []).append(x)
    return {h: {c: round(sum(v) / len(v), 2) for c, v in cols.items()} for h, cols in sorted(sums.items())}


def main() -> None:
    dirs: dict[str, list[str]] = {}
    sols = []
    for sol in SOLS:
        s4 = f"{sol:04d}"
        files = [("data_calibrated_env", "CAL_TIRS", ["AIR_TEMP", "GROUND_TEMP"]), ("data_derived_env", "DER_PS", ["PRESSURE"])]
        hours: dict[int, dict[str, float]] = {}
        sources = []
        for coll, product, cols in files:
            d = range_dir(coll, sol, dirs)
            if not d:
                continue
            folder = f"{BASE}/{coll}/{d}/sol_{s4}/"
            try:
                # Version suffixes (P01, P02, ...) vary by sol, so take the newest listed file for the product.
                names = sorted(set(re.findall(rf'href="(WE__{s4}_+{product}_+P\d+\.CSV)"', get(folder, 60).decode())))
            except Exception as error:
                print(f"sol {sol}: {coll} listing unavailable ({error})", file=sys.stderr)
                continue
            if not names:
                continue
            name = names[-1]
            url = folder + name
            try:
                raw = get(url)
            except Exception as error:  # a missing sol is skipped, not invented
                print(f"sol {sol}: {name} unavailable ({error})", file=sys.stderr)
                continue
            sources.append({"url": url, "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)})
            for h, vals in binned(raw, cols).items():
                hours.setdefault(h, {}).update(vals)
        if hours:
            sols.append({"sol": sol, "hours": [{"ltstHour": h, **v} for h, v in sorted(hours.items())], "sources": sources})
            print(f"sol {sol}: {len(hours)} hours from {len(sources)} files")
    out = {
        "product": "Mars 2020 MEDA calibrated TIRS (air/ground temperature) and derived PS (pressure), hourly LTST means",
        "provider": "NASA PDS Atmospheres Node",
        "sourcePage": f"{BASE}/",
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "units": {"AIR_TEMP": "K", "GROUND_TEMP": "K", "PRESSURE": "Pa"},
        "sols": sols,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} with {len(sols)} sols")


if __name__ == "__main__":
    main()
