"""Fetch official NASA country archives needed by the six global study areas.
Files are streamed, size checked against NASA's catalogue, and atomically renamed.
Existing European files are reused. Run from the repository root.
"""
import concurrent.futures as cf
import csv
import hashlib
import json
from pathlib import Path
import time
import requests

BASE = 'https://firms.modaps.eosdis.nasa.gov/data/country'
ROOT = Path('data/global')
ROOT.mkdir(parents=True, exist_ok=True)
CATALOG_URL = f'{BASE}/yearly_summary_files.txt'
r = requests.get(CATALOG_URL, timeout=90)
r.raise_for_status()
(ROOT / 'nasa-catalog.csv').write_text(r.text)
catalog = {row['filename']: row for row in csv.DictReader(r.text.splitlines())}
COUNTRIES = {'Brazil':2018, 'United_States':2020, 'Australia':2020,
             'Central_African_Republic':2020, 'Indonesia':2020,
             'Portugal':2020, 'Spain':2020, 'Greece':2020}
jobs = [(sensor,year,country) for country,first in COUNTRIES.items()
        for sensor in ('modis','viirs-snpp') for year in range(first,2026)]

def fetch(job):
    sensor, year, country = job
    name = f'{sensor}_{year}_{country}.csv'
    expected = int(catalog[name]['size'])
    legacy = Path('data/raw') / name
    path = legacy if legacy.exists() else ROOT / 'raw' / name
    path.parent.mkdir(exist_ok=True, parents=True)
    url = f'{BASE}/{sensor}/{year}/{name}'
    for attempt in range(3):
        try:
            if not path.exists() or path.stat().st_size != expected:
                temp = path.with_suffix('.partial')
                with requests.get(url, timeout=(30,180), stream=True) as response:
                    response.raise_for_status()
                    with temp.open('wb') as stream:
                        for chunk in response.iter_content(1024*1024):
                            stream.write(chunk)
                if temp.stat().st_size != expected:
                    raise ValueError(f'{name}: expected {expected} bytes, got {temp.stat().st_size}')
                with temp.open('rb') as stream:
                    if not stream.read(100).startswith(b'latitude,longitude'):
                        raise ValueError(f'{name}: not a NASA CSV')
                temp.replace(path)
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            print(f'Ready {name} ({expected/1e6:.1f} MB)', flush=True)
            return {'file':str(path), 'url':url, 'bytes':expected, 'sha256':digest,
                    'sensor':sensor, 'year':year, 'country':country, 'catalogUpdated':catalog[name]['updated']}
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2*(attempt+1))

with cf.ThreadPoolExecutor(6) as executor:
    manifest = list(executor.map(fetch,jobs))
(ROOT / 'inputs.json').write_text(json.dumps({'catalog':CATALOG_URL,'inputs':manifest},indent=2)+'\n')
print(f'Complete: {len(manifest)} validated archives',flush=True)
