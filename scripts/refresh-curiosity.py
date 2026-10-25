#!/usr/bin/env python3
"""Snapshot Curiosity's drive-end positions (NASA MSL MMGIS waypoints layer) for the Gale Crater region.

Writes data/curiosity/best_interp.csv in the column subset PlacesService reads (frame, sol, latitude, longitude,
elevation, sclk) plus SOURCE.json with the URL and sha256. The waypoints are NASA's published drive localizations,
not PDS PLACES; sclk is not in the layer and is written as 0. Standard library only.
"""

from __future__ import annotations

import csv
import hashlib
import json
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "curiosity"
URL = "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json"
try:
    import certifi

    TLS = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    TLS = ssl.create_default_context(cafile="/etc/ssl/cert.pem" if Path("/etc/ssl/cert.pem").exists() else None)


def main() -> None:
    raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 MarsExplorer/1.0"}), context=TLS, timeout=120).read()
    feats = json.loads(raw)["features"]
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "best_interp.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["frame", "sol", "planetocentric_latitude", "longitude", "elevation", "sclk"])
        for f in feats:
            p = f["properties"]
            if p.get("sol") is None or p.get("lat") is None:
                continue
            w.writerow(["ROVER", p["sol"], p["lat"], p["lon"], p.get("elev_geoid", ""), 0])
    (OUT / "SOURCE.json").write_text(json.dumps({
        "product": "MSL Curiosity drive waypoints (NASA Mars Science Laboratory MMGIS map layer)",
        "sourceUrl": URL,
        "sourcePage": "https://science.nasa.gov/mission/msl-curiosity/location-map/",
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "note": "Drive-end localizations published on NASA's Curiosity location map; elevation relative to the areoid. Not live telemetry.",
    }, indent=2) + "\n")
    sols = [f["properties"]["sol"] for f in feats if f["properties"].get("sol") is not None]
    print(f"wrote data/curiosity: {len(sols)} waypoints, sols {min(sols)}..{max(sols)}")


if __name__ == "__main__":
    main()
