# Development Roadmap

Fire Calendar · NASA Space Apps 2026 · Cottbus · written Saturday 14 November 2026

The final build plan for the web app. We work one step at a time: build, validate, understand, then commit when the team says so. On Saturday the team decided to build first and deploy to Vercel at the end, in step 16.

## Progress

| Step | Task | Status |
|---|---|---|
| 0 | Data pipeline and prototype | Committed (91ded23) |
| 1 | Scaffold the Next.js app in `web/` | Committed |
| 2 | Project shell (start page) | Committed |
| 3 | Data contract, data files and loader | Committed |
| 4 | Core logic library with tests | Validated |
| 5 | Country menu and calendar | Validated |
| 6 | Raw / corrected switch and date range | Validated |
| 7 | Map with fire squares | Validated |
| 8 | Region selection: draw, latitude and longitude box | Validated |
| 9 | Findings and comparison panel | Validated |
| 10 | Trend, extent and frequency views | Validated |
| 11 | Downloads and shareable link | Not built |
| 12 | Method page | In progress (method and validation in report/README) |
| 13 | Live data route (NASA key) | Not built |
| 14 | Pipeline upgrades and global cases | In progress |
| 15 | Polish and accessibility | Validated for current Europe view |
| 16 | Deployment and submission | Not started |
| 17 | Six global study areas, FireDNA and sensor comparison | Built; five archives pending |

Status values: Not started, In progress, Built, Validated, Committed.

