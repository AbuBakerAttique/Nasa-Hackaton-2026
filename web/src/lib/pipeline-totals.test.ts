// Checks the calculation library against numbers the pipeline wrote itself,
// using the real data files in public/data/. If these fail after a pipeline
// rerun, either the data copy is stale (run npm run copy-data) or the row
// format changed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTable, tableTotal, yearTotals, yearTrend } from "./calendar";
import { parseCells } from "./data";
import type { DataIndex } from "./types";

const dataDir = fileURLToPath(new URL("../../public/data/", import.meta.url));
const protoFile = fileURLToPath(new URL("../../../assets/proto/Germany.js", import.meta.url));

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const index = readJson(`${dataDir}index.json`) as DataIndex;
const loadCountry = (file: string) => parseCells(readJson(`${dataDir}cells/${file}`), file);

interface CountryReport {
  actual_viirs: number;
  raw_modis: number;
}
const report = readJson(`${dataDir}report.json`) as {
  test_years: string;
  by_country_test_years: Record<string, CountryReport>;
};
const [testFirst, testLast] = report.test_years.split("-").map(Number);

describe("totals match report.json for the held-out test years", () => {
  it.each(index.countries.map((c) => [c.id, c] as const))("%s", (id, country) => {
    const expected = report.by_country_test_years[id];
    expect(expected, `report.json has no entry for ${id}`).toBeDefined();
    const rows = loadCountry(country.file);
    const range = { firstYear: testFirst, lastYear: testLast };

    // From 2012 the raw record is VIIRS, so it must equal the pipeline's VIIRS total.
    const viirs = tableTotal(buildTable(rows, { record: "raw", measure: "count", ...range }));
    expect(viirs).toBeCloseTo(expected.actual_viirs, 6);

    // MODIS kept observing after 2012; add its column directly.
    const modis = rows
      .filter((r) => r[2] >= testFirst && r[2] <= testLast)
      .reduce((total, r) => total + r[4], 0);
    expect(modis).toBeCloseTo(expected.raw_modis, 6);
  });
});

describe("Germany matches the prototype calendar on the project board", () => {
  // assets/proto/Germany.js is `window.PROTO["..."]={...};`
  const text = readFileSync(protoFile, "utf8");
  const proto = JSON.parse(text.slice(text.indexOf("=") + 1).trim().replace(/;$/, "")) as {
    cal: Record<"raw" | "harm" | "rawF" | "harmF", number[][]>;
  };
  const rows = loadCountry("Germany.json");
  // The prototype covers the complete archive years 2001-2025, not the current year.
  const range = { firstYear: index.firstYear, lastYear: 2025 };

  it.each([
    ["raw", "count", "raw"],
    ["corrected", "count", "harm"],
    ["raw", "frp", "rawF"],
    ["corrected", "frp", "harmF"],
  ] as const)("%s record, %s", (record, measure, key) => {
    const ours = buildTable(rows, { record, measure, ...range }).values;
    const theirs = proto.cal[key];
    expect(ours).toHaveLength(theirs.length);
    // The prototype stores whole numbers, so allow for its rounding.
    ours.forEach((months, y) =>
      months.forEach((v, m) => expect(Math.abs(v - theirs[y][m]), `${2001 + y}-${m + 1}`).toBeLessThanOrEqual(0.5 + 1e-9)),
    );
  });

  // Reference S and p computed with scipy on the same yearly totals.
  it("has the expected yearly trend statistics", () => {
    const corrected = yearTrend(buildTable(rows, { record: "corrected", measure: "count", ...range }))!;
    expect(corrected.s).toBe(184);
    expect(corrected.p).toBeCloseTo(1.92e-5, 6);
    const raw = yearTrend(buildTable(rows, { record: "raw", measure: "count", ...range }))!;
    expect(raw.s).toBe(212);
    expect(yearTotals(buildTable(rows, { record: "raw", measure: "count", ...range }))).toHaveLength(25);
  });
});

// Step 6 check: the year totals jump at 2012 in the raw record, because the
// newer satellite sees more, and not in the corrected record. "Jump" is the
// average of 2012 to 2014 divided by the average of 2009 to 2011.
describe("the 2012 sensor change", () => {
  const jump = (totals: number[]) => {
    const before = (totals[8] + totals[9] + totals[10]) / 3; // 2009 to 2011
    const after = (totals[11] + totals[12] + totals[13]) / 3; // 2012 to 2014
    return after / before;
  };
  const range = { measure: "count" as const, firstYear: 2001, lastYear: 2025 };
  const jumps = (rows: ReturnType<typeof loadCountry>) => ({
    raw: jump(yearTotals(buildTable(rows, { record: "raw", ...range }))),
    corrected: jump(yearTotals(buildTable(rows, { record: "corrected", ...range }))),
  });

  // Single countries vary from year to year (Sweden's corrected record rises
  // 1.7 times, Turkey's raw one only 1.5 times), so the fixed limits are
  // checked on Germany and on all 16 countries added together.
  it("Germany jumps about 3 times in raw and stays level in corrected", () => {
    const j = jumps(loadCountry("Germany.json"));
    expect(j.raw).toBeGreaterThan(1.8);
    expect(j.corrected).toBeGreaterThan(0.75);
    expect(j.corrected).toBeLessThan(1.33);
  });

  it("all 16 countries together jump in raw and not in corrected", () => {
    const all = index.countries.flatMap((c) => loadCountry(c.file));
    const j = jumps(all);
    expect(j.raw).toBeGreaterThan(1.8);
    expect(j.corrected).toBeGreaterThan(0.75);
    expect(j.corrected).toBeLessThan(1.33);
  });

  // The raw jump divided by the corrected jump is the correction ratio the
  // pipeline applied. It must equal the one in report.json in every country.
  const ratio = (readJson(`${dataDir}report.json`) as { regional_ratio_all_cells: number }).regional_ratio_all_cells;
  it.each(index.countries.map((c) => [c.id, c] as const))("%s: the step at 2012 is the pipeline's ratio", (_, country) => {
    const j = jumps(loadCountry(country.file));
    expect(j.raw / j.corrected).toBeCloseTo(ratio, 2);
  });
});
