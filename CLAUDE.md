# Project rules

## What this project is

Fire Calendar, for the NASA Space Apps Challenge 2026 (Cottbus), challenge "Harmonization of MODIS and VIIRS Hot Spots". Team of five. Local submission deadline: Sunday 15 November 2026, 16:00.

Read these before doing anything:

- `README.md`: structure, how to run the pipeline, data format.
- `development-plan.html` and `docs/development-roadmap.md`: the 16-step build plan and its progress table.
- `index.html`: project board with the checklist, challenge coverage and prototype.

## How we work

- Build one roadmap step at a time. Do not start the next step until the current one is validated and the team approves.
- For each step give: what, why, how, expected outcome, validation, the concepts behind it, and a suggested commit message.
- Commit and push only when the team explicitly asks.
- After a step is committed, update its status in `development-plan.html` and `docs/development-roadmap.md`.
- Stack: Next.js (App Router), TypeScript strict, Tailwind, ECharts, MapLibre, in `web/`, deployed on Vercel with root directory `web`. No database, no login.
- Calculations go in `web/src/lib/` as plain tested functions. Components only draw.
- `data/` and `venv/` are not in git. The Python pipeline in `pipeline/` regenerates `data/`.
- Do not present the machine-learning model as better than the simple ratio unless `data/out/report.json` shows it. Report limits honestly.

## Git commits

- Never add a `Co-Authored-By` line (or any other Claude/AI attribution) to commit messages in this repository.
- Never add a "Generated with Claude Code" line to pull request descriptions.