What was done in each finished step, and why, is written down in the [step log](#step-log) below. Add an entry when a step is built and validated.

## Step log

### Step 17. Six global case studies and FireDNA

- **What:** added the six named study areas to the explorer, made the currently supported Southern Europe case use Portugal, Spain and Greece, and added a detection-profile fingerprint plus an MODIS/VIIRS comparison panel.
- **Why:** gives the project a cross-region scientific story and makes the sensor harmonization visible next to its seasonal findings.
- **Method:** FireDNA uses monthly harmonized detection counts; the sensor panel compares MODIS, VIIRS and the fixed Europe-wide ratio during the overlap years. The selected-area error is descriptive because the ratio was trained on the same European overlap; the independent evidence remains the pipeline's held-out 2022–2025 validation.
- **Coverage:** the committed archive contains Europe only. The other five cases are shown as data-pending, never as zero-fire. Target study windows are displayed on each region card.
- **Next:** fetch spatially filtered FIRMS archives for the five remaining areas, validate observation coverage, and only then enable their analysis.

### Step 0. Data pipeline and prototype (committed, 91ded23)

- **What:** two Python scripts that download the NASA fire files and turn them into one corrected record per country, plus the project board with a working prototype.
- **Why:** the web app only shows data. The data and the proof that the correction works had to exist first.
- **How:** `pipeline/01_download.py` then `pipeline/02_harmonize.py`. The README has the commands. Output lands in `data/out/`, which is not in git.
- **Result:** 16 European countries, one file each in `data/out/cells/`, and `report.json` with the accuracy on the held-out years 2022 to 2025. The best method so far is one fixed ratio for all countries. The machine-learning model does not beat it yet.

### Step 1. Scaffold the Next.js app in `web/` (committed)

- **What:** an empty Next.js 16.4.6 application in `web/`, with React 19, TypeScript in strict mode, Tailwind 4, ESLint, the App Router and a `src/` folder. No features.
- **Why:** every later step lives inside it. Doing it alone first means that when something breaks later, we know the base was sound.
- **How:** from the repo root:

  ```bash
  npx create-next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git
  cd web
  npm install
  ```

  `--disable-git` stops the tool from creating a second git repository inside ours.
- **Result:** `npm run lint` reports no problems. `npm run build` compiles and builds the start page as a static page. `npx tsc --noEmit` reports no type errors. `npm run dev` serves the start page on `localhost:3000`. `web/tsconfig.json` contains `"strict": true`, there is no `web/.git`, and `node_modules` and `.next` are ignored by git.
- **Good to know:**
  - After cloning or pulling, run `npm install` inside `web/` before `npm run dev`. `node_modules` is not in git.
  - Edits to `web/src/app/globals.css` do not show up in a running dev server. Stop it with Ctrl+C and run `npm run dev` again. Edits to `.tsx` files, including new Tailwind classes, show up at once. The production build is not affected.
  - Cache Components is switched on in `web/next.config.ts`. The tool does this by default. It does not matter for static pages. It changes how server-side data loading behaves, so check it again in step 13.
  - `web/AGENTS.md` is created by Next.js and recreated by `npm run dev` if deleted. It tells AI coding tools to read the Next.js documentation shipped in `node_modules/next/dist/docs/`. We keep it in git.
  - `npm audit` lists 7 moderate issues, all in the lint tooling, which never reaches users. Left alone.
- **Commit:** `Add Next.js app scaffold in web/`

### Step 2. Project shell, the start page (committed)

- **What:** our own start page in place of the Next.js one: project name, one-line description, an area for the calendar, and the data credit.
- **Why:** every later page needs the same frame. Building it once now means no page repeats the header and footer.
- **Changed plan:** this step used to include the Vercel deploy. On Saturday the team decided to build first and deploy at the end, so the deploy moved to step 16.
- **How:**
  - `web/src/app/layout.tsx` holds the header and footer and sets the browser tab title to "Fire Calendar".
  - `web/src/app/page.tsx` is the start page.
  - `web/src/app/globals.css` defines three colours, `muted`, `line` and `accent`, for light and dark mode. Use them as `text-muted`, `border-line`, `text-accent`.
  - The five sample pictures in `web/public/` that came with the scaffold are removed. Nothing used them.
- **Result:** lint, build and type check pass. The production build was opened in a browser at phone, tablet and desktop width: the layout holds, nothing scrolls sideways, and the console shows no errors.
- **Commit:** `Replace start page with project shell`

### Step 3. Data contract, data files and loader (committed)

- **What:** the data is now inside the web app, with a description of its format in TypeScript, a function that loads one country, and a temporary menu that proves it works.
- **Why:** this is the contract between the pipeline and the app. Every number on screen will be read through it, so the format is written down once and checked when a file is loaded.
- **How:**
  - `web/scripts/copy-data.mjs`, run with `npm run copy-data` inside `web/`. It copies the 16 country files and `report.json` from `data/out/` into `web/public/data/`, checks that every row holds 10 numbers, and writes `index.json` with the country list, row counts and the first and last year.
  - `web/src/lib/types.ts`: `CellRow` describes one row. `COL` gives the position of each value by name. `VIIRS_FIRST_YEAR` is 2012.
  - `web/src/lib/data.ts`: `loadCountryCells` downloads one country file, checks its format and remembers it, so going back to a country does not download it again.
  - `web/src/hooks/useCountryData.ts`: gives a component one of four states: idle, loading, ready with the rows, or error with a message.
  - `web/src/components/DataCheck.tsx`: the temporary menu. Step 5 replaces it.
  - The root `.gitignore` said `data/`, which also hid `web/public/data/` from git. It now says `/data/`, which only covers the pipeline folder.
- **Result:**
  - `npm run copy-data`: 16 countries, 502,310 rows, 2001 to 2025.
  - Lint, build and type check pass.
  - In a browser, on the production build: Germany shows 23,292 rows, Ukraine 140,342, Czech Republic 4,304. These equal the row counts of the pipeline files.
  - The test entry for a missing file shows: *The data file "Atlantis.json" was not found.*
  - Choosing two countries quickly, one after the other, ends on the second one.
  - **Not tested yet:** the message for a file with a wrong format. It gets a unit test in step 4.
- **Good to know:**
  - After the pipeline is rerun, run `npm run copy-data` and commit `web/public/data/`. The deployed site only has the data that is in git.
  - Read rows by name, not by number: `row[COL.year]`, not `row[2]`.
  - A `viirsRaw` of 0 before 2012 means "no data", not "no fire". The newer sensor did not exist yet.
  - The record starts in 2001, not 2000. That is 25 years, 2001 to 2025.
  - `web/public/data/` adds 27 MB to the repository. Ukraine is the largest file, 7 MB on disk and about 1.5 MB when sent compressed. It will take a moment on mobile data.
- **Commit:** `Add data types, country data files and loader`

## Technology stack

| Layer | Choice | Why | Free |
|---|---|---|---|
| Framework | Next.js (App Router) with React and TypeScript, strict mode | Vercel's native framework, so deploys need no configuration. Gives us pages, API routes and builds in one tool. | Yes |
| Styling | Tailwind CSS | Fast, consistent styling without writing a stylesheet per component | Yes |
| Charts | Apache ECharts | Heatmap and line charts built in, and it can export a chart as an image, which the challenge asks for | Yes |
| Map | MapLibre GL JS with OpenFreeMap tiles | No token or account needed | Yes |
| Drawing | terra-draw | Polygon and rectangle drawing made for MapLibre | Yes |
| Geometry | Turf.js (`boolean-point-in-polygon` only) | Decides which map squares lie inside a drawn region | Yes |
| Data storage | Static JSON files in `web/public/data/`, one per country | The corrected record is small and read-only. No database needed. | Yes |
| Backend | One Next.js route handler, `/api/recent` | Only needed to keep the NASA key secret when calling the daily feed | Yes |
| ML and data pipeline | Python, pandas, scikit-learn, run offline | Training happens once on a laptop. The app only reads the results, so nothing can fail at demo time. | Yes |
| NASA data | FIRMS country files (history) and FIRMS area API (last days) | The dataset named by the challenge | Yes, the API needs a free key |
| Tests | Vitest | Fast unit tests for the calculation functions | Yes |
| Hosting | Vercel Hobby plan, root directory `web` | Public URL, a preview build per branch, production build on `main` | Yes |
| Authentication | None | Nothing is private and judges must not hit a login | n/a |
| Database | None | See data storage | n/a |

Deliberately not used: a database, user accounts, a model server, a state library, a component kit. Each would cost hours and add nothing a judge can see.

## Architecture

```
 OFFLINE, on a laptop (Python)                      ONLINE, on Vercel (Next.js)

 NASA FIRMS country files                           Browser
        |                                              |
  pipeline/01_download.py                              |  loads one country file
        |                                              v
  pipeline/02_harmonize.py                     web/public/data/cells/{Country}.json   (static files)
        |   clean, grid, correct, validate             |
        v                                              v
  data/out/cells/{Country}.json  --copied-->   lib/  pure functions: filter, sum, compare, trend
  data/out/report.json                                 |
                                                       v
                                               components/  calendar, map, panels, downloads

 NASA FIRMS daily feed  <----  /api/recent  (server, holds the NASA key, cached)  <----  Browser
```

Rules that keep it clean:

- `web/src/lib/` holds all calculations as pure functions with no React in them. They are unit tested.
- `web/src/components/` only draws and handles clicks.
- The NASA key lives in a Vercel environment variable and is only read inside `/api/recent`.
- Selected country, region, dates and mode live in the page address, so every view can be shared as a link.

## Steps

Each step ends with a validation, a suggested commit and an entry in the step log. We do not start a step before the previous one is validated and committed.

### Step 1. Scaffold the Next.js app in `web/`
- **Build:** a new Next.js app with TypeScript strict mode, Tailwind and ESLint, in the `web/` folder.
- **Why:** everything else is built inside it.
- **Done when:** `npm run dev` shows the start page and `npm run build` and `npm run lint` pass.
- **Commit:** `Add Next.js app scaffold in web/`

### Step 2. Project shell (start page)
- **Build:** our own start page: header with the project name, an empty main area, and the data credit.
- **Why:** every later page needs the same frame. The Vercel deploy that used to be part of this step moved to step 16.
- **Done when:** the page shows the project name at phone and desktop width, and `npm run build` and `npm run lint` pass.
- **Commit:** `Replace start page with project shell`

### Step 3. Data contract, data files and loader
- **Build:** TypeScript types for a data row, a script that copies `data/out/cells/` and `report.json` into `web/public/data/`, and a `useCountryData` hook with loading and error states.
- **Why:** this is the contract between the pipeline and the app.
- **Done when:** choosing a country in a temporary menu shows its row count, and a wrong file name shows a readable error.
- **Commit:** `Add data types, country data files and loader`

### Step 4. Core logic library with tests
- **Build:** pure functions: sum rows into a year-by-month table, percentile rank, median, main season, yearly totals, trend test.
- **Why:** every number on screen comes from here, so it must be right and tested.
- **Done when:** `npm test` passes, including a check against known pipeline totals.
- **Commit:** `Add calculation library with unit tests`

### Step 5. Country menu and calendar
- **Build:** the country menu and the year-by-month heatmap with ECharts.
- **Why:** the calendar is the product the challenge names.
- **Done when:** the Germany calendar matches the prototype's numbers.
- **Commit:** `Add country menu and burning calendar`

### Step 6. Raw / corrected switch and date range
- **Build:** the switch between the raw and the corrected record, estimated years marked, and start and end year selectors.
- **Why:** the switch makes the harmonization visible. The date range is required by the challenge.
- **Done when:** year totals jump at 2012 in raw mode and not in corrected mode.
- **Commit:** `Add record switch and date range`

### Step 7. Map with fire squares
- **Build:** a MapLibre map coloured by activity per square, updating when a month is clicked.
- **Why:** shows where the fire was, not only when.
- **Done when:** October 2017 in Portugal shows the known cluster.
- **Commit:** `Add map with activity squares`

### Step 8. Region selection
- **Build:** draw a polygon or rectangle, or type a latitude and longitude box. The calendar recalculates for the squares inside.
- **Why:** "a selected area of interest" is the central interaction in the challenge.
- **Done when:** a box around Brandenburg gives the same totals as the prototype's Brandenburg region.
- **Commit:** `Add region selection by drawing and coordinates`

### Step 9. Findings and comparison panel
- **Build:** main season, worst year, latest year against a typical year, the selected month against its median and the multi-year average.
- **Why:** turns the picture into statements a fire service can act on.
- **Done when:** the statements match hand calculations for two regions.
- **Commit:** `Add findings and month comparison panel`

### Step 10. Trend, extent and frequency views
- **Build:** yearly totals with a trend line and significance, squares burning per month, and years each square burned.
- **Why:** the challenge names trends, and a trend is only fair on the corrected record.
- **Done when:** the raw record shows a false rise that the corrected record does not.
- **Commit:** `Add trend, extent and frequency views`

### Step 11. Downloads and shareable link
- **Build:** CSV of the current table, images of the calendar and charts, and the full view state in the page address.
- **Why:** the challenge asks for downloadable analytics and visualizations, and for monitoring regions.
- **Done when:** a copied link reopens the same view in a private window.
- **Commit:** `Add downloads and shareable view links`

### Step 12. Method page
- **Build:** a page with the problem chart, the validation chart, the accuracy numbers from `report.json`, the limits and the data credits.
- **Why:** the evidence for the Validity score, where judges can see it.
- **Done when:** every number on the page comes from `report.json`, none typed by hand.
- **Commit:** `Add method and validation page`

### Step 13. Live data route
- **Build:** `/api/recent`, which calls the FIRMS daily feed with the key from an environment variable, caches the answer, and returns recent detections. The app uses it for the current year, single detections and the "abnormal now" flag.
- **Why:** reaches "the present", keeps the calendar updated, and covers the newer satellites.
- **Done when:** the route works locally with the key in `web/.env.local`, the key is not visible in the browser, and the app still works when the route fails. It is checked again on Vercel in step 16.
- **Commit:** `Add live NASA feed route and current-year data`

### Step 14. Pipeline upgrades (parallel track for the AI and data roles)
- **Build:** a model that beats the simple ratio, low and high estimates, the time-of-day test, more continents, the official statistics check.
- **Why:** this is what sets us apart from other teams on the same challenge.
- **Done when:** `report.json` shows the comparison and new data files are copied into the app.
- **Commit:** one per upgrade, for example `Add detection model and uncertainty ranges to pipeline`

### Step 15. Polish and accessibility
- **Build:** phone layout, empty and error states, keyboard use, colour-blindness check, loading speed.
- **Why:** judges open the link once, often on a phone.
- **Done when:** the app works on a phone, on mobile data, and in a private window.
- **Commit:** `Polish layout, states and accessibility`

### Step 16. Deployment and submission
- **Build:** connect the GitHub repository to Vercel with root directory `web`. Then the project page text, 30-second video, public repository, final link tests, submit.
- **Why:** judges need a public link, and they score mostly from the project page.
- **Done when:** the production URL opens on a phone without a login, the live data route works there, and the project is submitted on the NASA site before Sunday 16:00.
- **Commit:** `Final README and submission notes`

## Parallel work

Steps 1 to 3 were done in order and are built. After step 3:

- Front end 1: steps 4, 5, 6, 9, 10.
- Front end 2: steps 7, 8, 11, 12.
- Data: step 13 (request the NASA key now).
- AI: step 14.
- Story: step 16 from the start.

## Deployment, before submission

The team decided on Saturday to build first and deploy at the end, as part of step 16. Until then `npm run build` is our check: it is the same command Vercel runs.

Do not leave it to the last hour. A first deploy often needs one fix, for example a setting or a secret that is missing. Plan it for Sunday morning, so there is time before the 16:00 deadline.

1. The repository must be reachable by the Vercel account. On the free plan, connect it with the repository owner's account.
2. In Vercel: New Project, import the repository, set Root Directory to `web`. Framework is detected as Next.js.
3. Environment variables are set in Vercel under Settings, Environment Variables. Locally they go in `web/.env.local`, which is never committed.
4. Every push to `main` builds production. Every other branch gets a preview URL.
5. Test each deploy in a private window and on a phone.
