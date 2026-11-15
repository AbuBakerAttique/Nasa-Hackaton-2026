"""Build cell tables, compare candidate corrections, report validation, and export app data.
Run from the repo root:  venv/bin/python pipeline/02_harmonize.py
Outputs in data/out/: cells.json, report.json, problem.png, validation.png"""
import glob
import hashlib
import json
import pathlib

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error as mae, r2_score as r2

GRID = 0.25            # cell size in degrees
BLOCK = 2.0            # region size used for the regional accuracy check
TRAIN_END, TEST_START = 2021, 2022
OUT = pathlib.Path("data/out")
OUT.mkdir(parents=True, exist_ok=True)
KEYS = ["country", "clat", "clon", "year", "month"]
FEATURES = ["m_n", "m_frp", "m_aqua", "m_day", "m_days", "month", "clat", "clon"]


def load(pattern, sensor):
    frames = []
    for f in glob.glob(pattern):
        d = pd.read_csv(f)
        d["country"] = pathlib.Path(f).stem.split("_", 2)[2]      # e.g. viirs-snpp_2023_Czech_Republic
        frames.append(d)
    df = pd.concat(frames, ignore_index=True)
    df = df[df["type"] == 0]                                   # presumed vegetation fires only
    if sensor == "modis":
        df = df[df["confidence"] >= 30]                        # drop low confidence
    else:
        df = df[df["confidence"].isin(["n", "h"])]
    d = pd.to_datetime(df["acq_date"])
    df["year"], df["month"] = d.dt.year, d.dt.month
    df["clat"] = np.floor(df["latitude"] / GRID) * GRID + GRID / 2
    df["clon"] = np.floor(df["longitude"] / GRID) * GRID + GRID / 2
    return df


m = load("data/raw/modis_*.csv", "modis")
v = load("data/raw/viirs-snpp_*.csv", "viirs")

# Fail before publishing outputs if an overlap year has no usable observations.
for sensor, frame in [("MODIS", m), ("VIIRS", v)]:
    absent = set(range(2012, 2026)) - set(frame.year)
    if absent:
        raise ValueError(f"{sensor}: missing usable overlap years {sorted(absent)}; rerun download")
inputs = sorted(pathlib.Path("data/raw").glob("*.csv"))
input_digest = hashlib.sha256()
for source in inputs:
    input_digest.update(source.name.encode())
    input_digest.update(source.read_bytes())

# Chart 1: the problem. Same fires, two sensors, different counts.
yearly = pd.DataFrame({"MODIS": m.groupby("year").size(), "VIIRS S-NPP": v.groupby("year").size()})
ax = yearly.plot(kind="bar", figsize=(10, 4), width=0.85)
ax.set_ylabel(f"detections per year ({m.country.nunique()} countries)")
ax.set_title("Two sensors, the same fires, different counts")
plt.tight_layout(); plt.savefig(OUT / "problem.png", dpi=150); plt.close()

m["aqua"] = (m["satellite"] == "Aqua").astype(int)
m["day"] = (m["daynight"] == "D").astype(int)
modis = m.groupby(KEYS).agg(m_n=("frp", "size"), m_frp=("frp", "sum"), m_aqua=("aqua", "sum"),
                            m_day=("day", "sum"), m_days=("acq_date", "nunique")).reset_index()
viirs = v.groupby(KEYS).agg(v_n=("frp", "size"), v_frp=("frp", "sum")).reset_index()
cells = modis.merge(viirs, on=KEYS, how="outer").fillna(0)

overlap = cells[cells.year >= 2012]                  # years with both sensors
seen = overlap[overlap.m_n > 0]                      # cell-months where MODIS saw something
train, test = seen[seen.year <= TRAIN_END], seen[seen.year >= TEST_START]

# Baseline: one fixed multiplier.
ratio = train.v_n.sum() / train.m_n.sum()

# Model: predict the VIIRS-to-MODIS ratio for each cell-month, weighted by MODIS count.
# (Predicting the count directly with a Poisson loss was tried and was far worse than the baseline.)
model = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.05, max_depth=4, random_state=0)
model.fit(train[FEATURES], train.v_n / train.m_n, sample_weight=train.m_n)


def predict(df):
    return model.predict(df[FEATURES]).clip(0) * df.m_n


