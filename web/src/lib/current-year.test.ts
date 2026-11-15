import { describe, expect, it } from "vitest";
import {
  buildTable,
  isCompleteYear,
  isObserved,
  lastCompleteYear,
  mainSeason,
  rankMonth,
  typicalYear,
  worstYear,
  yearTotals,
  yearTrend,
} from "./calendar";
import { describeMonth, describeTable } from "./findings";
import type { CellRow } from "./types";

// A corrected-record row: [lat, lon, year, month, modis, viirs, harmonized, modisFrp, viirsFrp, harmFrp].
const r = (year: number, month: number, n: number): CellRow => [52.12, 13.38, year, month, 0, n, n, 0, 0, 0];

// 2021-2025 complete (100 per month, so 1200 a year), 2026 observed to October only.
const rows: CellRow[] = [];
for (let y = 2021; y <= 2025; y++) for (let m = 1; m <= 12; m++) rows.push(r(y, m, 100 + (y - 2021)));
for (let m = 1; m <= 11; m++) rows.push(r(2026, m, m === 11 ? 3 : 50));
const opts = { record: "corrected" as const, measure: "count" as const, firstYear: 2021, lastYear: 2026 };
const table = buildTable(rows, { ...opts, observedUntil: { year: 2026, month: 10 } });

describe("a record that ends part way through the current year", () => {
  it("knows which months and years are complete", () => {
    expect(isObserved(table, 2026, 10)).toBe(true);
    expect(isObserved(table, 2026, 11)).toBe(false);
    expect(isObserved(table, 2025, 12)).toBe(true);
    expect(isCompleteYear(table, 2026)).toBe(false);
    expect(isCompleteYear(table, 2025)).toBe(true);
    expect(lastCompleteYear(table)).toBe(2025);
  });

  it("still shows the part year's own total", () => {
    expect(yearTotals(table).at(-1)).toBe(10 * 50 + 3);
  });

  it("leaves the part year out of the typical year, worst year and trend", () => {
    // Complete years total 1200, 1212, 1224, 1236, 1248: median 1224.
    expect(typicalYear(table)).toBe(1224);
    expect(worstYear(table)?.year).toBe(2025);
    const trend = yearTrend(table);
    expect(trend?.direction).toBe("rising");
  });

  it("matches a table without the part year for every year statistic", () => {
    const complete = buildTable(rows, { ...opts, lastYear: 2025 });
    expect(typicalYear(table)).toBe(typicalYear(complete));
    expect(worstYear(table)).toEqual(worstYear(complete));
    expect(yearTrend(table)).toEqual(yearTrend(complete));
    expect(mainSeason(table)).toEqual(mainSeason(complete));
  });

  it("compares an observed month of the part year with the other years", () => {
    const july = rankMonth(table, 2026, 7);
    expect(july.others).toBe(5);
    expect(july.below).toBe(0);
  });

  it("does not count a month not reached yet as a month with zero fire", () => {
    const december = rankMonth(table, 2025, 12);
    expect(december.others).toBe(4); // 2021-2024, not the empty December 2026
    expect(december.median).toBe(102);
    expect(describeMonth(table, 2021, 12).rank).toMatch(/lowest December on record/);
  });

  it("describes the latest complete year, not the part year", () => {
    expect(describeTable(table).latest).toMatch(/^2025:/);
  });

  it("behaves as before when every month is complete", () => {
    const full = buildTable(rows, opts);
    expect(full.observedUntil).toBeNull();
    expect(isCompleteYear(full, 2026)).toBe(true);
    expect(lastCompleteYear(full)).toBe(2026);
  });
});
