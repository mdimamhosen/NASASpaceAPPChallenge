#!/usr/bin/env python3
"""Re-fetch NASA PLACES archives used by Mars Explorer.

1. Download best_interp.csv → data/perseverance/ (+ SOURCE.json checksum)
2. Rebuild the coarse Jezero DEM sample grid from m20_orbital_dem.img

Skip unchanged products unless --force. Requires network access to
pds-geosciences.wustl.edu. Restart or let the API reload-by-mtime to pick up files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import ssl
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi

    TLS_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    TLS_CONTEXT = ssl.create_default_context()

ROOT = Path(__file__).resolve().parents[1]
PLACES_DIR = ROOT / "data" / "perseverance"
CSV_PATH = PLACES_DIR / "best_interp.csv"
SOURCE_PATH = PLACES_DIR / "SOURCE.json"
DEM_GRID = ROOT / "data" / "jezero" / "pds-orbital-dem-grid.json"
STATUS_PATH = ROOT / "data" / "nasa-archive-status.json"

CSV_URL = "https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/best_interp.csv"
CSV_LABEL = "https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/best_interp.csv.xml"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"Accept": "*/*", "User-Agent": "MarsExplorer-archive-refresh/1.0"})
    with urllib.request.urlopen(request, timeout=120, context=TLS_CONTEXT) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} for {url}")
        return response.read()


def refresh_places(force: bool) -> dict:
    print(f"Fetching PLACES CSV\n  {CSV_URL}")
    body = fetch(CSV_URL)
    digest = sha256_bytes(body)
    previous = {}
    if SOURCE_PATH.exists():
        previous = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    unchanged = previous.get("sha256") == digest and CSV_PATH.exists() and not force
    retrieved = datetime.now(timezone.utc).isoformat()
    meta = {
        "product": "Mars 2020 Rover PLACES best_interp.csv",
        "sourceUrl": CSV_URL,
        "labelUrl": CSV_LABEL,
        "retrievedAt": previous.get("retrievedAt", retrieved) if unchanged else retrieved,
        "sha256": digest,
        "coordinateSystem": "planetocentric latitude; east-positive longitude",
        "note": "CSV supplies sol and SCLK, not a UTC observation date. Track is a published rover localization, not an EVA traverse.",
        "bytes": len(body),
    }
    if unchanged:
        print(f"PLACES CSV unchanged (sha256={digest[:12]}…); keeping existing file")
        return {"product": "places-csv", "changed": False, **meta}
    PLACES_DIR.mkdir(parents=True, exist_ok=True)
    CSV_PATH.write_bytes(body)
    SOURCE_PATH.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {CSV_PATH} ({len(body)} bytes, sha256={digest[:12]}…)")
    return {"product": "places-csv", "changed": True, **meta}


def refresh_dem(force: bool) -> dict:
    previous_hash = None
    previous_retrieved = None
    if DEM_GRID.exists():
        previous = json.loads(DEM_GRID.read_text(encoding="utf-8"))
        previous_retrieved = previous.get("retrievedAt")
        # Hash of prior grid body for change detection after rebuild
        previous_hash = sha256_bytes(DEM_GRID.read_bytes())
    print("Rebuilding Jezero DEM sample grid via scripts/build-jezero-dtm-grid.py")
    if not force and DEM_GRID.exists():
        # Still rebuild — DEM source may change without CSV changing. Use --skip-dem to avoid.
        pass
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build-jezero-dtm-grid.py")],
        cwd=str(ROOT),
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("DEM grid rebuild failed")
    body = DEM_GRID.read_bytes()
    digest = sha256_bytes(body)
    grid = json.loads(body.decode("utf-8"))
    changed = previous_hash != digest
    if not changed and not force:
        print(f"DEM grid content unchanged (sha256={digest[:12]}…)")
    else:
        print(f"DEM grid ready ({grid.get('validSamples')} valid samples, sha256={digest[:12]}…)")
    return {
        "product": "places-orbital-dem-grid",
        "changed": changed,
        "sourceUrl": grid.get("sourceUrl"),
        "labelUrl": grid.get("labelUrl"),
        "retrievedAt": grid.get("retrievedAt") or previous_retrieved,
        "sha256": digest,
        "validSamples": grid.get("validSamples"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Rewrite PLACES CSV even if checksum matches")
    parser.add_argument("--skip-dem", action="store_true", help="Only refresh best_interp.csv")
    parser.add_argument("--skip-places", action="store_true", help="Only rebuild DEM grid")
    args = parser.parse_args()

    results = []
    if not args.skip_places:
        results.append(refresh_places(force=args.force))
    if not args.skip_dem:
        results.append(refresh_dem(force=args.force))

    status = {
        "refreshedAt": datetime.now(timezone.utc).isoformat(),
        "products": results,
    }
    STATUS_PATH.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {STATUS_PATH}")
    changed = any(item.get("changed") for item in results)
    print("Archives updated." if changed else "Archives already current.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 — CLI surface
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
