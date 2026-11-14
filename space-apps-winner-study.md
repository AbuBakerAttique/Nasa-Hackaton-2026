# Space Apps Winner Study

NASA Space Apps 2026 · Cottbus · researched 14 November 2026

What the ten 2025 Global Winners built, what they have in common, and which project gives our team the best realistic chance with 24 hours and our skills.

**Verdict: build the MODIS/VIIRS fire calendar with a machine-learned harmonization model at its core.** It was unclaimed in Cottbus when last checked, it matches our data-pipeline and ML strengths, and its data downloads directly with no login.

> **How to read this.** Winner details come from each team's public project page on spaceappschallenge.org. NASA does not publish per-project reasons, so every "why it likely won" is an inference from the award definition and the submission. The sample is one year and ten projects. The Flame in Freefall data source was not checked.

## Contents

- [How winners are chosen](#how-winners-are-chosen)
- [The ten 2025 Global Winners](#the-ten-2025-global-winners)
- [Patterns across the winners](#patterns-across-the-winners)
- [Top 3 ideas for our team](#top-3-ideas-for-our-team)
- [Final recommendation](#final-recommendation)
- [24-hour roadmap](#24-hour-roadmap)

## How winners are chosen

**The funnel.** Local judges pick Global Nominees. NASA and partner-agency experts narrow those to Global Finalists. An executive committee picks 10 Global Winners. In 2025 that was 10 winners from more than 11,500 submissions, so a global win is a long shot for any team. The realistic first gate is being nominated out of Cottbus.

**The rubric (2026 Project Submission Guide).** Five criteria: Impact, Creativity, Validity, Relevance, Presentation.

**The ten awards.**

| Award | Official definition |
|---|---|
| Best Use of Science | Best and most valid use of science or the scientific method |
| Best Use of Data | Best makes space data accessible or leverages it for a unique application |
| Best Use of Technology | Most innovative use of technology |
| Galactic Impact | Most potential to improve life on Earth or in the universe |
| Best Mission Concept | Most plausible concept and design |
| Most Inspirational | Captures our hearts |
| Best Use of Storytelling | Most creatively communicates the potential of open data through storytelling |
| Global Connection | Best connects people around the world through technology |
| Art & Technology | Most effectively combines technical and creative skills |
| Local Impact | Greatest potential for local impact |

**Submission rules that decide outcomes.**

- The demo is a video of 30 seconds or less, or a deck of at most seven slides. Going over either limit makes the project ineligible for global judging.
- Judges score mostly from the project page. The demo feeds the Presentation score.
- Every link must open publicly with no login or permission request. If judges cannot open it, it is not judged.
- Everything must be in English.
- The page must describe how AI tools were used.

## The ten 2025 Global Winners

### 1. Astro Sweepers · Galactic Impact

- **Location and challenge:** Universal Event · Commercializing Low Earth Orbit.
- **Problem:** satellite operators must prove their missions meet orbital-debris rules, and the analysis and paperwork take weeks.
- **Solution:** a platform that ingests public orbital data, automates NASA's Debris Assessment Software workflow, scores every object with a four-part risk index, and generates ready-to-file compliance reports and PDFs.
- **Technology:** web portal on Vercel, a physics-based scoring formula with deorbit cost, data from NASA, Space-Track and ESA.
- **What stood out:** before-and-after risk scores, a fair per-country selection of case studies, and an eight-tier subscription model with a break-even estimate.
- **Why it likely won:** it turns a slow expert process into one click and ties it to a business that could sustain it.

### 2. Gaia+LEO · Global Connection

- **Location and challenge:** Seattle, USA · Commercializing Low Earth Orbit.
- **Problem:** data centers strain energy and water on Earth; when does putting compute in orbit make sense?
- **Solution:** an optimizer that decides where to place orbital and ground data centers and how to route workloads, minimizing total cost under latency, bandwidth, power and thermal limits.
- **Technology:** Python, mixed-integer optimization, Three.js, Streamlit, NASA POWER data, US energy data.
- **What stood out:** operations research applied to a question people are actively debating.
- **Why it likely won:** rigorous, quantified answer with an interactive scenario explorer.

### 3. HerCode Space, "A Solar Tale" · Best Use of Storytelling

- **Location and challenge:** Universal Event · Stellar Stories: Space Weather Through the Eyes of Earthlings.
- **Problem:** space weather is abstract for children.
- **Solution:** a five-act digital story narrated by the Sun, from ancient myths to modern solar flares.
- **Technology:** React, SCSS, a scroll-driven story library, hosted on Netlify. AI tools for illustration and narration.
- **What stood out:** a distinctive narrator and classroom-ready simplicity.
- **Why it likely won:** emotional and memorable, with science sourced from NASA and NOAA.

### 4. Photonics Odyssey, "AakashNet" · Most Inspirational

- **Location and challenge:** Chennai, India · Commercializing Low Earth Orbit.
- **Problem:** hundreds of millions in India lack reliable internet, and current satellite options are foreign-owned.
- **Solution:** a concept for a domestic satellite broadband network with low-cost electronically steered user terminals and laser links between satellites.
- **Technology:** a front-end dashboard with no backend, plus radio-frequency modelling in MATLAB and OpenEMS.
- **What stood out:** concrete numbers such as a ₹23,000 terminal cost target and 700 million people offline.
- **Why it likely won:** a national-scale vision told with specifics. It is mostly a concept, which shows a working product is not required for this award.

### 5. PureFlow · Best Mission Concept

- **Location and challenge:** Aracaju, Brazil · Your Home in Space: The Habitat Layout Creator.
- **Problem:** designing a space habitat means balancing mass, power, life support and shielding.
- **Solution:** a 3D habitat designer that recalculates crew requirements live and then tests the design against real solar storms.
- **Technology:** 3D web app on GitHub Pages, NASA's DONKI space weather feed.
- **What stood out:** the question "would your habitat survive a solar storm today?", answered with live data.
- **Why it likely won:** it went past the brief. A layout tool became a survival simulator.

### 6. QUEÑARIS · Local Impact

- **Location and challenge:** Arequipa, Peru · BloomWatch.
- **Problem:** degraded queñua forests no longer hold water. The team cites a spring that fell from 14 litres per second to zero within days.
- **Solution:** a reforestation planning platform that combines drone imagery, NASA vegetation indices and AI to pick planting sites and monitor forest health.
- **Technology:** Django with GeoDjango, PostgreSQL, Redis, Celery, React with TypeScript, Gemini, Rasterio, GeoPandas.
- **What stood out:** 5,000 seedlings already grown and a planting campaign scheduled.
- **Why it likely won:** a named local crisis, real users and proof the team will act.

### 7. Resonant Exoplanets · Best Use of Data

- **Location and challenge:** Mountain View, USA · A World Away: Hunting for Exoplanets with AI.
- **Problem:** exoplanet detection suffers from noise and false positives.
- **Solution:** an end-to-end pipeline that fetches telescope data, detects transits, validates candidates with physics models, checks atmospheric chemistry and produces reports.
- **Technology:** FastAPI, XGBoost, Lightkurve, Astroquery, React, a custom exact-arithmetic solver, PDF generation. Data from Kepler, TESS, JWST and Hubble.
- **What stood out:** physics validation layered on machine learning to cut false positives.
- **Why it likely won:** a complete path from raw NASA data to a checked answer.

### 8. SpaceGenes+ · Best Use of Science

- **Location and challenge:** Berlin, Germany · Build a Space Biology Knowledge Engine.
- **Problem:** space biology tools study radiation and microgravity separately, but astronauts face both at once.
- **Solution:** a dashboard that flags genes whose response to combined stress exceeds the sum of the individual responses.
- **Technology:** no-code site and dashboard builders, Python with pandas, one NASA GeneLab dataset.
- **What stood out:** one sharp scientific question nobody else asked.
- **Why it likely won:** valid method on real data. It also shows technical complexity is not required.

### 9. Twisters, "SkySense" · Best Use of Technology

- **Location and challenge:** Monterrey, Mexico · Will It Rain On My Parade?
- **Problem:** generic forecasts do not help people plan a specific outdoor event.
- **Solution:** a web app that scores weather risk for a place and time, suggests the safest window, syncs to the calendar and includes a chat assistant.
- **Technology:** React, Firebase, Google APIs, NASA POWER, Open-Meteo, Gemini.
- **What stood out:** a complete, polished product experience.
- **Why it likely won:** many integrations working together smoothly.

### 10. Zumorroda-X, "Henry's Farm Adventures" · Art & Technology

- **Location and challenge:** Cairo, Egypt · NASA Farm Navigators.
- **Problem:** farming under climate stress is hard to teach.
- **Solution:** a story game in which a farmer travels to five countries and plays mini-games built on real events such as the 2022 Pakistan floods.
- **Technology:** web game on Vercel, NASA satellite imagery, a small crop-survival model.
- **What stood out:** real disasters and real satellite images turned into play.
- **Why it likely won:** strong blend of narrative, art and data.

## Patterns across the winners

1. **Awards go to categories, not challenges.** Three of the ten winners came from the same challenge. Aim at an award. For our team that is Best Use of Data or Local Impact.
2. **One differentiator, stated in a sentence.** PureFlow: would your habitat survive today's solar storm? SpaceGenes+: stressors interact. None won on feature count.
3. **They exceeded the brief.** PureFlow and Astro Sweepers both delivered the requested tool and then one level more.
4. **Eight of ten had a public live URL.** A native mobile app that judges cannot install is close to invisible.
5. **Depth on one NASA dataset beat breadth.** SpaceGenes+ used one dataset. SkySense leaned on one API.
6. **Technical complexity was not required.** A no-code dashboard won Best Use of Science. A generic chatbot was never what set a winner apart.
7. **Actionable output.** Risk scores, PDF reports and safest time windows.
8. **Named users and concrete numbers.** Litres per second, cost per terminal, seedlings grown.
9. **A local anchor helps.** Arequipa's water and India's connectivity gave two teams their story.

## Top 3 ideas for our team

Our strengths: AI and ML, mobile, data pipelines, architecture, full-stack, API integration. This replaces the earlier shortlist in the playbook. The Mars map and the Jukebox need geospatial-raster and musical skills we did not list.

### Idea 1. Fire calendar with learned harmonization (recommended)

Challenge: Harmonization of MODIS and VIIRS Hot Spots.

- **Problem:** 25 years of satellite fire records are split across two sensors that cannot be compared, so nobody can say reliably whether this month is abnormal for a region.
- **Solution and impact:** one consistent record, a burning calendar for any drawn region, and a live "abnormal now" alert. Users are fire services, forest managers and civil protection.
- **NASA data:** FIRMS per-country yearly CSV files for MODIS and VIIRS, and the FIRMS near-real-time feed. Checked on 14 November 2026: the country files download directly with no login.
- **Where ML earns its place:** a gradient-boosted model trained on the years both sensors flew converts MODIS detections into VIIRS-equivalent activity. We report its error on held-out years. That is the harmonization the brief asks for, and it speaks to the Validity criterion.
- **Architecture and stack:** Python pipeline to Parquet queried with DuckDB, FastAPI, React with MapLibre and ECharts, built mobile-first as an installable web app, deployed to a public URL.
- **24-hour features:** draw a region, calendar heatmap, anomaly badge, raw-versus-harmonized toggle, CSV export.
- **What makes it different:** most teams will count hotspots. We show a validated model and a live alert.
- **Criteria fit:** Impact (fire response), Creativity (live alert), Validity (measured error), Relevance (exactly the brief), Presentation (a local Brandenburg story).
- **Risks and fixes:**
  - German fire data is sparse. Train on Portugal and Greece as well.
  - The files include industrial heat sources such as steelworks. Filter on the `type` field.
  - Terra passes at a different local time. Calibrate on Aqua against S-NPP.

### Idea 2. Flame in Freefall: fire-safety knowledge engine

- **Problem:** microgravity combustion results in NASA's Physical Science Informatics database are hard to find, compare and interpret.
- **Solution and impact:** extract each experiment into comparable fields (fuel, oxygen level, pressure, gravity), rank experiments by relevance to habitat fire safety, and answer questions with citations.
- **NASA data:** the Physical Science Informatics database. Access was not verified.
- **Where ML earns its place:** structured extraction and retrieval are the product. A similar 2025 challenge produced a winner.
- **Architecture and stack:** ingestion pipeline, vector search, LLM extraction with a fixed schema, FastAPI, React dashboard.
- **24-hour features:** searchable experiment table, relevance ranking, cited answers, side-by-side comparison.
- **What makes it different:** comparable structured parameters, not a chat window over documents.
- **Criteria fit:** Relevance and Impact are strong. Creativity depends on the structured comparison.
- **Risks:** unverified data access, one Cottbus team already on it, and a generic document chatbot is what most AI teams will submit.

### Idea 3. Earth System Trend Detective

- **Problem:** there are too many Earth science variables to know which are changing significantly, and where.
- **Solution and impact:** a plain-language question selects the variable, a pipeline builds the regional time series, and a significance test reports rate and confidence.
- **NASA data:** Earthdata catalogue and time-series services.
- **Where ML earns its place:** selecting the right variable from NASA's catalogue is a real retrieval problem.
- **Architecture and stack:** catalogue index, retrieval, data fetchers, statistics service, React front end.
- **24-hour features:** question to variable, region selection, time-series chart, Mann-Kendall test, plain-language result.
- **What makes it different:** the natural-language entry point.
- **Criteria fit:** Relevance is strong. Validity depends on the statistics.
- **Risks:** two Cottbus teams already chose it, and data access across many NASA products is slow and the likely time sink.

## Final recommendation

**Build Idea 1, the fire calendar.**

| | Fire calendar | Flame in Freefall | Trend Detective |
|---|---|---|---|
| Cottbus teams on it | 0 | 1 | 2 |
| Data access | Verified, direct download | Not verified | Slow, many sources |
| Fit to our skills | Pipelines, ML, full-stack | AI, pipelines | Pipelines, AI |
| Proof it works | Error on held-out years | Hard to measure | Statistical test |
| Local story | Brandenburg forest fires | None | Depends on region |
| Finish risk in 24 hours | Low to medium | Medium | Medium to high |

The fire calendar has the clearest definition of done, a measurable result and no direct local competitor. Flame in Freefall fits our AI skills best, but its data access is unverified and its default form is the most common submission type.

**One-sentence pitch:** 25 years of fire history as one consistent record, with an alert when your region turns abnormal.

## 24-hour roadmap

This assumes five roles. Rebalance to the real headcount.

| Hours | Work | Owner |
|---|---|---|
| 0–2 | Download Germany, Portugal and Greece files. Plot both sensors side by side. Agree scope and the pitch sentence. | Everyone |
| 2–4 | Architecture, API contract, repo skeleton. Deploy an empty app to a public URL. | Architect |
| 2–8 | Pipeline: filter, grid, aggregate to Parquet. | Data engineer |
| 4–10 | Harmonization model and validation plot. | ML engineer |
| 4–12 | Map, draw tool and calendar on mock data, then on the real API. | Front-end / mobile |
| 8–14 | API endpoints, anomaly logic, CSV export. | Back-end |
| 14–18 | Integration: working end to end on the live URL. | Everyone |
| 18–21 | Live alert, raw-versus-harmonized toggle, phone layout, bug fixing. | Split |
| 18–22 | Project page text, 30-second video or seven slides. | Demo owner |
| 22–24 | Test every link without login. Submit early. Buffer. | Everyone |

Three rules for the day:

- Deploy in hour 2 and keep it deployed.
- Name the demo owner at the start, not at hour 20.
- Cut features before cutting the validation plot. It is the evidence for the Validity score.

## Sources

- 2025 Global Winners: https://www.spaceappschallenge.org/2025/awards/global-winners/
- Awards: https://www.spaceappschallenge.org/awards/
- Project Submission Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- FIRMS: https://www.earthdata.nasa.gov/data/tools/firms
