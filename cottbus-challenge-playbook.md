# Cottbus Challenge Playbook

NASA Space Apps 2026 · Cottbus

Three challenges no Cottbus team has claimed, each broken down far enough to choose one and start building. The recommendation is the MODIS and VIIRS fire calendar.

> **Check before relying on it.** Challenge descriptions, resource lists and team counts were read from the Space Apps site on 14 November 2026. API details, dataset names and numeric thresholds come from general knowledge and were not tested. Confirm them in the first hour. Teams can still switch challenges.

## Contents

- [What the 19 Cottbus teams picked](#what-the-19-cottbus-teams-picked)
- [1. Harmonization of MODIS and VIIRS Hot Spots](#1-harmonization-of-modis-and-viirs-hot-spots)
- [2. Interplanetary Survival Guide: Martian Map](#2-interplanetary-survival-guide-martian-map)
- [3. The Earth Information Jukebox](#3-the-earth-information-jukebox)
- [Side by side](#side-by-side)

## What the 19 Cottbus teams picked

Crowded challenges mean direct comparison on the same brief. The three with no team are the ones covered here.

| Challenge | Teams |
|---|---:|
| Abandoned but not Forgotten (storytelling) | 4 |
| Lunar Landing Site Navigator | 3 |
| Create Health Monitoring Software for Astronauts | 2 |
| Be An Earth System Trend Detective! | 2 |
| Field Shift: Adapting Farms with NASA Data | 2 |
| Flame in Freefall | 1 |
| Space Mission Design Game | 1 |
| Build a Junior Astronaut Mission Trainer | 1 |
| Identify Earth Locations that Analog Moon Base Locations and Mars | 1 |
| Dancing with the SARs | 1 |
| Planet X and SPHEREx | 1 |
| **Harmonization of MODIS and VIIRS Hot Spots** | **0** |
| **Interplanetary Survival Guide: Martian Map** | **0** |
| **The Earth Information Jukebox** | **0** |

---

## 1. Harmonization of MODIS and VIIRS Hot Spots

Recommended · Advanced / Intermediate

### 1.1 Overview and purpose

Satellites have logged active-fire hotspots since about 2000, but the record is split across two sensors. MODIS has 1 km pixels, runs from 2000 and is near the end of its life. VIIRS has 375 m pixels and runs from 2012. They report different numbers of detections for the same fire, so raw counts cannot be compared across the two.

The goal is a web app that merges both into one consistent series and shows a burning calendar for any region a user selects. The users are emergency managers, land managers, firefighters and scientists.

### 1.2 Technology stack

| Layer | Choice | Why |
|---|---|---|
| Data prep | Python, pandas, GeoPandas | Hotspots arrive as CSV points; this is the fastest route |
| Storage | Parquet files queried with DuckDB | Millions of rows, fast area and date filters, no database server to run |
| API | FastAPI | Thin, typed, streams CSV easily |
| Frontend | React, MapLibre GL with a draw plugin, ECharts | ECharts has a built-in calendar heatmap |
| Hosting | One container plus a static frontend | One deploy, little to break during the demo |

### 1.3 System architecture

```
FIRMS archive CSVs --> ingest + harmonize (offline, Python) --> Parquet
                                                                  |
Browser: map, draw area --> FastAPI /calendar /anomaly /export --> DuckDB
     calendar, charts  <--  JSON / CSV  --------------------------+

FIRMS near-real-time API --> daily top-up job (optional)
```

### 1.4 How it works

All heavy work happens offline. The API only filters pre-harmonized rows by polygon and date range, then aggregates them by month. That keeps each request fast and means the demo does not depend on NASA's servers being reachable.

### 1.5 Business logic: the harmonization

Judges will look hardest at this part.

1. Keep vegetation fires only, using the archive `type` field, and drop low-confidence detections.
2. Snap every detection to a common grid, for example 0.1°, per day. Count fire-active cell-days instead of raw pixels. One MODIS pixel covers several VIIRS pixels, so this removes most of the resolution difference.
3. Calibrate on the overlap years, 2012 to today. Compare Aqua MODIS with S-NPP VIIRS, because both pass at about the same local time. Fit a scaling factor per region or land-cover class.
4. Apply the factor to 2001–2011 MODIS to get VIIRS-equivalent activity. Use VIIRS directly from 2012.
5. Anomaly rule: compare a month with the median of that calendar month across all years and report a percentile.

### 1.6 End-to-end flow

1. The user opens the map and draws a polygon around the Lieberose forest north of Cottbus.
2. They choose 2001 to 2026.
3. The API returns monthly harmonized activity for that polygon.
4. The calendar renders as a year-by-month grid. The current month carries a badge such as "above the 90th percentile".
5. The user downloads the hotspots as CSV.

### 1.7 Key features

- Draw an area on the map or enter latitude and longitude.
- Calendar heatmap with a colour-blind-safe ramp.
- Seasonality curve and a ranking of years.
- Anomaly badge for the current month.
- A raw versus harmonized toggle that shows the 2012 sensor jump disappearing.
- CSV export of the search result.

### 1.8 Data flow and management

The only listed source is FIRMS, NASA's Fire Information for Resource Management System (https://www.earthdata.nasa.gov/data/tools/firms). Request archive downloads per area for the MODIS standard product and for VIIRS on S-NPP and NOAA-20. The useful fields are position, date, time, satellite, confidence, fire radiative power, day or night, and type.

Keep raw files untouched. Store harmonized cells as Parquet partitioned by year. Keep calibration factors in a small JSON file so the method is inspectable.

### 1.9 Implementation approach

1. Request archive data for Brandenburg and one contrasting fire region before the event starts.
2. Write the ingest and gridding script.
3. Fit the calibration and produce one validation plot.
4. Build the API endpoints.
5. Build the map and calendar.
6. Add the anomaly badge, export and toggle.
7. Polish and rehearse the pitch.

### 1.10 Challenges and considerations

- Archive requests are fulfilled by email and can take hours. Order them first.
- The live API returns only a few days per call and needs a free key. It is unsuitable for history.
- Terra passes at a different local time and its orbit has drifted. Leave it out of the calibration or treat it separately.
- Regions with few fires, such as Germany, give noisy factors. Calibrate on a larger area and apply the result locally.
- State what harmonization cannot fix: small fires that MODIS never detected stay missing before 2012.

### 1.11 Getting started

You need Python 3.11 or newer, Node, a free Earthdata login and a FIRMS map key.

```
pipeline/   ingest.py  harmonize.py  validate.py
api/        main.py
web/        src/
data/       raw/  parquet/  factors.json
```

First task: load one year of both sensors for one region and plot monthly counts side by side. That plot is also the first slide of the pitch.

### 1.12 Expected outcome

A live URL where any drawn region returns its calendar in about a second. Check success three ways:

- The 2011 to 2012 sensor break is not visible in the harmonized series.
- Held-out overlap years are predicted within an error you state.
- Known severe fire years stand out. 2018 and 2022 are candidates for Brandenburg; confirm them before the pitch.

---

## 2. Interplanetary Survival Guide: Martian Map

Intermediate

### 2.1 Overview and purpose

Existing Mars maps such as Mars Trek are built for global and regional views. An astronaut on a surface walk needs a hyperlocal view that combines several kinds of data and answers two questions: where do I go, and is it safe?

The goal is a layered map of one site that combines at least three data types and plans a route to science targets.

### 2.2 Technology stack

| Layer | Choice | Why |
|---|---|---|
| Data prep | Python, GDAL, rasterio, NumPy | Planetary rasters need reprojection and cropping |
| Routing | scikit-image least-cost path, or your own A* | Proven grid routing in a few lines |
| API | FastAPI | Only serves route requests |
| Frontend | React with deck.gl terrain and bitmap layers | 3D terrain from a heightmap without Mars globe projection problems |
| Basemap | Mars Trek tile service | Listed in the challenge resources |

### 2.3 System architecture

```
Elevation, imagery, thermal, mineral rasters
        |
        +--> crop + align to one grid (offline) --> PNG layers + heightmap
        +--> slope, hazard and cost rasters
                                   |
Browser: 3D map, layer toggles, click waypoints --> /route --> least-cost path
     route line, time, energy, dose  <-------------------------+
```

### 2.4 How it works

Every layer is resampled to the same grid over a small area of about 10 by 10 km. The frontend drapes the layers over terrain. Routing runs on a cost raster derived from those same layers, so the map and the route always agree.

### 2.5 Business logic

- Cost per cell is a slope penalty, plus a surface penalty where low thermal inertia suggests loose sand, plus rock and shadow hazards.
- Hard limits: slopes above a set angle are impassable, and total walk time must fit the spacesuit's consumables with a walk-back margin.
- Each science target has a value. The planner orders stops to get the most science inside the time budget.
- Radiation: show the dose accumulated over the walk from Curiosity's radiation instrument averages. A space-weather alert shortens the allowed duration.
- Present every threshold as an adjustable assumption. Judges will ask where the numbers come from.

### 2.6 End-to-end flow

1. The user picks the science goal "Mount Sharp boxwork formations" and sets a six-hour walk.
2. They click three targets on the map.
3. The planner returns a route that avoids a steep scarp.
4. A side panel shows distance, climb, time, oxygen margin and dose.
5. Clicking a waypoint shows a rover photo taken nearby.

### 2.7 Key features

- Layer toggles with opacity control.
- 3D terrain.
- Click-to-route with hazards highlighted.
- Elevation profile along the route.
- Consumables and dose budget.
- Rover point-of-view photos at waypoints.
- A simplified helmet-display view.

### 2.8 Data flow and management

- An elevation model for Gale or Jezero crater.
- Orbital imagery.
- Thermal inertia.
- Mineral maps and the USGS geologic map.
- Rover traverse and the raw image galleries.
- Surface weather and radiation readings.

Everything is preprocessed once and served as static files. No database is needed.

Resources listed by the challenge:

- Mars Trek: https://trek.nasa.gov/mars/
- USGS-NASA Planetary Geologic Mapping Program: https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars
- Curiosity's proposed path up Mount Sharp: https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/
- Perseverance raw images: https://mars.nasa.gov/mars2020/multimedia/raw-images/

### 2.9 Implementation approach

1. Pick the site and download the elevation model first.
2. Compute slope and a first cost raster, then route between two points in a notebook.
3. Export the layers and show them in the frontend.
4. Wire up click-to-route.
5. Add the budget panel.
6. Add photos and the helmet-display view.

### 2.10 Challenges and considerations

- Files are large and use planetary formats and projections. One person should own data wrangling.
- Layers range from about 1 m to more than 100 m per pixel. Be open about that in the interface.
- Radiation and weather are point measurements, not maps.
- The main risk is a good-looking map with no decision logic. The route and budget are what answer the brief.

### 2.11 Getting started

You need Python with GDAL, Node and about 10 GB of free disk. Install GDAL through conda, because pip installs often fail.

```
prep/   crop_align.py  cost.py
api/    main.py  route.py
web/    src/
data/   source/  layers/
```

First task: open the elevation model, crop it to your area and render a slope map.

### 2.12 Expected outcome

An interactive 3D site map where clicking targets returns a safe route with time, energy and dose. Check success three ways:

- At least three data types are visibly combined.
- The route demonstrably avoids steep or soft terrain.
- Your route compares sensibly with the path Curiosity actually drove.

---

## 3. The Earth Information Jukebox

Intermediate / Beginner

### 3.1 Overview and purpose

NASA's Earth Information Center publishes visualizations of a changing planet, and all of them are visual only. That excludes blind and low-vision users and limits how everyone else can engage with the data.

The goal is a jukebox: a user picks a visualization and hears a soundscape generated from its frames in real time.

### 3.2 Technology stack

| Layer | Choice | Why |
|---|---|---|
| App | React or plain TypeScript with Vite | No backend needed |
| Frame analysis | Video drawn to a canvas, pixels read in a Web Worker | Real time, in the browser |
| Audio | Tone.js on the Web Audio API | Synths, scales and scheduling ready-made |
| Optional prep | Python with OpenCV | Precomputed features as a fallback |
| Hosting | Any static host | Videos must be served from your own site |

### 3.3 System architecture

```
Video frame --> canvas --> feature extractor
                           (regions, hue, brightness, motion)
                                   |
        preset for this record (mapping rules, scale, instruments)
                                   |
                     Tone.js synth voices --> speakers

UI: record picker, play and scan controls, mapping legend, text description
```

### 3.4 How it works

About ten times a second the app samples the current frame on a coarse grid. It converts those values into musical parameters and quantizes them to a scale, so the result is music instead of noise.

### 3.5 Business logic

Each visualization gets its own mapping preset, because one universal mapping tends to sound bad. Examples:

- Lightning flashes trigger percussion.
- Carbon dioxide concentration drives a rising drone.
- Aerosol types play as different instruments.
- Left-to-right position maps to stereo pan.

Where a visualization has a colour bar, decode colours back to approximate data values. That turns pixels-to-sound into data-to-sound and strengthens the scientific claim. Every preset also has a spoken or written legend that explains what the listener hears.

### 3.6 End-to-end flow

1. The user tabs to "Night Lights 2012–2023" and presses Enter.
2. A short audio legend plays.
3. The video starts and a chord brightens as cities grow.
4. The user switches to scan mode and sweeps a cursor across the map to hear single regions.

### 3.7 Key features

- Jukebox picker with five or six records.
- Real-time sonification in sync with the video.
- Scan mode.
- Mapping legend and text description for each record.
- Full keyboard and screen-reader support.
- Adjustable tempo and scale.
- Audio export.

### 3.8 Data flow and management

The challenge resources point to the Earth Information Center collection in NASA's Scientific Visualization Studio (https://svs.gsfc.nasa.gov/gallery/earth-information-center/). Listed examples include night lights, sea surface currents and temperature, aerosols, air quality, carbon dioxide, lightning from the ISS, an atmospheric river and forest height.

Store the videos as static files next to one JSON preset per record. No database is needed.

### 3.9 Implementation approach

1. Get one video playing with one mapping, brightness to pitch.
2. Add scale quantization and a second voice.
3. Define the preset format and build three records.
4. Add the picker and accessibility support.
5. Add scan mode.
6. Test with a screen reader and with your eyes closed.

### 3.10 Challenges and considerations

- Browsers block pixel reads from videos served by another site. Download the videos and host them yourself.
- Browsers block audio until the user interacts. Start playback on a click or key press.
- Frames contain baked-in labels and colour bars. Mask them out of the analysis.
- Musical quality is the differentiator and takes iteration. Someone with a musical ear helps a lot.

### 3.11 Getting started

You need Node and a modern browser.

```
src/analysis/   frame sampling, feature extraction
src/audio/      synth voices, scales
src/presets/    one JSON file per record
public/media/   downloaded videos
```

First task: play a video, read average brightness per frame and drive one oscillator with it.

### 3.12 Expected outcome

A static site where each record produces a distinct, pleasant and explainable soundscape. Check success three ways:

- A listener who cannot see the screen can say whether the quantity is rising or falling.
- The whole app works by keyboard and screen reader.
- The sound changes in sync with the video.

---

## Side by side

| | Fire calendar | Martian map | Earth Jukebox |
|---|---|---|---|
| Hardest part | Harmonization method | Data wrangling and routing | Making it sound good |
| Backend needed | Yes, light | Yes, light | No |
| Risk of not finishing | Low to medium | Medium to high | Low |
| Technical depth judges see | High | High | Medium |
| Demo impact | Solid, local story | Highest | Memorable, live audio |
| Best fit | Data and web developers | Geospatial or 3D skills | Frontend plus a musician |

**Recommendation: the fire calendar.** It has the clearest definition of done, a method you can validate with a single plot, and a local story in Brandenburg's forest fires.

Choose the Martian map only if someone on the team has handled geospatial rasters before. Choose the Jukebox if the team is small or mostly frontend and wants the safest path to a finished demo.

This assumes a team of mostly software and web developers. That was inferred, not confirmed.