# VIIRS also detects fires in cell-months where MODIS saw nothing. Scale regional totals for that.
tr_all = overlap[overlap.year <= TRAIN_END]
uplift = tr_all.v_n.sum() / tr_all[tr_all.m_n > 0].v_n.sum()

pred, base = predict(test), test.m_n * ratio


def blocks(df, cols):
    b = df.assign(blat=np.floor(df.clat / BLOCK) * BLOCK, blon=np.floor(df.clon / BLOCK) * BLOCK)
    return b.groupby(["country", "blat", "blon", "year", "month"])[cols].sum()


tb = blocks(test.assign(pred=pred, base=base), ["v_n", "pred", "base"])
te_all = overlap[overlap.year >= TEST_START]
ab = blocks(te_all.assign(est=np.where(te_all.m_n > 0, predict(te_all), 0) * uplift), ["v_n", "m_n", "est"])

report = {
    "grid_degrees": GRID,
    "train_years": f"2012-{TRAIN_END}", "test_years": f"{TEST_START}-{int(cells.year.max())}",
    "seen_cell_candidate_ratio": round(float(ratio), 3), "ml_candidate_unseen_cell_uplift": round(float(uplift), 3),
    "share_of_viirs_detections_where_modis_saw_nothing": round(float(1 - 1 / uplift), 3),
    "candidate_models_on_modis_seen_cell_months": {
        "ml_ratio_model": {"mae": round(float(mae(test.v_n, pred)), 2), "r2": round(float(r2(test.v_n, pred)), 3)},
        "seen_cell_ratio": {"mae": round(float(mae(test.v_n, base)), 2), "r2": round(float(r2(test.v_n, base)), 3)},
    },
    "candidate_models_on_modis_seen_blocks": {
        "ml_ratio_model": {"mae": round(float(mae(tb.v_n, tb.pred)), 1), "r2": round(float(r2(tb.v_n, tb.pred)), 3)},
        "seen_cell_ratio": {"mae": round(float(mae(tb.v_n, tb.base)), 1), "r2": round(float(r2(tb.v_n, tb.base)), 3)},
    },
    "region_month_all_cells": {"ml_candidate_mae": round(float(mae(ab.v_n, ab.est)), 1), "ml_candidate_r2": round(float(r2(ab.v_n, ab.est)), 3),
                               "raw_modis_mae": round(float(mae(ab.v_n, ab.m_n)), 1), "raw_modis_r2": round(float(r2(ab.v_n, ab.m_n)), 3)},
    "test_totals": {"actual_viirs": int(te_all.v_n.sum()), "raw_modis": int(te_all.m_n.sum())},
}
# Per country: yearly totals on the held-out years, harmonized estimate against actual VIIRS.
by_country = {}
ce = te_all.assign(est=np.where(te_all.m_n > 0, predict(te_all), 0) * uplift, simple=te_all.m_n * (tr_all.v_n.sum() / tr_all.m_n.sum()))
for country, g in ce.groupby("country"):
    yr = g.groupby("year")[["v_n", "m_n", "est", "simple"]].sum()
    by_country[country] = {
        "actual_viirs": int(yr.v_n.sum()), "raw_modis": int(yr.m_n.sum()),
        "ml_candidate_total_bias_pct": round(float((yr.est.sum() / max(yr.v_n.sum(), 1) - 1) * 100), 1),
        "fixed_ratio_total_bias_pct": round(float((yr.simple.sum() / max(yr.v_n.sum(), 1) - 1) * 100), 1),
    }
# Country ratio: one multiplier per country, learned on the training years (all cells).
cr = tr_all.groupby("country")[["v_n", "m_n"]].sum()
country_ratio = (cr.v_n / cr.m_n.clip(lower=1)).to_dict()
ce["cratio"] = ce.m_n * ce.country.map(country_ratio)
cb = blocks(ce, ["v_n", "cratio"])
for country, g in ce.groupby("country"):
    by_country[country]["country_specific_ratio"] = round(float(country_ratio[country]), 2)
    by_country[country]["country_specific_ratio_total_bias_pct"] = round(float((g.cratio.sum() / max(g.v_n.sum(), 1) - 1) * 100), 1)
