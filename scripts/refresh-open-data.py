#!/usr/bin/env python3
"""Snapshot NASA Open Data (data.nasa.gov, tag "mars") products used by Mars Explorer.

1. data.nasa.gov CKAN catalog for tag:mars          → data/opendata/catalog.json
2. HiRISE DTM footprints (PDS DTM cumulative index)  → data/opendata/hirise-dtm.json
   data.nasa.gov: mro-mars-high-resolution-imaging-science-experiment-dtm-v1-0
3. IAU/USGS Mars nomenclature center points          → data/opendata/iau-features.json
   data.nasa.gov: gazetteer-of-planetary-nomenclature-mars-mola-global-images
4. RAG corpus note describing the above              → data/corpus/nasa-open-data-mars.md

Every product is recorded in data/opendata/SOURCE.json with its URL, fetch time and sha256.
The API reloads these files by mtime. Standard library only.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import ssl
import struct
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi

    TLS = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    TLS = ssl.create_default_context()

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "opendata"
CORPUS_DOC = ROOT / "data" / "corpus" / "nasa-open-data-mars.md"

CKAN = "https://data.nasa.gov/api/3/action/package_search"
CATALOG_PAGE = "https://data.nasa.gov/dataset/?tags=mars"
DTM_INDEX = "https://hirise-pds.lpl.arizona.edu/PDS/INDEX/DTMCUMINDEX.TAB"
DTM_LABEL = "https://hirise-pds.lpl.arizona.edu/PDS/INDEX/DTMCUMINDEX.LBL"
DTM_DATASET = "https://data.nasa.gov/dataset/mro-mars-high-resolution-imaging-science-experiment-dtm-v1-0"
NOMENCLATURE_ZIP = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.zip"
NOMENCLATURE_DATASET = "https://data.nasa.gov/dataset/gazetteer-of-planetary-nomenclature-mars-mola-global-images"

# Ordered: first match wins for the primary mission, but all matches are kept.
MISSIONS: list[tuple[str, str]] = [
    ("PERSEVERANCE", r"MARS ?2020|\bM2020\b|PERSEVERANCE|\bM20\b|MOXIE|SHERLOC|PIXL|SUPERCAM|MASTCAM-Z"),
    # APXS, SAM and DAN are not unique to Curiosity (APXS also flew on MER and Pathfinder).
    ("CURIOSITY", r"\bMSL\b|CURIOSITY|CHEMCAM|\bREMS\b|MAHLI|MARS SCIENCE LABORATORY"),
    ("INSIGHT", r"INSIGHT|\bAPSS\b|\bSEIS\b|\bHP3\b|\bRISE\b|TWINS"),
    ("PHOENIX", r"PHOENIX|\bPHX\b"),
    ("OPPORTUNITY", r"\bMER ?1\b|\bMER-1\b|\bMER1\b|OPPORTUNITY"),
    ("SPIRIT", r"\bMER ?2\b|\bMER-2\b|\bMER2\b|SPIRIT"),
    ("MER", r"MARS EXPLORATION ROVER|\bMER\b"),
    ("PATHFINDER", r"PATHFINDER|\bMPF\b|SOJOURNER"),
    ("VIKING LANDER", r"\bVL1\b|\bVL2\b|VIKING LANDER"),
    ("VIKING ORBITER", r"\bVO1\b|\bVO2\b|VIKING ORBITER"),
    ("MRO", r"\bMRO\b|HIRISE|CRISM|SHARAD|\bCTX\b|CLIMATE SOUNDER|RECONNAISSANCE ORBITER"),
    ("MGS", r"\bMGS\b|\bMOLA\b|\bTES\b|\bMOC\b|GLOBAL SURVEYOR"),
    ("ODYSSEY", r"ODYSSEY|\bODY\b|THEMIS|MARIE|GAMMA RAY SPECTROMETER"),
    ("MAVEN", r"MAVEN"),
    ("MARS EXPRESS", r"MARS EXPRESS|\bMEX\b|ASPERA|MARSIS|OMEGA|SPICAM|\bPFS\b|\bHRSC\b|\bVMC\b"),
]


def fetch(url: str, attempts: int = 5, timeout: int = 180) -> bytes:
    """GET with retries; resumes a partial body with a Range request."""
    body = b""
    for attempt in range(1, attempts + 1):
        headers = {"User-Agent": "mars-explorer-open-data/1.0"}
        if body:
            headers["Range"] = f"bytes={len(body)}-"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), context=TLS, timeout=timeout) as res:
                total = res.headers.get("Content-Length")
                chunk = res.read()
                body = body + chunk if res.status == 206 else chunk
                expected = int(total) + (len(body) - len(chunk) if res.status == 206 else 0) if total else None
                if expected is None or len(body) >= expected:
                    return body
        except Exception as error:  # noqa: BLE001 - report and retry any network failure
            print(f"  retry {attempt}/{attempts} {url}: {error}", file=sys.stderr)
        time.sleep(min(2 * attempt, 8))
    raise RuntimeError(f"download failed: {url}")


def missions_for(text: str) -> list[str]:
    upper = text.upper()
    found = [name for name, pattern in MISSIONS if re.search(pattern, upper)]
    if "MER" in found:
        # A generic MER record covers both rovers; a record naming MER 1 or MER 2 keeps only that rover.
        specific = "SPIRIT" in found or "OPPORTUNITY" in found
        found = [m for m in found if m != "MER"] + ([] if specific else ["SPIRIT", "OPPORTUNITY"])
    return found


def clean(text: str | None, limit: int | None = None) -> str:
    out = " ".join((text or "").split())
    return out[: limit - 1] + "…" if limit and len(out) > limit else out


def catalog() -> dict:
    items, start, total = [], 0, None
    while total is None or start < total:
        query = urllib.parse.urlencode({"fq": "tags:mars", "rows": 1000, "start": start, "sort": "name asc"})
        result = json.loads(fetch(f"{CKAN}?{query}"))["result"]
        total = result["count"]
        for pkg in result["results"]:
            extras = {e["key"]: e["value"] for e in pkg.get("extras", [])}
            title = clean(pkg.get("title"))
            items.append({
                "id": pkg["name"],
                "title": title,
                "notes": clean(pkg.get("notes"), 320),
                "publisher": clean(extras.get("publisher") or (pkg.get("organization") or {}).get("title")),
                "landingPage": extras.get("landingPage") or "",
                "identifier": extras.get("identifier") or "",
                "modified": extras.get("modified") or pkg.get("metadata_modified", "")[:10],
                "license": pkg.get("license_title") or "",
                "url": f"https://data.nasa.gov/dataset/{pkg['name']}",
                "resources": [r.get("url") for r in pkg.get("resources", []) if r.get("url")][:4],
                "missions": missions_for(f"{pkg['name']} {title} {pkg.get('notes') or ''}"),
            })
        start += len(result["results"])
        if not result["results"]:
            break
    return {"items": items, "total": total}


def east180(lon: float) -> float:
    return round(lon - 360 if lon > 180 else lon, 5)


def hirise_dtms() -> tuple[list[dict], bytes]:
    raw = fetch(DTM_INDEX)
    rows = []
    for line in raw.decode("latin1").splitlines():
        cols = [c.strip().strip('"').strip() for c in line.split(",")]
        if len(cols) < 34 or not cols[11].startswith("DTM"):
            continue
        corners = [(float(cols[i]), float(cols[i + 1])) for i in range(26, 34, 2)]
        path = cols[1]
        rows.append({
            "id": cols[4],
            "rationale": cols[7],
            "leftObservation": cols[8],
            "rightObservation": cols[9],
            "scaleM": float(cols[19]),
            "projection": cols[21],
            "corners": [[round(lat, 5), east180(lon)] for lat, lon in corners],
            "pdsUrl": f"https://hirise-pds.lpl.arizona.edu/PDS/{path.rsplit('/', 1)[0]}/",
        })
    return rows, raw


def dbf_rows(data: bytes) -> list[dict]:
    count, header_len, record_len = struct.unpack("<IHH", data[4:12])
    fields = []
    for offset in range(32, header_len - 1, 32):
        name = data[offset:offset + 11].split(b"\0")[0].decode()
        fields.append((name, data[offset + 16]))
    rows, pos = [], header_len
    for _ in range(count):
        record, pos, col = data[pos + 1:pos + record_len], pos + record_len, 0
        row = {}
        for name, width in fields:
            row[name] = record[col:col + width].decode("utf-8", "replace").strip()
            col += width
        rows.append(row)
    return rows


def iau_features() -> tuple[list[dict], bytes]:
    raw = fetch(NOMENCLATURE_ZIP)
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        dbf = next(n for n in archive.namelist() if n.endswith(".dbf"))
        rows = dbf_rows(archive.read(dbf))
    features = []
    for row in rows:
        if row.get("approval") != "Adopted by IAU":
            continue
        link = row.get("link", "").replace("http://", "https://")
        features.append({
            "id": link.rsplit("/", 1)[-1] or row["name"],
            "name": row["name"],
            "type": row["type"].split(",")[0].strip(),
            "code": row["code"],
            "lat": round(float(row["center_lat"]), 4),
            "lon": east180(float(row["center_lon"])),
            "diameterKm": round(float(row["diameter"] or 0), 2),
            "approved": row["approvaldt"][:10].replace("/", "-"),
            "origin": clean(row.get("origin"), 160),
            "quad": row.get("quad_name", ""),
            "link": link,
        })
    return features, raw


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, value: object) -> bytes:
    data = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
    path.write_bytes(data)
    return data


def corpus_doc(cat: dict, dtms: list[dict], features: list[dict], now: str) -> str:
    counts: dict[str, int] = {}
    for item in cat["items"]:
        for mission in item["missions"]:
            counts[mission] = counts.get(mission, 0) + 1
    jezero_dtms = [d for d in dtms if 17.5 <= d["corners"][0][0] <= 19.5 and 76.5 <= d["corners"][0][1] <= 78.5]
    jezero_names = sorted((f for f in features if 17.5 <= f["lat"] <= 19.6 and 76.5 <= f["lon"] <= 78.6), key=lambda f: -f["diameterKm"])
    lines = [
        "---", "title: NASA Open Data portal — Mars datasets used by Mars Explorer", f"url: {CATALOG_PAGE}", "source: curated", f"retrievedDate: {now[:10]}", "---", "",
        "# NASA Open Data portal (data.nasa.gov) — Mars datasets", "",
        f"The NASA Open Data portal at data.nasa.gov lists {cat['total']} datasets tagged \"mars\". Most entries are catalog records for Planetary Data System (PDS) archives from Mars missions and point to PDS landing pages. Mars Explorer snapshots this catalog and searches it so users can find the archive behind a mission or instrument.", "",
        "## Datasets per mission in the data.nasa.gov Mars catalog", "",
        "Counts come from matching mission and instrument names in dataset titles and descriptions; a dataset can belong to more than one mission.", "",
        *[f"- {name}: {count} datasets" for name, count in sorted(counts.items(), key=lambda kv: -kv[1])], "",
        "## HiRISE Digital Terrain Models (MRO HiRISE DTM V1.0)", "",
        f"The data.nasa.gov dataset \"MRO Mars High Resolution Imaging Science Experiment DTM V1.0\" ({DTM_DATASET}) describes derived Digital Terrain Models and orthoimages from the HiRISE camera on the Mars Reconnaissance Orbiter. Its PDS DTM cumulative index lists {len(dtms)} DTMs with corner coordinates. HiRISE DTMs are built from stereo image pairs and typically have 1 m or 2 m post spacing, far finer than the ~118 m grid Mars Explorer samples from the Mars 2020 PLACES orbital DEM.", "",
        f"Mars Explorer draws every DTM footprint on the Mars map and reports which DTMs cover a drawn route. Near Jezero Crater the index lists {len(jezero_dtms)} DTMs, including:", "",
        *[f"- {d['id']} — {d['rationale']} ({d['scaleM']:.0f} m post spacing)" for d in jezero_dtms[:12]], "",
        "A HiRISE DTM footprint means finer elevation data exists for that area. Mars Explorer does not sample HiRISE DTM elevations; its Risk Index still uses the coarse PLACES grid and stays non-certifying.", "",
        "## IAU planetary nomenclature for Mars (Gazetteer of Planetary Nomenclature)", "",
        f"The data.nasa.gov dataset \"Gazetteer of Planetary Nomenclature: Mars\" ({NOMENCLATURE_DATASET}) covers feature names approved by the International Astronomical Union (IAU) Working Group for Planetary System Nomenclature and maintained by the USGS. Mars Explorer loads {len(features)} IAU-adopted Mars feature center points and labels them on the map.", "",
        "Named features in and around Jezero Crater include:", "",
        *[f"- {f['name']} ({f['type']}, {f['diameterKm']:g} km): {f['lat']}° N, {f['lon']}° E. {f['origin']}" for f in jezero_names[:14]], "",
        "Jezero is a 47.5 km crater named for a town in Bosnia-Herzegovina. Neretva Vallis and Sava Vallis are the inlet valleys that fed the Jezero delta. Belva is a 0.9 km crater on the delta. Jezero Mons is a mountain on the crater's southeast rim.", "",
        "## Limits", "",
        "- Catalog records describe archives; many have no directly downloadable file on data.nasa.gov and link to PDS.",
        "- Mission tags are inferred from names and may miss or over-match datasets.",
        "- Feature center points mark a named feature's center, not its boundary or a landing target.", "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--skip-catalog", action="store_true")
    parser.add_argument("--skip-dtm", action="store_true")
    parser.add_argument("--skip-names", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    source_path = OUT / "SOURCE.json"
    source = json.loads(source_path.read_text()) if source_path.exists() else {}

    if not args.skip_catalog:
        print("data.nasa.gov catalog (tag: mars)…")
        cat = catalog()
        data = write_json(OUT / "catalog.json", {"source": CATALOG_PAGE, "api": CKAN, "fetchedAt": now, "total": cat["total"], "items": cat["items"]})
        source["catalog"] = {"product": "data.nasa.gov CKAN catalog, tag mars", "sourceUrl": CATALOG_PAGE, "apiUrl": f"{CKAN}?fq=tags:mars", "retrievedAt": now, "count": len(cat["items"]), "sha256": sha(data)}
        print(f"  {len(cat['items'])} datasets")
    if not args.skip_dtm:
        print("HiRISE DTM cumulative index…")
        dtms, raw = hirise_dtms()
        write_json(OUT / "hirise-dtm.json", {"source": DTM_INDEX, "label": DTM_LABEL, "dataset": DTM_DATASET, "fetchedAt": now, "items": dtms})
        source["hiriseDtm"] = {"product": "HiRISE DTM cumulative index (DTMCUMINDEX.TAB)", "sourceUrl": DTM_INDEX, "labelUrl": DTM_LABEL, "datasetUrl": DTM_DATASET, "retrievedAt": now, "count": len(dtms), "sha256": sha(raw)}
        print(f"  {len(dtms)} DTM footprints")
    if not args.skip_names:
        print("IAU Mars nomenclature…")
        features, raw = iau_features()
        write_json(OUT / "iau-features.json", {"source": NOMENCLATURE_ZIP, "dataset": NOMENCLATURE_DATASET, "fetchedAt": now, "items": features})
        source["iauFeatures"] = {"product": "IAU/USGS Mars nomenclature center points", "sourceUrl": NOMENCLATURE_ZIP, "datasetUrl": NOMENCLATURE_DATASET, "retrievedAt": now, "count": len(features), "sha256": sha(raw)}
        print(f"  {len(features)} named features")

    source_path.write_text(json.dumps(source, indent=2) + "\n")
    load = lambda name: json.loads((OUT / name).read_text())  # noqa: E731
    CORPUS_DOC.write_text(corpus_doc(load("catalog.json"), load("hirise-dtm.json")["items"], load("iau-features.json")["items"], now))
    print(f"wrote {CORPUS_DOC.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
