# Implementation Blueprint: Fire Calendar

NASA Space Apps 2026 · Cottbus · Challenge: Harmonization of MODIS and VIIRS Hot Spots
Written Saturday 14 November 2026, 14:00 CET, for a team of two: one AI engineer, one software and app engineer.

**The plan in one paragraph.** The AI engineer builds an offline Python pipeline that downloads NASA fire records, trains a model that makes the two satellites comparable, and exports one small data file. The software engineer builds a static web app that reads that file, lets the user draw a region and shows the fire calendar. There is no backend server. That removes the part most likely to fail during judging and is what makes this doable for two people.

> **What is tested and what is not.** The data URLs in section 1 were checked today and work. The pipeline in `pipeline/01_download.py` and `pipeline/02_harmonize.py` was run end to end on real data on Saturday at 14:30; use those files, not the Python samples below, which are an earlier untested draft. The web app samples have not been run. Numeric choices such as grid size and thresholds are our own defaults, not NASA requirements.

## Tested results (Saturday 14:30)

Four countries, trained on 2012 to 2021, tested on 2022 to 2025.

| Check on held-out years | Uncorrected MODIS | Simple ratio | Model |
|---|---|---|---|
| Per cell and month, mean absolute error (cells where MODIS saw fire) | n/a | 6.63 | 5.34 |
| Per region and month, R² (cells where MODIS saw fire) | n/a | 0.940 | 0.969 |
| Per region and month, R² (all cells) | 0.549 | 0.964 | 0.841 |

- **The correction works.** For regional monthly totals the fit rises from 0.55 uncorrected to 0.96 with a simple ratio.
- **The model beats the ratio where MODIS saw fire.** It predicts the VIIRS-to-MODIS ratio per cell and month.
- **The model is currently worse than the ratio for whole regions.** About a quarter of VIIRS detections fall in cell-months where MODIS saw nothing, and the constant we use to add them back is too crude. This is the AI engineer's first task. If it is not fixed by Saturday evening, ship the simple ratio for regional totals and present the model as the per-cell refinement.
- **Do not use a Poisson count model.** The draft in step A4 below was tried and was far worse than the baseline (R² below zero).
- **Filtering matters.** 41% of raw VIIRS rows are static heat sources such as industry (`type` 2), not vegetation fires.
- **The ratio drifts by year,** from about 2.7 to 4.4. State this as a limit.

## Going deeper (after the core app works)

The core app is simple on purpose. These seven steps go deeper into the challenge, in order of value. Do them only once the core app runs on the public link.

| Step | What to build | Why it helps | Who |
|---|---|---|---|
| 1. Recover missed fires | A second model that estimates the chance of unseen fire in a cell-month where MODIS saw nothing, from neighbouring cells, season and local history | Fixes the weak regional number and gives the pitch a headline | AI |
| 2. Show uncertainty | Low and high estimates per value with `HistGradientBoostingRegressor(loss="quantile")`, drawn as a range | Honest science, helps Validity | AI |
| 3. Use the physics | Add the `scan` and `track` columns (pixel size, which grows at the edge of the view) and heat output as inputs | A real improvement we can explain | AI |
| 4. Find something new | Test whether the fire season has moved or lengthened over 25 years in a region | A finding that needs the joined record | Both |
| 5. Harmonize intensity | The same correction for fire radiative power (`frp`) | Goes past counting, helps Creativity | AI |
| 6. Go live | Daily pull from the FIRMS feed and an "abnormal right now" flag | Makes the demo current, helps Impact | Software |
| 7. Cover every country | Run the pipeline for all countries and load data per country in the app | Shows a general tool | Software |

**Why Germany, Portugal, Greece and Spain.** Our own choice for the first test, not a NASA requirement. Germany is the local story but has too few detections to train on alone. The other three are among the most fire-affected countries in Europe and supply enough examples. Adding Italy and France is one line in `pipeline/01_download.py`. A model trained mostly on Mediterranean fires may fit Germany less well, so check Germany's accuracy separately.

## Six more points from the challenge text, now in the plan

Mentioned in the challenge and previously undecided. All are possible. They come after the core app, in this order.

