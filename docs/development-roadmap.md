# Development Roadmap

Fire Calendar · NASA Space Apps 2026 · Cottbus · written Saturday 14 November 2026

The final build plan for the web app on Vercel. We work one step at a time: build, validate, understand, then commit when the team says so.

## Progress

| Step | Task | Status |
|---|---|---|
| 0 | Data pipeline and prototype (already built) | Built, not committed |
| 1 | Scaffold the Next.js app in `web/` | Not started |
| 2 | Deploy to Vercel | Not started |
| 3 | Data contract, data files and loader | Not started |
| 4 | Core logic library with tests | Not started |
| 5 | Country menu and calendar | Not started |
| 6 | Raw / corrected switch and date range | Not started |
| 7 | Map with fire squares | Not started |
| 8 | Region selection: draw, latitude and longitude box | Not started |
| 9 | Findings and comparison panel | Not started |
| 10 | Trend, extent and frequency views | Not started |
| 11 | Downloads and shareable link | Not started |
| 12 | Method page | Not started |
| 13 | Live data route (NASA key) | Not started |
| 14 | Pipeline upgrades (parallel track) | Not started |
| 15 | Polish and accessibility | Not started |
| 16 | Submission | Not started |

Status values: Not started, In progress, Built, Validated, Committed.

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

Each step ends with a validation and a suggested commit. We do not start a step before the previous one is validated and committed.

### Step 1. Scaffold the Next.js app in `web/`
- **Build:** a new Next.js app with TypeScript strict mode, Tailwind and ESLint, in the `web/` folder.
- **Why:** everything else is built inside it.
- **Done when:** `npm run dev` shows the start page and `npm run build` and `npm run lint` pass.
- **Commit:** `Add Next.js app scaffold in web/`

### Step 2. Deploy to Vercel
- **Build:** connect the GitHub repository to Vercel with root directory `web`.
- **Why:** the public link exists from the first hour and every push is tested for real.
- **Done when:** the production URL opens on a phone without a login, and a branch gets its own preview URL.
- **Commit:** `Replace start page with project shell` (title, header, empty main area)

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
- **Done when:** the route works on Vercel, the key is not visible in the browser, and the app still works when the route fails.
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

### Step 16. Submission
- **Build:** project page text, 30-second video, public repository, final link tests, submit.
- **Why:** judges score mostly from the project page.
- **Done when:** submitted on the NASA site before Sunday 16:00.
- **Commit:** `Final README and submission notes`

## Parallel work

Steps 1 to 3 are done in order by the front-end pair. After step 3:

- Front end 1: steps 4, 5, 6, 9, 10.
- Front end 2: steps 7, 8, 11, 12.
- Data: step 13 (request the NASA key now).
- AI: step 14.
- Story: step 16 from the start.

## Deployment from the first hour

1. The repository must be reachable by the Vercel account. On the free plan, connect it with the repository owner's account.
2. In Vercel: New Project, import the repository, set Root Directory to `web`. Framework is detected as Next.js.
3. Environment variables are set in Vercel under Settings, Environment Variables. Locally they go in `web/.env.local`, which is never committed.
4. Every push to `main` builds production. Every other branch gets a preview URL.
5. Test each deploy in a private window and on a phone.
