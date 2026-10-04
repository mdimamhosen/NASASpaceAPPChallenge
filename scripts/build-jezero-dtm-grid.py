"""Sample NASA PDS Mars 2020 PLACES orbital DEM into a small, cited grid.

The source is a VICAR/PDS IMG with a 118400-byte header followed by
5480 x 14800 big-endian float32 elevations. Coordinates and pixel offsets
come from the accompanying PDS4 XML label. This build artifact is a coarse
visual/planning sample, not a certified terrain or route product.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import ssl
import struct
import urllib.request

try:
    import certifi
    TLS_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    TLS_CONTEXT = ssl.create_default_context()

SOURCE = "https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_maps/m20_orbital_dem.img"
LABEL = "https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_maps/m20_orbital_dem.xml"
OUTPUT = Path(__file__).resolve().parents[1] / "data/jezero/pds-orbital-dem-grid.json"
HEADER_BYTES = 118400
SAMPLES_PER_LINE = 14800
LINES = 5480
RADIUS_M = 3396190
STANDARD_PARALLEL = 18.4663
UPPER_LEFT_X = 4340890
UPPER_LEFT_Y = 1097070
PIXEL_M = 1
LAT_MIN, LAT_MAX = 18.416, 18.508
LON_MIN, LON_MAX = 77.28, 77.47
STEP = 0.002


def pixel(lat, lon):
    x = RADIUS_M * math.cos(math.radians(STANDARD_PARALLEL)) * math.radians(lon)
    y = RADIUS_M * math.radians(lat)
    return round((UPPER_LEFT_Y - y) / PIXEL_M), round((x - UPPER_LEFT_X) / PIXEL_M)


def sample_row(latitude):
    longitude_values = [round(LON_MIN + i * STEP, 6) for i in range(round((LON_MAX - LON_MIN) / STEP) + 1)]
    line, first = pixel(latitude, longitude_values[0])
    _, last = pixel(latitude, longitude_values[-1])
    if not (0 <= line < LINES and 0 <= first <= last < SAMPLES_PER_LINE):
        raise ValueError(f"Grid is outside the PDS DEM at {latitude}")
    start = HEADER_BYTES + (line * SAMPLES_PER_LINE + first) * 4
    end = HEADER_BYTES + (line * SAMPLES_PER_LINE + last + 1) * 4 - 1
    request = urllib.request.Request(SOURCE, headers={"Range": f"bytes={start}-{end}"})
    with urllib.request.urlopen(request, timeout=45, context=TLS_CONTEXT) as response:
        body = response.read()
        if response.status != 206 or len(body) != end - start + 1:
            raise RuntimeError(f"PDS range response was incomplete for line {line}")
    values = struct.unpack(f">{last - first + 1}f", body)
    result = []
    for lon in longitude_values:
        _, column = pixel(latitude, lon)
        value = values[column - first]
        result.append(round(value, 2) if math.isfinite(value) and -10000 < value < 10000 else None)
    return result


def main():
    latitudes = [round(LAT_MIN + i * STEP, 6) for i in range(round((LAT_MAX - LAT_MIN) / STEP) + 1)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        rows = list(pool.map(sample_row, latitudes))
    valid = [value for row in rows for value in row if value is not None]
    if len(valid) < len(rows) * len(rows[0]) * 0.5:
        raise RuntimeError("Most PDS DEM samples are missing; inspect the source and projection")
    output = {
        "product": "Mars 2020 PLACES m20_orbital_dem.img",
        "sourceUrl": SOURCE,
        "labelUrl": LABEL,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "coordinateSystem": "Mars planetocentric latitude; east-positive longitude",
        "projection": "Equirectangular; standard parallel 18.4663 degrees; 1 m source pixels",
        "sampleSpacingDegrees": STEP,
        "latMin": LAT_MIN,
        "lonMin": LON_MIN,
        "rows": rows,
        "validSamples": len(valid),
        "nonCertifying": True,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Wrote {OUTPUT}: {len(rows)} x {len(rows[0])}, {len(valid)} valid DEM samples")


if __name__ == "__main__":
    main()