| Point in the challenge | What we will do | Effort | If time runs out |
|---|---|---|---|
| Audience: responders, scientists, land managers, firefighters | Main user is fire services and forest managers. A plain-language findings panel for them, a method page for scientists. | Small | Do it anyway |
| Fire intensity | Sum `frp` per cell and month for both sensors, correct it the same way, add a count / intensity switch | Small to medium | State that we count detections only |
| CSV of the hotspots detected | History downloads as monthly counts. For the last days, list and download single detections from the FIRMS daily feed. | Medium, needs the free key | Counts only, labelled clearly |
| "VIIRS sensors", more than one | No yearly country files exist for NOAA-20 and NOAA-21, but the daily feed has them. Use them for the current year. | Small once the feed works | State that the history uses S-NPP only |
| Wildfires and agricultural burns | Label each cell as mostly farmland or mostly forest from a public land-cover map, add a filter | Medium to large, new dataset | State that both are counted together |
| Any area of interest in the world | Stage 1: about ten major fire countries on other continents. Stage 2: every country. The pipeline must process one country at a time first. | Large, mostly download time | State that the demo covers Europe |

**Three more points found on a full re-read of the challenge:**

| Words in the challenge | What we will do | Effort |
|---|---|---|
| "Seasonal patterns, anomalies, and trends" | Trend view per region: yearly totals, trend line, Mann-Kendall test. Only on the corrected record. | Small |
| An "updated and consistent" calendar | Scheduled daily job (GitHub Action) pulls the FIRMS daily feed and republishes the data | Small once the feed works |
| "Monitor sensitive regions" | Region and date range stored in the page link, so a saved link reopens the same view | Small |

Left out on purpose: fire forecasting and burned-area mapping. Each is a separate project and needs other data.

**Two more points from the challenge text:**

| Words in the challenge | What we will do | Effort |
|---|---|---|
| Sensors differ in "observation schedules" | Test the correction using only Aqua (afternoon pass, like S-NPP) and report whether it changes the result | Small |
| Number of fires detected "and reported" | Compare yearly totals with official fire statistics for a few European countries. "Reported" meaning official statistics is our reading. | Small to medium |
| Download "analytics and visualizations" | CSV for the numbers, plus the calendar and charts as images (ECharts `getDataURL`) | Small |
| Changes in fire "intensity, extent, and frequency" (background) | Extent: map squares burning per month. Frequency: in how many of the 25 years each square burned, as a map layer. | Small |
| Submission form | Choose the project name and a one-sentence tagline | Small |

The first four are cheap and close real gaps. Fire types and the world go last. None of them comes before a working app on a public link.

## Contents

