"""Download the current year (2026) of VIIRS S-NPP hotspots from the FIRMS area API
and write one file per country into data/raw/, next to the yearly country files.
Run from the repo root:  venv/bin/python pipeline/07_download_current.py
Then rerun 02_harmonize.py and `npm run copy-data` in web/.

Needs a free FIRMS map key in the environment or in .env (never committed):
    FIRMS_MAP_KEY=...
Request one at https://firms.modaps.eosdis.nasa.gov/api/map_key/

Why this script exists: NASA publishes yearly country files only for finished
years, so 2026 has none. The API has two kinds of data:
  - VIIRS_SNPP_SP  (standard, final) up to about three months ago: same product as history.
  - VIIRS_SNPP_NRT (near real time, provisional) for the most recent months.
Two gaps against the yearly country files, both handled here and labelled:
  1. The API takes a box, not a country. Each detection is assigned to a country
     with Natural Earth 10m borders (the country files use NASA's own borders).
  2. NRT rows have no `type` column, so the "vegetation fires only" filter cannot
     run. Instead, a detection is marked non-vegetation (type 2) when it falls on a
     0.01-degree spot where 2012-2025 standard data flagged a volcano, static land
     source or offshore source. Tested on 2025: catches 98.7 % of non-vegetation
     detections and wrongly drops 3.0 % of vegetation ones."""
import datetime as dt
import io
import json
import os
import pathlib
import time

import numpy as np
import pandas as pd
import requests
from matplotlib.path import Path

YEAR = 2026
API = "https://firms.modaps.eosdis.nasa.gov/api"
BOX = "-29.1,27.4,45.1,68.6"          # west,south,east,north: covers all 16 study countries
WINDOW = 5                            # the area API returns at most 5 days per request
MASK_GRID = 0.01                      # degrees, about one VIIRS 375 m pixel
BORDERS_URL = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/"
               "geojson/ne_10m_admin_0_countries.geojson")
# File name used by the yearly country files -> Natural Earth ADM0_A3 code.
COUNTRIES = {
    "Austria": "AUT", "Bulgaria": "BGR", "Croatia": "HRV", "Czech_Republic": "CZE", "France": "FRA",
    "Germany": "DEU", "Greece": "GRC", "Hungary": "HUN", "Italy": "ITA", "Poland": "POL",
    "Portugal": "PRT", "Romania": "ROU", "Spain": "ESP", "Sweden": "SWE", "Turkey": "TUR", "Ukraine": "UKR",
}
RAW = pathlib.Path("data/raw")
CACHE = pathlib.Path("data/api")
OUT = pathlib.Path("data/out")
for d in (RAW, CACHE, OUT):
    d.mkdir(parents=True, exist_ok=True)


def map_key():
    key = os.environ.get("FIRMS_MAP_KEY")
    env = pathlib.Path(".env")
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.strip().startswith("FIRMS_MAP_KEY="):
                key = line.split("=", 1)[1].strip().strip('"\'')
    if not key:
        raise SystemExit("FIRMS_MAP_KEY is not set. Put FIRMS_MAP_KEY=... in .env at the repo root.")
    return key


KEY = map_key()


def get(url):
    for attempt in range(4):
        try:
            r = requests.get(url, timeout=120)
            if r.ok:
                return r.text
        except requests.RequestException:
            pass
        time.sleep(2 ** attempt)
    raise SystemExit(f"FIRMS request failed: {url.replace(KEY, '<key>')}")


def availability():
    text = get(f"{API}/data_availability/csv/{KEY}/all")
    a = pd.read_csv(io.StringIO(text)).set_index("data_id")
    day = lambda s: dt.date.fromisoformat(a.loc[s, "max_date"])
    return day("VIIRS_SNPP_SP"), day("VIIRS_SNPP_NRT")


def windows(first, last):
    d = first
    while d <= last:
        yield d, min(WINDOW, (last - d).days + 1)
        d += dt.timedelta(days=WINDOW)


def fetch(source, start, days, final):
    f = CACHE / f"{source}_{start}_{days}.csv"
    if final and f.exists():
        return pd.read_csv(f)
    text = get(f"{API}/area/csv/{KEY}/{source}/{BOX}/{days}/{start}")
    if not text.startswith("latitude"):
        raise SystemExit(f"{source} {start}: unexpected answer: {text[:200]}")
    f.write_text(text)
    return pd.read_csv(io.StringIO(text))