report["shipped_method"] = "fixed_europe_wide_ratio"
report["regional_ratio_all_cells"] = round(float(tr_all.v_n.sum() / tr_all.m_n.sum()), 3)
sb = blocks(ce, ["v_n", "m_n", "simple"])
report["by_country_test_years"] = by_country
report.pop("region_month_all_cells")
report["test_totals"]["fixed_ratio_estimate"] = round(float(ce.simple.sum()), 2)
report["validation"] = {
    "target": "filtered VIIRS S-NPP hotspot detections",
    "years": report["test_years"],
    "unit": "country × 2-degree spatial block × month with at least one sensor detection",
    "n_units": int(len(sb)),
    "fixed_ratio": {"mae": round(float(mae(sb.v_n, sb.simple)), 1),
                    "r2": round(float(r2(sb.v_n, sb.simple)), 3),
                    "total_estimate": round(float(ce.simple.sum()), 2)},
    "raw_modis": {"mae": round(float(mae(sb.v_n, sb.m_n)), 1),
                  "r2": round(float(r2(sb.v_n, sb.m_n)), 3),
                  "total": int(te_all.m_n.sum())},
    "ml_candidate": {"mae": round(float(mae(ab.v_n, ab.est)), 1),
                     "r2": round(float(r2(ab.v_n, ab.est)), 3),
                     "total_estimate": round(float(ab.est.sum()), 2)},
    "limitations": "Scores describe detection-count agreement on non-empty spatial block-months, not individual fires, burned area, ignition, or spread.",
}
report["validation_scope"] = report["validation"]["limitations"]
report["input_provenance"] = {"csv_files": len(inputs), "sha256": input_digest.hexdigest(),
    "filtered_rows_by_year": {sensor: {str(y): int(n) for y, n in frame.groupby("year").size().items()}
                              for sensor, frame in [("modis", m), ("viirs", v)]}}

# Fire intensity: the same idea for heat output (fire radiative power, MW), with its own ratio.
frp_ratio = tr_all.v_frp.sum() / tr_all.m_frp.sum()
fb = blocks(te_all.assign(est_frp=te_all.m_frp * frp_ratio), ["v_frp", "m_frp", "est_frp"])
report["intensity"] = {"frp_ratio": round(float(frp_ratio), 3),
                       "region_month_r2_raw_modis": round(float(r2(fb.v_frp, fb.m_frp)), 3),
                       "region_month_r2_fixed_ratio": round(float(r2(fb.v_frp, fb.est_frp)), 3),
                       "limitation": "Exploratory FRP aggregate comparison; different sensor pixel sizes and retrievals prevent interpretation as burned area or cumulative fire energy."}
(OUT / "report.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))

# Chart 2: validation on held-out years, region-month totals.
fig, ax = plt.subplots(figsize=(5, 5))
ax.scatter(ab.v_n, ab.m_n, s=8, alpha=0.4, label="raw MODIS")
ax.scatter(sb.v_n, sb.simple, s=8, alpha=0.6, label="harmonized (exported single ratio)")
lim = max(sb.v_n.max(), sb.simple.max()); ax.plot([1, lim], [1, lim], "k--", lw=1)
ax.set_xscale("log"); ax.set_yscale("log")
ax.set_xlabel("actual VIIRS detections (region-month)"); ax.set_ylabel("estimate from MODIS")
ax.set_title(f"Held-out years {report['test_years']}"); ax.legend()
plt.tight_layout(); plt.savefig(OUT / "validation.png", dpi=150); plt.close()

# Export. Before 2012: single-ratio estimate. From 2012: real VIIRS.
# Shipped method: one ratio for all countries. On held-out years it is the most accurate for regional
# totals (see report.json). The per-cell model and the per-country ratio are reported for comparison only.
SHIPPED_RATIO = tr_all.v_n.sum() / tr_all.m_n.sum()
cells["harmonized"] = np.where(cells.year >= 2012, cells.v_n, cells.m_n * SHIPPED_RATIO)
cells["harmonized_frp"] = np.where(cells.year >= 2012, cells.v_frp, cells.m_frp * frp_ratio)
COLS = ["clat", "clon", "year", "month", "m_n", "v_n", "harmonized", "m_frp", "v_frp", "harmonized_frp"]
out = cells[COLS].round(2)
out.to_json(OUT / "cells.json", orient="values")
# One file per country too, so the web app can load only what it needs.
(OUT / "cells").mkdir(exist_ok=True)
for country, g in cells.groupby("country"):
    g[COLS].round(2).to_json(OUT / "cells" / f"{country}.json", orient="values")
print("cells.json rows:", len(out), "size MB:", round((OUT / "cells.json").stat().st_size / 1e6, 2))