1. [Setup and resources](#1-setup-and-resources)
2. [Architecture and stack](#2-architecture-and-stack)
3. [Step-by-step development](#3-step-by-step-development)
4. [ML and scientific accuracy](#4-ml-and-scientific-accuracy)
5. [Frontend and user experience](#5-frontend-and-user-experience)
6. [Testing and deployment](#6-testing-and-deployment)
7. [Submission requirements](#7-submission-requirements)
8. [Hour-by-hour plan for two people](#8-hour-by-hour-plan-for-two-people)

---

## 1. Setup and resources

### Official pages to read first (20 minutes, both of you)

| Page | URL | What to take from it |
|---|---|---|
| The challenge | https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/ | The exact wording of the objectives. Our project page must answer them point by point. |
| FIRMS overview | https://www.earthdata.nasa.gov/data/tools/firms | What a hotspot is, the two sensors, how to cite the data. |
| Judging & Awards Guide | https://www.spaceappschallenge.org/resources/judging-awards-guide/ | The five criteria and the 1-to-5 scale. |
| Project Submission Guide | https://www.spaceappschallenge.org/resources/project-submission-guide/ | Required fields and demo limits. |

### Data sources

| Source | URL | Login | Status |
|---|---|---|---|
| Yearly files per country | https://firms.modaps.eosdis.nasa.gov/country/ | None | Checked, works |
| Live feed API (last days) | https://firms.modaps.eosdis.nasa.gov/api/area/ | Free key | Endpoint exists, not tested with a key |
| Free key request | https://firms.modaps.eosdis.nasa.gov/api/map_key/ | Email address | Not tested |

Direct file pattern, checked today:

```
https://firms.modaps.eosdis.nasa.gov/data/country/modis/{YEAR}/modis_{YEAR}_{Country}.csv
https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/{YEAR}/viirs-snpp_{YEAR}_{Country}.csv
```

- MODIS files exist from 2000 to 2025.
- VIIRS S-NPP files exist from 2012 to 2025.
- There are no country files for the NOAA-20 satellite. Do not plan on it.
- Files are small. Portugal is 0.1 to 1.5 MB per year. Four countries over all years is well under 200 MB.
- Checked country names: `Germany`, `Portugal`, `Greece`, `Spain`.

Columns in the files:

| Column | MODIS | VIIRS | Use |
|---|---|---|---|
| `latitude`, `longitude` | yes | yes | Position |
| `acq_date`, `acq_time` | yes | yes | Date and UTC time |
| `satellite` | `Terra` or `Aqua` | `N` | Which satellite |
| `confidence` | number 0 to 100 | `l`, `n` or `h` | Quality filter |
| `frp` | yes | yes | Fire radiative power, a measure of intensity |
| `daynight` | `D` or `N` | `D` or `N` | Day or night pass |
| `type` | 0 to 3 | 0 to 3 | 0 is a presumed vegetation fire. Other values are volcanoes, static sources such as industry, and offshore. |

### Accounts to create now

| Account | URL | Who | Needed for |
|---|---|---|---|
| FIRMS map key | https://firms.modaps.eosdis.nasa.gov/api/map_key/ | AI engineer | Optional live alert only |
| Vercel | https://vercel.com/signup | Software engineer | Hosting the web app |
| GitHub | already have | Both | Code and, optionally, the scheduled data refresh |

No Earthdata login is needed for the MVP.

---

## 2. Architecture and stack

```
          OFFLINE (AI engineer, Python)                    ONLINE (software engineer)

 FIRMS country CSVs                                  Static web app on Vercel
        |                                                     |
   01_download.py                                     loads cells.json once
        |                                                     |
   02_build_cells.py  -> cells.parquet               user draws a region
        |                                                     |
   03_train.py        -> model + report.json         filter cells inside it (in the browser)
        |                                                     |
   04_export.py       -> cells.json, report.json     calendar, season curve, anomaly badge,
        |                  validation.png             raw-vs-harmonized toggle, CSV export
        +---- copied into web/public/data/ ----------------->+

 Optional: GitHub Action, once a day
   FIRMS live API (key kept in GitHub Secrets) -> recent.json -> committed -> Vercel redeploys
```

| Part | Choice | Docs | Why it suits this hackathon |
|---|---|---|---|
| Data pipeline | Python 3.11, pandas | https://pandas.pydata.org/docs/ | The data is plain CSV |
| Model | scikit-learn `HistGradientBoostingRegressor` | https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html | Trains in seconds, no tuning needed, handles counts |
| Web app | Vite with React and TypeScript | https://vite.dev/guide/ | Fast to start, static output |
| Map | MapLibre GL JS | https://maplibre.org/maplibre-gl-js/docs/ | Free, no token |
| Basemap | OpenFreeMap style `https://tiles.openfreemap.org/styles/liberty` | https://openfreemap.org/ | Free, no key, checked reachable |
| Drawing | mapbox-gl-draw | https://github.com/mapbox/mapbox-gl-draw | Polygon drawing that works with MapLibre |
| Region filter | Turf.js | https://turfjs.org/docs/ | Point-in-polygon in the browser |
| Charts | Apache ECharts | https://echarts.apache.org/examples/en/index.html#chart-type-heatmap | Heatmap built in |
| Hosting | Vercel | https://vercel.com/docs | Free, public URL, deploys on every push |

**Why no backend.** Free backend hosts sleep when idle and take up to a minute to wake. A judge who opens a sleeping app sees a blank page. The harmonized data is small enough to ship as one file, so the browser can do all filtering.

**Mobile.** Build the web app responsive and phone-first. Judges need a public link, and a native app cannot be opened from a link.

---

## 3. Step-by-step development

> **Note.** The Python samples in the AI engineer steps are the first untested drafts. The working code is in `pipeline/`. The data now covers 16 countries, loaded per country, with ten values per row (see `README.md`).

### AI engineer

#### A1. Download the data (30 min)

- **Build:** a script that fetches every year for four countries and both sensors.
- **Why:** everything else depends on it.
- **Done when:** `data/raw/` holds about 160 CSV files and the script prints a row count per file.
- **Watch for:** occasional timeouts. The script skips files that already exist, so rerun it.

```python
# pipeline/01_download.py
import pathlib, requests

BASE = "https://firms.modaps.eosdis.nasa.gov/data/country"
COUNTRIES = ["Germany", "Portugal", "Greece", "Spain"]
SOURCES = {"modis": range(2001, 2026), "viirs-snpp": range(2012, 2026)}
out = pathlib.Path("data/raw"); out.mkdir(parents=True, exist_ok=True)

for src, years in SOURCES.items():
    for year in years:
        for c in COUNTRIES:
            f = out / f"{src}_{year}_{c}.csv"
            if f.exists():
                continue
            r = requests.get(f"{BASE}/{src}/{year}/{src}_{year}_{c}.csv", timeout=60)
            if r.ok and r.text.startswith("latitude"):
                f.write_text(r.text)
                print("ok  ", f.name, r.text.count("\n") - 1, "rows")
            else:
                print("MISS", f.name, r.status_code)
```

#### A2. First plot: prove the problem exists (30 min)

- **Build:** one chart of yearly detections for Portugal, MODIS against VIIRS.
- **Why:** it shows the mismatch between sensors. It becomes slide 2 of the pitch.
- **Done when:** the chart is saved as `web/public/data/problem.png`.

#### A3. Build the cell table (90 min)

- **Build:** filter the records, snap them to a 0.25° grid, and count per cell and month.
- **Why:** counting on a shared grid removes most of the difference in pixel size between sensors.
- **Done when:** `data/cells.parquet` exists with one row per cell and month.
- **Watch for:** the `confidence` column has different types in the two sensors. Handle them separately.

```python
# pipeline/02_build_cells.py
import glob, numpy as np, pandas as pd

GRID = 0.25

def load(pattern, sensor):
    df = pd.concat((pd.read_csv(f) for f in glob.glob(pattern)), ignore_index=True)
    df = df[df["type"] == 0]                                  # vegetation fires only
    if sensor == "modis":
        df = df[df["confidence"] >= 30]                       # drop low confidence
    else:
        df = df[df["confidence"].isin(["n", "h"])]
    d = pd.to_datetime(df["acq_date"])
    df["year"], df["month"] = d.dt.year, d.dt.month
    df["clat"] = np.floor(df["latitude"] / GRID) * GRID + GRID / 2
    df["clon"] = np.floor(df["longitude"] / GRID) * GRID + GRID / 2
    return df

keys = ["clat", "clon", "year", "month"]
m = load("data/raw/modis_*.csv", "modis")
v = load("data/raw/viirs-snpp_*.csv", "viirs")

modis = m.groupby(keys).agg(
    m_n=("frp", "size"),
    m_frp=("frp", "sum"),
    m_aqua=("satellite", lambda s: (s == "Aqua").sum()),
    m_day=("daynight", lambda s: (s == "D").sum()),
    m_days=("acq_date", "nunique"),
).reset_index()
viirs = v.groupby(keys).agg(v_n=("frp", "size")).reset_index()

cells = modis.merge(viirs, on=keys, how="outer").fillna(0)
cells.to_parquet("data/cells.parquet")
print(cells.describe())
```

#### A4. Train and validate the model (2 h)

- **Build:** a model that predicts the VIIRS count for a cell-month from what MODIS saw.
- **Why:** this is the harmonization the challenge asks for, and the validation number is our evidence for the Validity score.
- **Done when:** `report.json` holds the error of the model and of a simple baseline on held-out years, and `validation.png` shows predicted against actual.
- **Watch for:** if the model does not beat the baseline, keep the baseline and say so. A measured simple method still scores better than an unmeasured complex one.

```python
# pipeline/03_train.py
import json, numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

c = pd.read_parquet("data/cells.parquet")
ov = c[(c.year >= 2012) & (c.m_n > 0)]            # years with both sensors, MODIS saw something
X = ["m_n", "m_frp", "m_aqua", "m_day", "m_days", "month", "clat", "clon"]
train, test = ov[ov.year <= 2021], ov[ov.year >= 2022]

model = HistGradientBoostingRegressor(loss="poisson", max_iter=300, learning_rate=0.05)
model.fit(train[X], train.v_n)
pred = model.predict(test[X])

ratio = train.v_n.sum() / train.m_n.sum()          # baseline: one fixed multiplier
base = test.m_n * ratio

report = {
    "train_years": "2012-2021", "test_years": "2022-2025",
    "model_mae": float(mean_absolute_error(test.v_n, pred)),
    "baseline_mae": float(mean_absolute_error(test.v_n, base)),
    "model_r2": float(r2_score(test.v_n, pred)),
    "baseline_r2": float(r2_score(test.v_n, base)),
    "baseline_ratio": float(ratio),
}
json.dump(report, open("data/report.json", "w"), indent=2)
print(report)

# regional check: sum per country-sized block and year, compare predicted vs actual
```

#### A5. Export for the web app (45 min)

- **Build:** apply the model to 2001 to 2011, use real VIIRS from 2012, and write a compact file.
- **Why:** this file is the contract between the two of you.
- **Done when:** `cells.json` is under about 3 MB and loads in the browser.

```python
# pipeline/04_export.py  (runs after 03, reuses `model`, `X`, `c`)
c["harmonized"] = np.where(c.year >= 2012, c.v_n,
                           np.where(c.m_n > 0, model.predict(c[X]), 0))
out = c[["clat", "clon", "year", "month", "m_n", "v_n", "harmonized"]].round(2)
out.to_json("web/public/data/cells.json", orient="values")   # array of arrays, smallest form
```

File format agreed between both engineers. Each row is:

```
[cell_lat, cell_lon, year, month, modis_raw, viirs_raw, harmonized]
```

`viirs_raw` is 0 before 2012 because the sensor did not exist. The app must show that as "no data", not as "no fire".

#### A6. Optional: live alert (90 min, only after the MVP works)

Request for the last days in a bounding box (west, south, east, north):

```
https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/-10,35,30,56/5
```

Run it once a day from a GitHub Action with the key stored in GitHub Secrets, write `recent.json`, and commit it. Never put the key in the web app.

### Software engineer

#### S1. Scaffold and deploy an empty app (45 min)

- **Build:** a Vite app with a full-screen map, pushed to GitHub and live on Vercel.
- **Why:** deploying first means the public URL exists all weekend and every push is tested for real.
- **Done when:** the Vercel URL shows a map on a phone.

```bash
npm create vite@latest web -- --template react-ts
cd web
npm i maplibre-gl @mapbox/mapbox-gl-draw @turf/turf echarts
npm run dev
```

On https://vercel.com/new import the GitHub repository and set the root directory to `web`.

#### S2. Mock data and the calendar (2 h)

- **Build:** a fake `cells.json` in the agreed format and the year-by-month heatmap.
- **Why:** you do not wait for the pipeline. Swapping in the real file later is one line.
- **Done when:** the heatmap renders years as rows and months as columns.

```ts
// calendar option for ECharts; data = [monthIndex, yearIndex, value]
const option = {
  tooltip: {},
  grid: { left: 48, right: 16, top: 16, bottom: 56 },
  xAxis: { type: "category", data: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] },
  yAxis: { type: "category", data: years.map(String), inverse: true },
  visualMap: { min: 0, max: maxValue, calculable: true, orient: "horizontal", left: "center", bottom: 0,
               inRange: { color: ["#fff7ec", "#fdbb84", "#e34a33", "#7f0000"] } },
  series: [{ type: "heatmap", data }],
};
```

#### S3. Draw a region and filter (2 h)

- **Build:** polygon drawing on the map, then keep the cells whose centre is inside.
- **Why:** this is the main interaction the challenge describes.
- **Done when:** drawing a polygon updates the calendar in under a second.
- **Watch for:** mapbox-gl-draw expects Mapbox class names. If the buttons look unstyled, import its CSS and check the README section on MapLibre.

```ts
import * as turf from "@turf/turf";

function aggregate(rows: number[][], polygon: GeoJSON.Feature<GeoJSON.Polygon>, field: 4 | 6) {
  const grid = new Map<string, number>();            // "year-month" -> sum
  for (const r of rows) {
    if (!turf.booleanPointInPolygon([r[1], r[0]], polygon)) continue;
    const k = `${r[2]}-${r[3]}`;
    grid.set(k, (grid.get(k) ?? 0) + r[field]);
  }
  return grid;
}
```

Also add two fallbacks that need no drawing: preset regions (Brandenburg, central Portugal, Attica) and a latitude and longitude box.

#### S4. Insight panel (90 min)

- **Build:** the anomaly badge, the season curve and the ranking of years.
- **Why:** these turn a picture into a decision. They carry the Impact and Creativity scores.
- **Done when:** selecting a month shows "more active than N% of past years for this month".

```ts
function percentile(history: number[], value: number) {
  return Math.round((history.filter(v => v <= value).length / history.length) * 100);
}
```

#### S5. Raw-versus-harmonized toggle and CSV export (60 min)

- **Build:** a switch between the raw MODIS series and the harmonized series, and a button that saves the current table as CSV.
- **Why:** the toggle makes the harmonization visible. The CSV is asked for in the challenge.
- **Done when:** flipping the toggle visibly changes the years before 2012.

#### S6. Method page (45 min)

- **Build:** a short page inside the app showing `problem.png`, `validation.png` and the numbers from `report.json`.
- **Why:** judges can check our evidence without leaving the app.

---

## 4. ML and scientific accuracy

**What the model does.** For each grid cell and month it estimates how many detections the newer sensor would have recorded, from what the older sensor recorded. It learns this from the 14 years when both sensors observed the same fires.

**Why this is a real use of ML.** The relationship is not one fixed multiplier. It depends on fire intensity, season, latitude and time of day. A simple ratio is the baseline, and the model has to beat it on years it never saw.

**Rules that keep us honest:**

1. **Split by time, not at random.** Train on 2012 to 2021, test on 2022 to 2025. A random split leaks information and overstates accuracy.
2. **Always report the baseline next to the model.**
3. **Label modelled values.** Everything before 2012 is an estimate. Mark it in the calendar with a different border or a note.
4. **Say what cannot be recovered.** Small fires the older sensor never detected stay invisible before 2012. The model can scale what was seen. It cannot invent what was missed.
5. **Call them detections, not fires.** One fire produces many detections, and clouds hide some.
6. **Mention Terra.** Its overpass time differs from the other two satellites, so the model gets the Aqua share as an input.
7. **Do not present the anomaly as a forecast.** It compares now with history. It does not predict.

---

## 5. Frontend and user experience

### Screens

| Screen | Content |
|---|---|
| Main | Map on top, calendar and insight panel below. On a wide screen they sit side by side. |
| Method | The problem chart, the validation chart, the numbers and the limits. |
| About | Team, challenge name, data credits. |

### User journey

1. The app opens on Brandenburg with a calendar already showing. No empty screen.
2. The user draws their own region or picks a preset.
3. The calendar updates. A badge states how the latest month compares with history.
4. The user flips the toggle and sees the pre-2012 years change.
5. The user downloads the CSV.

### Must-have and optional

| Feature | Status | Criterion it serves |
|---|---|---|
| Calendar heatmap for a region | Must | Relevance |
| Draw region, presets, lat/lon box | Must | Relevance, Validity |
| Harmonized series from the model | Must | Relevance, Validity |
| Raw-versus-harmonized toggle | Must | Validity, Presentation |
| Anomaly badge | Must | Impact, Creativity |
| CSV export | Must | Relevance |
| Method page with validation | Must | Validity |
| Season curve and year ranking | Should | Impact |
| Live alert from the daily feed | Optional | Creativity |
| Hotspot points on the map | Optional | Presentation |
| Installable phone app (PWA) | Optional | Presentation |

### Making it land in a demo

- Use one colour ramp from pale to dark red and keep it identical everywhere.
- Put one sentence above the calendar that states the finding in words.
- Open with a real region and a real bad year, not a blank map.
- Make the toggle large. It is the moment the harmonization becomes visible.

---

## 6. Testing and deployment

### Test each part alone

| Part | Check |
|---|---|
| Download | File count is as expected and no file is empty |
| Cell table | Total detections after gridding equal the filtered row count |
| Model | Beats the baseline on test years. If not, ship the baseline. |
| Export | `cells.json` parses and has seven values per row |
| Region filter | A box around Portugal returns a peak in summer 2017 |
| Calendar | Years and months are in the right order and December is not cut off |

### End-to-end checks before submitting

- Open the public URL in a private browser window.
- Open it on a phone.
- Open it on a second network, for example mobile data.
- Draw a region with no fires. The app must say "no detections", not crash.

### Failure handling

- **Data file fails to load:** show a clear message and a retry button.
- **Empty region:** show a friendly empty state.
- **Slow filter:** precompute the list of unique cells once and test those against the polygon, then sum rows by cell.
- **Live feed fails:** the app does not depend on it. Hide the live badge.

### Deployment

1. Push the repository to GitHub.
2. Go to https://vercel.com/new and import it.
3. Set the root directory to `web`. Leave the build settings on the Vite defaults.
4. Every push to `main` redeploys automatically.

---

## 7. Submission requirements

Official guides:

- https://www.spaceappschallenge.org/resources/project-submission-guide/
- https://www.spaceappschallenge.org/resources/judging-awards-guide/

### What to prepare

| Item | What goes in |
|---|---|
| Project name | Short and descriptive |
| High-level summary | What we built, how it answers the challenge, why it matters. Write this first. |
| Link to project demo | A video of 30 seconds or less, or at most seven slides. Hosted publicly. |
| Link to final project | The Vercel URL, with the GitHub repository linked from the page |
| Detailed description | What it does, how it works, the method, the validation numbers, the limits |
| Use of AI | Which AI tools we used for coding, text or images, and for what |
| NASA data | FIRMS MODIS and VIIRS S-NPP active fire data, with links and how each is used |
| Other data | Basemap and any boundary data, with licences |
| References | Every library, dataset, image and code snippet we did not write |

Structure the detailed description with one heading per judging criterion: Impact, Creativity, Validity, Relevance. Judges score from this page.

### Commonly overlooked

- The demo limit is hard. A 31-second video makes the project ineligible for global judging.
- Every link must open without a login. Check sharing settings on videos and drives.
- Everything must be in English.
- Every team member must be registered for Cottbus and appear on the team's Members tab before submission closes.
- AI tool use must be described.
- Cottbus has a local deadline at Sunday 16:00. NASA's deadline is Sunday 23:59.
- Make the GitHub repository public before submitting.

### Demo video outline (29 seconds)

| Seconds | Content |
|---|---|
| 0–5 | Team name, challenge, project name and tagline |
| 5–10 | The problem: two satellites, numbers that do not match |
| 10–22 | Screen recording: draw a region, calendar appears, flip the toggle, anomaly badge |
| 22–29 | The validation number and who this helps |

### Live pitch (two minutes, in case the ceremony has one)

1. A Brandenburg forest fire and the question "is this normal?"
2. Why nobody can answer it today.
3. Live demo.
4. The validation chart.
5. What comes next.

---

## 8. Hour-by-hour plan for two people

> **Out of date.** The team has five people. The current roadmap is in `index.html`. This section is kept for the task dependencies only.

From Saturday 14:00 to the local deadline on Sunday 16:00. The venue is closed from Saturday 23:00 to Sunday 09:00.

| Time | AI engineer | Software engineer |
|---|---|---|
| Sat 14:00–14:30 | Both: read the challenge page, agree the `cells.json` format | |
| Sat 14:30–15:30 | A1 download, A2 problem chart | S1 scaffold, deploy empty app |
| Sat 15:30–17:30 | A3 cell table | S2 mock data and calendar |
| Sat 17:30–19:30 | A4 train and validate | S3 draw region and filter |
| Sat 19:30–20:00 | Both: eat, check progress, cut scope if behind | |
| Sat 20:00–21:00 | A5 export real `cells.json` | S3 finish, presets and lat/lon box |
| Sat 21:00–23:00 | Both: plug real data into the app. **First full run on the public URL.** | |
| Overnight | Sleep. Optional from home: validation chart, method text | Sleep. Optional from home: S4 insight panel |
| Sun 09:00–11:00 | Method text, limits, validation chart | S4 insight panel, S5 toggle and CSV |
| Sun 11:00–12:00 | A6 live alert, only if everything else works | S6 method page, phone layout |
| **Sun 12:00** | **Feature freeze. Bug fixes only from here.** | |
| Sun 12:00–14:00 | Write the project page: summary, method, NASA data, AI use, references | Record the video, take screenshots, fix bugs |
| Sun 14:00–15:00 | Both: review the page against the five criteria, test all links in a private window | |
| Sun 15:00–15:30 | Both: submit on the NASA site | |
| Sun 15:30–16:00 | Buffer, rehearse the two-minute pitch | |

### Dependencies

- **A5 blocks real data in the app.** Until then the software engineer works on mock data in the same format, so nobody waits.
- **A4 blocks the method page and the pitch number.**
- **S1 blocks nothing and must happen first,** so the public URL exists from the start.
- Everything else runs in parallel.

### If we fall behind

Cut in this order: live alert, hotspot points on the map, season curve, drawing (keep presets and the lat/lon box). Never cut the validation chart, the toggle or the project page.

### Start now

1. AI engineer: run `01_download.py`.
2. Software engineer: run `npm create vite@latest`, push, import into Vercel.
3. Both: write the `cells.json` format into the repository README so it cannot drift.