def borders():
    f = CACHE / "ne_10m_admin_0_countries.geojson"
    if not f.exists():
        f.write_text(get(BORDERS_URL))
    out = {}
    for feat in json.loads(f.read_text())["features"]:
        code = feat["properties"]["ADM0_A3"]
        if code not in COUNTRIES.values():
            continue
        g = feat["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        out[code] = [Path(np.array(p[0])) for p in polys]     # outer rings; holes ignored
    missing = set(COUNTRIES.values()) - set(out)
    if missing:
        raise SystemExit(f"Natural Earth borders missing for {sorted(missing)}")
    return out


def assign_country(df, shapes):
    """Name of the study country that contains each detection, or None."""
    pts = df[["longitude", "latitude"]].to_numpy()
    result = np.full(len(df), None, dtype=object)
    for name, code in COUNTRIES.items():
        hit = np.zeros(len(df), dtype=bool)
        for path in shapes[code]:
            (x0, y0), (x1, y1) = path.vertices.min(0), path.vertices.max(0)
            box = (pts[:, 0] >= x0) & (pts[:, 0] <= x1) & (pts[:, 1] >= y0) & (pts[:, 1] <= y1)
            if box.any():
                idx = np.flatnonzero(box & ~hit)
                hit[idx] = path.contains_points(pts[idx])
        result[hit & (result == None)] = name  # noqa: E711 (elementwise on an object array)
    return result


def spot(df):
    return (np.round(df.latitude / MASK_GRID).astype(int).astype(str) + "_"
            + np.round(df.longitude / MASK_GRID).astype(int).astype(str))


def non_vegetation_spots():
    frames = [pd.read_csv(f, usecols=["latitude", "longitude", "type"])
              for f in RAW.glob("viirs-snpp_*.csv") if not f.name.startswith(f"viirs-snpp_{YEAR}_")]
    h = pd.concat(frames)
    return set(spot(h[h.type != 0]))


sp_last, nrt_last = availability()
year_start, year_end = dt.date(YEAR, 1, 1), dt.date(YEAR, 12, 31)
sp_end = min(sp_last, year_end)
nrt_end = min(nrt_last, year_end)
print(f"Standard data {year_start} to {sp_end}; near-real-time {sp_end + dt.timedelta(days=1)} to {nrt_end}")

parts = []
for start, days in windows(year_start, sp_end):
    d = fetch("VIIRS_SNPP_SP", start, days, final=True)
    d["type_source"] = "firms"
    parts.append(d)
for start, days in windows(sp_end + dt.timedelta(days=1), nrt_end):
    d = fetch("VIIRS_SNPP_NRT", start, days, final=False)     # NRT is refetched: NASA updates it
    d["type_source"] = "location_mask"
    parts.append(d)
df = pd.concat([p for p in parts if len(p)], ignore_index=True)
df = df[pd.to_datetime(df.acq_date).dt.year == YEAR]

masked = df.type_source == "location_mask"
spots = non_vegetation_spots()
df.loc[masked, "type"] = np.where(spot(df[masked]).isin(spots), 2, 0)
df["type"] = df["type"].astype(int)

df["country"] = assign_country(df, borders())
df = df[df.country.notna()]

columns = ["latitude", "longitude", "bright_ti4", "scan", "track", "acq_date", "acq_time", "satellite",
           "instrument", "confidence", "version", "bright_ti5", "frp", "daynight", "type", "type_source"]
for name in COUNTRIES:
    rows = df[df.country == name][columns].sort_values(["acq_date", "acq_time"])
    rows.to_csv(RAW / f"viirs-snpp_{YEAR}_{name}.csv", index=False)

coverage = {
    "year": YEAR,
    "sensor": "VIIRS S-NPP",
    "first_date": str(year_start),
    "last_date": str(df.acq_date.max()),
    "standard_until": str(sp_end),
    "provisional_from": str(sp_end + dt.timedelta(days=1)),
    "rows_by_country": {n: int((df.country == n).sum()) for n in COUNTRIES},
    "nrt_rows_marked_non_vegetation": int((df.type_source.eq("location_mask") & df.type.ne(0)).sum()),
    "method": ("FIRMS area API, Natural Earth 10m borders for country assignment; near-real-time rows "
               "have no type flag, so non-vegetation spots are masked using 2012-2025 standard-data flags."),
    "retrieved": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
}
(OUT / "current_year.json").write_text(json.dumps(coverage, indent=2))
print(json.dumps(coverage, indent=2))
