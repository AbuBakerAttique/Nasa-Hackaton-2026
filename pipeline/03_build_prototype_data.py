"""Build the small data files used by the prototype in index.html.
Run from the repo root after 02_harmonize.py:  venv/bin/python pipeline/03_build_prototype_data.py
Writes assets/proto/*.js (one per region) and assets/proto/index.js. These are committed so the board works from git."""
import glob
import json
import pathlib

import pandas as pd

OUT = pathlib.Path("assets/proto"); OUT.mkdir(parents=True, exist_ok=True)
BOXES = {  # name: (south, north, west, east, countries whose raw files cover it)
    "Brandenburg and Berlin area": (51.35, 53.56, 11.26, 14.77, ["Germany", "Poland", "Czech_Republic"]),
    "Central Portugal": (39.3, 41.0, -8.9, -6.9, ["Portugal", "Spain"]),
    "Attica and central Greece": (37.6, 38.7, 22.8, 24.2, ["Greece"]),
    "Galicia, Spain": (41.8, 43.8, -9.3, -6.7, ["Spain", "Portugal"]),
}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def build(rows, box):
    cells, idx, months = [], {}, {}
    cal = {k: [[0.0] * 12 for _ in range(25)] for k in ("raw", "harm", "rawF", "harmF")}
    for la, lo, y, mo, m, v, h, mf, vf, hf in rows:
        if not 2001 <= y <= 2025:
            continue
        r, rf = (m, mf) if y < 2012 else (v, vf)
        yi, mi = y - 2001, mo - 1
        cal["raw"][yi][mi] += r; cal["harm"][yi][mi] += h; cal["rawF"][yi][mi] += rf; cal["harmF"][yi][mi] += hf
        if r <= 0 and h <= 0:
            continue
        k = (la, lo)
        if k not in idx:
            idx[k] = len(cells); cells.append([la, lo])
        months.setdefault(f"{yi}-{mi}", []).append([idx[k], round(r), round(h), round(rf), round(hf)])
    return {"box": box, "cells": cells, "m": months, "cal": {k: [[round(x) for x in r] for r in v] for k, v in cal.items()}}


def sample_points(countries, box=None, cap=300):
    """Single detections from the newest month of 2025 that has at least 20 of them."""
    fr = [pd.read_csv(f"data/raw/viirs-snpp_2025_{c}.csv") for c in countries]
    df = pd.concat(fr, ignore_index=True)
    df = df[(df["type"] == 0) & df["confidence"].isin(["n", "h"])]
    if box:
        w, s, e, n = box
        df = df[df.latitude.between(s, n) & df.longitude.between(w, e)]
    if df.empty:
        return {"label": "2025", "total": 0, "rows": []}
    df = df.assign(mo=pd.to_datetime(df.acq_date).dt.month)
    counts = df.groupby("mo").size()
    busy = counts[counts >= 20]
    mo = int(busy.index.max()) if len(busy) else int(counts.idxmax())
    d = df[df.mo == mo].sort_values(["acq_date", "acq_time"])
    rows = [[r.acq_date, f"{int(r.acq_time):04d}", round(r.latitude, 4), round(r.longitude, 4), round(r.frp, 1), r.daynight]
            for r in d.head(cap).itertuples()]
    return {"label": f"{MONTHS[mo - 1]} 2025", "total": int(len(d)), "rows": rows}


index = []
for f in sorted(glob.glob("data/out/cells/*.json")):
    c = pathlib.Path(f).stem
    rows = json.load(open(f))
    la = [r[0] for r in rows]; lo = [r[1] for r in rows]
    d = build(rows, [min(lo) - .125, min(la) - .125, max(lo) + .125, max(la) + .125])
    d["pts"] = sample_points([c])
    name = c.replace("_", " ") + " (whole country)"
    index.append({"name": name, "file": c})
    (OUT / f"{c}.js").write_text(f"window.PROTO[{json.dumps(name)}]=" + json.dumps(d, separators=(",", ":")) + ";")
allrows = json.load(open("data/out/cells.json"))
for name, (s, n, w, e, countries) in BOXES.items():
    d = build([r for r in allrows if s <= r[0] <= n and w <= r[1] <= e], [w, s, e, n])
    d["pts"] = sample_points(countries, (w, s, e, n))
    slug = "region_" + name.split(",")[0].replace(" ", "_")
    index.append({"name": name, "file": slug})
    (OUT / f"{slug}.js").write_text(f"window.PROTO[{json.dumps(name)}]=" + json.dumps(d, separators=(",", ":")) + ";")
(OUT / "index.js").write_text("window.PROTO=window.PROTO||{};window.PROTO_INDEX=" + json.dumps(index) + ";")
for i in index:
    print(f"{i['name']:36s} {(OUT / (i['file'] + '.js')).stat().st_size // 1024:5d} KB")
