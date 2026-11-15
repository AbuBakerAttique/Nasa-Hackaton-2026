"""Validate the shipped Europe-wide ratio for three regional aggregates.

Uses only the standard library. Run from repository root after the harmonized
cell files exist. It writes auditable monthly metrics and a standalone SVG.
"""
import html
import json
from pathlib import Path

DATA = Path("data/out")
REPORT = json.loads((DATA / "report.json").read_text())
FIRST, LAST = map(int, REPORT["test_years"].split("-"))
RATIO = float(REPORT["regional_ratio_all_cells"])
GROUPS = {
    "West & north-central Europe": ["France", "Germany", "Austria", "Czech_Republic", "Hungary", "Poland", "Sweden"],
    "Mediterranean Europe": ["Croatia", "Greece", "Italy", "Portugal", "Spain"],
    "East & southeast Europe": ["Bulgaria", "Romania", "Turkey", "Ukraine"],
}
expected = {p.stem for p in (DATA / "cells").glob("*.json")}
assigned = {country for countries in GROUPS.values() for country in countries}
if expected != assigned:
    raise ValueError(f"Region groups must cover each archive country once. Missing={expected-assigned}; extra={assigned-expected}")

period = [(year, month) for year in range(FIRST, LAST + 1) for month in range(1, 13)]
labels = [f"{year}-{month:02d}" for year, month in period]
results = {}
series = {}

def mae(actual, estimate):
    return sum(abs(a-b) for a, b in zip(actual, estimate)) / len(actual)

def r_squared(actual, estimate):
    mean = sum(actual) / len(actual)
    total = sum((a-mean)**2 for a in actual)
    return 1 - sum((a-e)**2 for a, e in zip(actual, estimate)) / total if total else None

for name, countries in GROUPS.items():
    monthly = {key: [0.0, 0.0] for key in period}
    for country in countries:
        rows = json.loads((DATA / "cells" / f"{country}.json").read_text())
        for row in rows:
            key = (int(row[2]), int(row[3]))
            if key in monthly:
                monthly[key][0] += float(row[4])
                monthly[key][1] += float(row[5])
    modis = [monthly[key][0] for key in period]
    viirs = [monthly[key][1] for key in period]
    estimate = [count * RATIO for count in modis]
    actual_total = sum(viirs)
    results[name] = {
        "countries": countries,
        "period": f"{FIRST}-{LAST}",
        "n_calendar_months": len(period),
        "ratio": RATIO,
        "actual_viirs_total": int(actual_total),
        "raw_modis_total": int(sum(modis)),
        "fixed_ratio_estimate_total": round(sum(estimate), 2),
        "raw_modis_mae_per_month": round(mae(viirs, modis), 2),
        "fixed_ratio_mae_per_month": round(mae(viirs, estimate), 2),
        "raw_modis_r2_monthly": round(r_squared(viirs, modis), 3) if r_squared(viirs, modis) is not None else None,
        "fixed_ratio_r2_monthly": round(r_squared(viirs, estimate), 3) if r_squared(viirs, estimate) is not None else None,
        "fixed_ratio_total_bias_percent": round((sum(estimate) / actual_total - 1) * 100, 1) if actual_total else None,
    }
    series[name] = {"modis": modis, "viirs": viirs, "estimate": estimate}

# Self-contained multi-panel SVG: common time axis, independent y scales per region.
WIDTH, HEIGHT = 1200, 900
LEFT, RIGHT = 92, 30
PANEL_TOP, PANEL_HEIGHT, GAP = 112, 222, 50
COLORS = {"viirs": "#167e79", "modis": "#c65b22", "estimate": "#273746"}
parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-labelledby="title desc">',
         '<title id="title">Held-out fire detection comparison in three European regions</title>',
         '<desc id="desc">Monthly VIIRS observations, raw MODIS, and MODIS multiplied by the fixed ratio for 2022 to 2025.</desc>',
         '<rect width="100%" height="100%" fill="#fff"/>',
         '<style>text{font-family:Arial,sans-serif;fill:#17212b}.muted{fill:#52616d}.grid{stroke:#dce2e5;stroke-width:1}.line{fill:none;stroke-width:2.5}</style>',
         f'<text x="{LEFT}" y="34" font-size="24" font-weight="700">Held-out regional comparison · {FIRST}–{LAST}</text>',
         f'<text x="{LEFT}" y="60" font-size="14" class="muted">Fixed ratio {RATIO:.3f}, fit on Europe-wide 2012–2021 totals · complete calendar months</text>']
legend_y = 84
for x0, key, label in [(LEFT, "viirs", "Observed VIIRS S-NPP"), (LEFT+230, "modis", "Raw MODIS"), (LEFT+400, "estimate", f"MODIS × {RATIO:.3f}")]:
    parts.append(f'<line x1="{x0}" y1="{legend_y}" x2="{x0+28}" y2="{legend_y}" stroke="{COLORS[key]}" stroke-width="3"/><text x="{x0+35}" y="{legend_y+5}" font-size="13">{html.escape(label)}</text>')

for i, (name, _) in enumerate(GROUPS.items()):
    top = PANEL_TOP + i * (PANEL_HEIGHT + GAP)
    bottom = top + PANEL_HEIGHT - 38
    x1, x2 = LEFT, WIDTH - RIGHT
    values = series[name]
    max_value = max([*values["modis"], *values["viirs"], *values["estimate"], 1])
    max_value *= 1.08
    result = results[name]
    title = f"{name} · ratio MAE {result['fixed_ratio_mae_per_month']:.1f}/month · total bias {result['fixed_ratio_total_bias_percent']:+.1f}%"
    parts.append(f'<text x="{x1}" y="{top-18}" font-size="17" font-weight="700">{html.escape(title)}</text>')
    for tick in range(4):
        y = bottom - (bottom-top) * tick / 3
        value = max_value * tick / 3
        parts.append(f'<line class="grid" x1="{x1}" y1="{y:.1f}" x2="{x2}" y2="{y:.1f}"/><text x="{x1-10}" y="{y+4:.1f}" text-anchor="end" font-size="11" class="muted">{value:.0f}</text>')
    for j in range(0, len(period), 6):
        x = x1 + (x2-x1) * j / (len(period)-1)
        parts.append(f'<text x="{x:.1f}" y="{bottom+20}" text-anchor="middle" font-size="10" class="muted">{labels[j]}</text>')
    for key in ("viirs", "modis", "estimate"):
        coords = []
        for j, value in enumerate(values[key]):
            px = x1 + (x2-x1) * j / (len(period)-1)
            py = bottom - (bottom-top) * value / max_value
            coords.append(f'{px:.1f},{py:.1f}')
        parts.append(f'<polyline class="line" stroke="{COLORS[key]}" points="{" ".join(coords)}"/>')
parts.append(f'<text x="{LEFT}" y="{HEIGHT-12}" font-size="12" class="muted">Absent sparse grid-month rows count as zero filtered detections; this tests aggregate detection-count agreement, not fire-event identity.</text>')
parts.append('</svg>')

Path("docs/validation-three-regions.svg").write_text("\n".join(parts) + "\n")
Path("docs/validation-three-regions.json").write_text(json.dumps({"training_years": REPORT["train_years"], "test_years": REPORT["test_years"], "method": "MODIS monthly detections × fixed Europe-wide ratio", "regions": results}, indent=2) + "\n")
print("docs/validation-three-regions.svg")
print("docs/validation-three-regions.json")
print(json.dumps(results, indent=2))
