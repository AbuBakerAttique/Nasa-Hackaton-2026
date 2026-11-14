# Fire Calendar

NASA Space Apps Challenge 2026 · Cottbus · Challenge: [Harmonization of MODIS and VIIRS Hot Spots](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/)

25 years of satellite fire history as one consistent record, shown as a calendar for any region.

NASA has tracked fires from space since 2000 with two generations of sensor that cannot be compared directly. This project makes the two records comparable, measures how well that works, and shows the result in a web app.

Open `index.html` in a browser for the project board: problem, solution, remaining steps and roadmap.

## Project structure

```
.
├── README.md             this file
├── index.html            project board: problem, solution, checklist, roadmap, results
├── requirements.txt      Python libraries for the pipeline
├── CLAUDE.md             rules for AI coding tools in this repo
├── assets/
│   └── team-logo.png
├── docs/
│   ├── implementation-blueprint.md   how to build, test and submit
│   ├── local-winning-strategy.md     judging criteria and strategy for the Cottbus event
│   ├── space-apps-winner-study.md    what the 2025 global winners did
│   └── cottbus-challenge-playbook.md first comparison of challenges
├── pipeline/
│   ├── 01_download.py    downloads NASA fire files into data/raw/
│   └── 02_harmonize.py   builds the grid table, trains and checks the model, exports results
├── data/                 NOT in git, created by the pipeline
│   ├── raw/              NASA files, one per sensor, year and country
│   └── out/              cells.json, report.json, problem.png, validation.png
├── web/                  the web app (not created yet)
└── venv/                 NOT in git, local Python environment
```

## Run the pipeline

```bash
python3 -m venv venv
venv/bin/pip install -r requirements.txt
venv/bin/python pipeline/01_download.py     # about a minute, skips files already present
venv/bin/python pipeline/02_harmonize.py    # writes data/out/
```

The `data/` folder is ignored by git, so every team member runs these two commands once to get the data.

## Data format for the web app

`data/out/cells.json` is an array of rows. Each row is one 0.25° map square in one month:

```
[cell_lat, cell_lon, year, month, modis_raw, viirs_raw, harmonized, modis_frp, viirs_frp, harmonized_frp]
```

The last three values are fire intensity: the heat output (fire radiative power, in megawatts) of all detections added up. The intensity correction is experimental; see `report.json`.

The prototype in `index.html` reads its own smaller files from `assets/proto/`. Rebuild them with `venv/bin/python pipeline/03_build_prototype_data.py` after rerunning the pipeline.

- `modis_raw`: detections from the older sensor after filtering.
- `viirs_raw`: detections from the newer sensor. It is 0 before 2012 because the sensor did not exist. Show that as "no data", not "no fire".
- `harmonized`: the corrected value. From 2012 it equals `viirs_raw`. Before 2012 it is the model's estimate.

The pipeline covers 16 European countries, so `cells.json` is about 17 MB. That is too large to load in one go. The same rows are also written per country to `data/out/cells/{Country}.json` (Germany is about 1 MB). The web app should load only the country it needs.

Because `data/` is not in git, the web app needs its own copy. Once `web/` exists, copy `data/out/cells/` to `web/public/data/cells/` and commit that copy, or the deployed site will have no data.

## Current result

`data/out/report.json` holds the accuracy numbers on held-out years (2022 to 2025). At the moment the best method for regional totals is one fixed ratio for all countries, and that is what the export uses. The machine-learning model is reported for comparison and is not yet better.

## Data source

NASA FIRMS active fire data, MODIS and VIIRS S-NPP: https://www.earthdata.nasa.gov/data/tools/firms
