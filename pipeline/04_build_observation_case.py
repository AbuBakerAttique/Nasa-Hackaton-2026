"""Export a bounded, reproducible observation replay, not an incident perimeter.
Run from the repository root after downloading NASA FIRMS country CSVs.
"""
import csv
import hashlib
import json
from pathlib import Path

BOUNDS = [12.7, 51.9, 13.05, 52.2]
START, END = '2022-06-17', '2022-06-23'
observations, sources = [], []
for sensor in ('modis', 'viirs-snpp'):
    path = Path(f'data/raw/{sensor}_2022_Germany.csv')
    sources.append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'url': f'https://firms.modaps.eosdis.nasa.gov/data/country/{sensor}/2022/{path.name}'})
    with path.open() as stream:
        for row in csv.DictReader(stream):
            lat, lon = float(row['latitude']), float(row['longitude'])
            if not (row['type'] == '0' and START <= row['acq_date'] <= END
                    and BOUNDS[0] <= lon <= BOUNDS[2] and BOUNDS[1] <= lat <= BOUNDS[3]):
                continue
            if sensor == 'modis' and float(row['confidence']) < 30:
                continue
            if sensor != 'modis' and row['confidence'] not in ('n', 'h'):
                continue
            hhmm = row['acq_time'].zfill(4)
            timestamp = f"{row['acq_date']}T{hhmm[:2]}:{hhmm[2:]}:00Z"
            observations.append({'id': f'{sensor}-{len(observations)}', 'lat': lat, 'lon': lon,
                'timestamp': timestamp, 'sensor': 'MODIS' if sensor == 'modis' else 'VIIRS S-NPP',
                'satellite': row['satellite'], 'confidence': row['confidence'], 'frp': float(row['frp']),
                'type': int(row['type']), 'daynight': row['daynight']})
observations.sort(key=lambda r: (r['timestamp'], r['sensor'], r['id']))
assert observations, 'No filtered observations in case area'
output = {'title': 'Brandenburg · June 2022', 'bounds': BOUNDS, 'start': START, 'end': END,
          'description': 'Satellite detections in a fixed area near Treuenbrietzen. This spatial selection may include multiple fires; no ignition cause or incident boundary is inferred.',
          'sources': sources, 'observations': observations}
dest = Path('data/out/case-studies')
dest.mkdir(parents=True, exist_ok=True)
(dest / 'brandenburg-2022.json').write_text(json.dumps(output, indent=2) + '\n')
print(f'Case export: {len(observations)} detections, {len(set(r["timestamp"] for r in observations))} acquisition times')
