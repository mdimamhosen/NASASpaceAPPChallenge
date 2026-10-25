#!/usr/bin/env python3
"""Snapshot Perseverance's sample tubes from NASA's Mars rock samples page.

Each card on the page lists: name, Sample No., Feature Name, Sample Type, Sol Sealed, Date Sealed, Rock Type,
Sample Height and Current Location. Output: data/samples/tubes.json with the page URL and sha256. Standard library only.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "samples" / "tubes.json"
URL = "https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/"
try:
    import certifi

    TLS = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    TLS = ssl.create_default_context(cafile="/etc/ssl/cert.pem" if Path("/etc/ssl/cert.pem").exists() else None)
FIELDS = ["Feature Name", "Sample Type", "Sol Sealed", "Date Sealed", "Rock Type", "Sample Height", "Current Location"]


def parse(page: str) -> list[dict]:
    text = re.sub(r"<script.*?</script>|<style.*?</style>", "", page, flags=re.S)
    lines = [l.strip() for l in html.unescape(re.sub(r"<[^>]+>", "\n", text)).split("\n") if l.strip()]
    tubes = []
    for i, line in enumerate(lines):
        m = re.fullmatch(r"Sample No\. (\d+)", line)
        if not m or i == 0:
            continue
        name = lines[i - 1]
        if name.startswith("(aka"):
            name = f"{lines[i - 2]} {name}"
        rec: dict = {"number": int(m.group(1)), "name": name}
        j = i + 1
        while j < len(lines) - 1 and j < i + 24:
            # Two layouts: "Key:" / "value" and "Key" / ": value"; heights may read "Sample Height cm/in".
            key = re.sub(r"\s+cm/in$", "", lines[j].replace("\xa0", " ").rstrip(":").strip())
            if key in FIELDS:
                rec.setdefault(key, lines[j + 1].replace("\xa0", " ").lstrip(":").strip())
                j += 2
            else:
                j += 1
        if "Sol Sealed" in rec:
            tubes.append({
                "number": rec["number"], "name": rec["name"], "feature": rec.get("Feature Name"),
                "type": rec.get("Sample Type"), "sol": int(rec["Sol Sealed"]) if rec["Sol Sealed"].isdigit() else None,
                "date": rec.get("Date Sealed"), "rockType": rec.get("Rock Type"), "height": rec.get("Sample Height"),
                "location": rec.get("Current Location"),
            })
    # The page repeats cards in carousels; keep the first record per sample number.
    return list({t["number"]: t for t in reversed(tubes)}.values())[::-1]


def main() -> None:
    raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "MarsExplorer/1.0"}), context=TLS, timeout=60).read()
    tubes = sorted(parse(raw.decode("utf8")), key=lambda t: t["number"])
    if not tubes:
        raise SystemExit("no sample cards parsed; page layout changed")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": URL, "sha256": hashlib.sha256(raw).hexdigest(), "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "tubes": tubes}, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(tubes)} tubes, sols {tubes[0]['sol']}..{tubes[-1]['sol']}")


if __name__ == "__main__":
    main()
