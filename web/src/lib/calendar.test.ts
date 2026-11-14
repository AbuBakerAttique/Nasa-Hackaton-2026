import { describe, expect, it } from "vitest";
import {
  buildTable,
  cellOf,
  compareYear,
  isEstimated,
  mainSeason,
  monthSeries,
  monthTotals,
  rankMonth,
  rowValue,
  tableTotal,
  tableYears,
  typicalYear,
  worstYear,
  yearTotals,
  yearTrend,
} from "./calendar";
import type { CellRow } from "./types";

/** A row with only the values these tests care about. */
function row(
  year: number,
  month: number,
  v: { modis?: number; viirs?: number; harm?: number; modisFrp?: number; viirsFrp?: number; harmFrp?: number },
  lat = 52.12,
  lon = 13.38,
): CellRow {
  return [
    lat,
    lon,
    year,
    month,
    v.modis ?? 0,
    v.viirs ?? 0,
    v.harm ?? 0,
    v.modisFrp ?? 0,
    v.viirsFrp ?? 0,
    v.harmFrp ?? 0,
  ];
}

const range = { firstYear: 2010, lastYear: 2013 };

describe("rowValue", () => {
  const before = row(2011, 5, { modis: 3, viirs: 0, harm: 8, modisFrp: 30, harmFrp: 80 });
  const after = row(2012, 5, { modis: 3, viirs: 9, harm: 9, modisFrp: 30, viirsFrp: 90, harmFrp: 90 });

  it("reads MODIS before 2012 and VIIRS from 2012 in the raw record", () => {
    expect(rowValue(before, "raw", "count")).toBe(3);
    expect(rowValue(after, "raw", "count")).toBe(9);
    expect(rowValue(before, "raw", "frp")).toBe(30);
    expect(rowValue(after, "raw", "frp")).toBe(90);
  });

  it("reads the harmonized values in the corrected record", () => {
    expect(rowValue(before, "corrected", "count")).toBe(8);
    expect(rowValue(before, "corrected", "frp")).toBe(80);
  });

  it("marks years before 2012 as estimated", () => {
    expect(isEstimated(2011)).toBe(true);
    expect(isEstimated(2012)).toBe(false);
  });
});

describe("buildTable", () => {
  const rows = [
    row(2010, 1, { harm: 2 }),
    row(2010, 1, { harm: 3 }, 50.12, 10.38), // second square, same month: added up
    row(2010, 8, { harm: 10 }),
    row(2013, 12, { harm: 4 }),
    row(2009, 6, { harm: 100 }), // before the range: ignored
    row(2014, 6, { harm: 100 }), // after the range: ignored
  ];
  const t = buildTable(rows, { record: "corrected", measure: "count", ...range });

  it("adds up squares into years by months, with zeros for empty years", () => {
    expect(t.values).toHaveLength(4);
    expect(t.values.every((r) => r.length === 12)).toBe(true);
    expect(cellOf(t, 2010, 1)).toBe(5);
    expect(cellOf(t, 2010, 8)).toBe(10);
    expect(cellOf(t, 2013, 12)).toBe(4);
    expect(yearTotals(t)).toEqual([15, 0, 0, 4]);
    expect(tableYears(t)).toEqual([2010, 2011, 2012, 2013]);
    expect(tableTotal(t)).toBe(19);
  });

  it("totals each calendar month", () => {
    const m = monthTotals(t);
    expect(m[0]).toBe(5);
    expect(m[7]).toBe(10);
    expect(m[11]).toBe(4);
    expect(monthSeries(t, 1)).toEqual([5, 0, 0, 0]);
  });

  it("rejects a reversed year range and cells outside the table", () => {
    expect(() => buildTable(rows, { record: "raw", measure: "count", firstYear: 2013, lastYear: 2010 })).toThrow(
      RangeError,
    );
    expect(() => cellOf(t, 2020, 1)).toThrow(RangeError);
    expect(() => cellOf(t, 2010, 13)).toThrow(RangeError);
  });
});

/** A table from given yearly month values, starting in 2001. */
function tableOf(values: number[][]) {
  const rows = values.flatMap((months, y) => months.map((v, m) => row(2001 + y, m + 1, { harm: v })));
  return buildTable(rows, { record: "corrected", measure: "count", firstYear: 2001, lastYear: 2000 + values.length });
}

const flat = (aug: number) => [1, 1, 1, 1, 1, 1, 1, aug, 1, 1, 1, 1];

describe("rankMonth", () => {
  const t = tableOf([flat(10), flat(30), flat(20), flat(40), flat(50)]);

  it("compares a month with the same month in the other years", () => {
    const r = rankMonth(t, 2004, 8);
    expect(r.value).toBe(40);
    expect(r.below).toBe(3); // 10, 30 and 20 are lower, 50 is not
    expect(r.others).toBe(4);
    expect(r.median).toBe(30);
    expect(r.mean).toBe(30);
  });

  it("does not count equal values as below", () => {
    const tied = tableOf([flat(5), flat(5), flat(5)]);
    expect(rankMonth(tied, 2002, 8).below).toBe(0);
  });
});

describe("mainSeason", () => {
  it("returns the busiest months in calendar order with their share", () => {
    const t = tableOf([[0, 0, 0, 20, 0, 0, 30, 50, 0, 0, 0, 0]]);
    const s = mainSeason(t)!;
    expect(s.months).toEqual([4, 7, 8]);
    expect(s.share).toBe(1);
  });

  it("breaks ties with the earlier month", () => {
    const t = tableOf([[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]]);
    expect(mainSeason(t)!.months).toEqual([1, 2, 3]);
    expect(mainSeason(t)!.share).toBe(0.25);
  });

  it("is null without fire", () => {
    expect(mainSeason(tableOf([new Array(12).fill(0)]))).toBeNull();
  });
});

describe("worstYear, typicalYear, compareYear", () => {
  // Year totals: 21, 41, 31, 51, 61 (11 months of 1 plus August).
  const t = tableOf([flat(10), flat(30), flat(20), flat(40), flat(50)]);

  it("finds the worst year against the typical (median) year", () => {
    expect(typicalYear(t)).toBe(41);
    const w = worstYear(t)!;
    expect(w.year).toBe(2005);
    expect(w.total).toBe(61);
    expect(w.timesTypical).toBeCloseTo(61 / 41, 12);
  });

  it("compares one year with the typical year", () => {
    const c = compareYear(t, 2001);
    expect(c.total).toBe(21);
    expect(c.change).toBeCloseTo(21 / 41 - 1, 12);
    expect(() => compareYear(t, 1999)).toThrow(RangeError);
  });

  it("handles a table without fire", () => {
    const empty = tableOf([new Array(12).fill(0), new Array(12).fill(0)]);
    expect(worstYear(empty)).toBeNull();
    expect(compareYear(empty, 2001).change).toBeNull();
  });
});

describe("yearTrend", () => {
  it("tests the yearly totals", () => {
    const t = tableOf([flat(10), flat(20), flat(30), flat(40), flat(50)]);
    const r = yearTrend(t)!;
    expect(r.s).toBe(10);
    expect(r.slope).toBe(10);
    expect(r.direction).toBe("rising");
  });
});
