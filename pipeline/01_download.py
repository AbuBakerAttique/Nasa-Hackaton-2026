"""Download FIRMS yearly country files for both sensors into data/raw/.
Run from the repo root:  venv/bin/python pipeline/01_download.py
Safe to rerun: files that already exist are skipped."""
import pathlib
import concurrent.futures as cf
import requests

BASE = "https://firms.modaps.eosdis.nasa.gov/data/country"
# Names must match NASA's file names exactly (underscores, e.g. Czech_Republic).
# Very large countries (Brazil, Russian_Federation: about 100 MB per year) are left out on purpose.
COUNTRIES = [
    "Germany", "Portugal", "Greece", "Spain",                       # first test set
    "Italy", "France", "Croatia", "Turkey",                         # Mediterranean
    "Poland", "Czech_Republic", "Austria", "Hungary", "Sweden",     # central and northern Europe, closer to Germany
    "Bulgaria", "Romania", "Ukraine",                               # eastern Europe, much agricultural burning
]
SOURCES = {"modis": range(2001, 2026), "viirs-snpp": range(2012, 2026)}
OUT = pathlib.Path("data/raw")
OUT.mkdir(parents=True, exist_ok=True)


def fetch(job):
    src, year, country = job
    f = OUT / f"{src}_{year}_{country}.csv"
    if f.exists() and f.stat().st_size > 100:
        return "have"
    try:
        r = requests.get(f"{BASE}/{src}/{year}/{src}_{year}_{country}.csv", timeout=60)
        if r.ok and r.text.startswith("latitude"):
            f.write_text(r.text)
            return "ok"
        return f"MISS {f.name} (HTTP {r.status_code})"
    except requests.RequestException as e:
        return f"MISS {f.name} ({e})"


jobs = [(s, y, c) for s, years in SOURCES.items() for y in years for c in COUNTRIES]
with cf.ThreadPoolExecutor(8) as ex:
    results = list(ex.map(fetch, jobs))
print(f"{sum(r in ('ok', 'have') for r in results)} of {len(jobs)} files present")
for r in results:
    if r.startswith("MISS"):
        print(r)
