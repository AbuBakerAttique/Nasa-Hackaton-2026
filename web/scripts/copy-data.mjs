// Copies the pipeline output into the web app.
//
//   data/out/cells/{Country}.json  ->  web/public/data/cells/{Country}.json
//   data/out/report.json           ->  web/public/data/report.json
//   (written here)                 ->  web/public/data/index.json
//
// Run it from web/ with:  npm run copy-data
// Run it again every time the pipeline has been rerun, then commit web/public/data/.

import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.resolve(webDir, "..", "data", "out");
const targetDir = path.join(webDir, "public", "data");

/** Number of values in one row. Must match CellRow in src/lib/types.ts. */
const ROW_LENGTH = 10;

function fail(message) {
  console.error(`copy-data: ${message}`);
  process.exit(1);
}

const sourceCells = path.join(sourceDir, "cells");
const sourceReport = path.join(sourceDir, "report.json");

if (!existsSync(sourceCells) || !existsSync(sourceReport)) {
  fail(
    `the pipeline output is missing in ${sourceDir}.\n` +
      "Run the pipeline first, from the repository root:\n" +
      "  venv/bin/python pipeline/01_download.py\n" +
      "  venv/bin/python pipeline/02_harmonize.py",
  );
}

const files = (await readdir(sourceCells)).filter((f) => f.endsWith(".json")).sort();
if (files.length === 0) fail(`no country files found in ${sourceCells}.`);

// Verify against the source rows before replacing the app's working copy.
const report = JSON.parse(await readFile(sourceReport, "utf8"));
const [testFirst, testLast] = report.test_years.split("-").map(Number);
let actualViirs = 0;
let actualModis = 0;
for (const file of files) {
  const rows = JSON.parse(await readFile(path.join(sourceCells, file), "utf8"));
  if (!Array.isArray(rows) || !rows.every((r) => Array.isArray(r) && r.length === ROW_LENGTH && r.every(Number.isFinite))) {
    fail(`${file}: invalid source rows; existing app data preserved.`);
  }
  for (const row of rows) {
    if (row[2] >= testFirst && row[2] <= testLast) {
      actualViirs += row[5];
      actualModis += row[4];
    }
  }
}
if (actualViirs <= 0 || actualViirs !== report.test_totals.actual_viirs || actualModis !== report.test_totals.raw_modis) {
  fail("validation report does not match source detections; existing app data preserved. Rerun the pipeline.");
}

// Everything in the target folder is generated, so start clean.
// This removes files of countries the pipeline no longer produces.
await rm(targetDir, { recursive: true, force: true });
await mkdir(path.join(targetDir, "cells"), { recursive: true });

const countries = [];
let firstYear = Infinity;
let lastYear = -Infinity;

for (const file of files) {
  const rows = JSON.parse(await readFile(path.join(sourceCells, file), "utf8"));

  if (!Array.isArray(rows) || rows.length === 0) {
    fail(`${file} is empty or not a list of rows.`);
  }
  // Area the country's squares cover: west, south, east, north, in degrees,
  // to the outer edge of the 0.25° squares. The app uses it to find which
  // countries a drawn region touches.
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length !== ROW_LENGTH || !row.every(Number.isFinite)) {
      fail(`${file}, row ${i}: expected ${ROW_LENGTH} numbers, got ${JSON.stringify(row)}.`);
    }
    bounds[0] = Math.min(bounds[0], row[1] - 0.125);
    bounds[1] = Math.min(bounds[1], row[0] - 0.125);
    bounds[2] = Math.max(bounds[2], row[1] + 0.125);
    bounds[3] = Math.max(bounds[3], row[0] + 0.125);
    const year = row[2];
    if (year < firstYear) firstYear = year;
    if (year > lastYear) lastYear = year;
  }

  await copyFile(path.join(sourceCells, file), path.join(targetDir, "cells", file));

  const id = file.replace(/\.json$/, "");
  const roundedBounds = bounds.map((v) => Math.round(v * 1000) / 1000);
  countries.push({ id, name: id.replaceAll("_", " "), file, rows: rows.length, bounds: roundedBounds });
}

await copyFile(sourceReport, path.join(targetDir, "report.json"));

const index = { firstYear, lastYear, countries };
await writeFile(path.join(targetDir, "index.json"), JSON.stringify(index, null, 2) + "\n");

const cases = path.join(sourceDir, "case-studies");
if (existsSync(cases)) await cp(cases, path.join(webDir, "public", "case-studies"), { recursive: true });

const totalRows = countries.reduce((sum, c) => sum + c.rows, 0);
console.log(
  `copy-data: ${countries.length} countries, ${totalRows.toLocaleString("en")} rows, ` +
    `${firstYear} to ${lastYear}, written to ${path.relative(webDir, targetDir)}/`,
);
