import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTable, type RecordKind } from "./calendar";
import { parseCells } from "./data";
import { burnFrequency, describeFrequency, describeTrend, extentByMonth, extentCaution, formatP, trendOf } from "./trends";
import type { CellRow } from "./types";

const load = (name: string) =>
  parseCells(
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../public/data/cells/${name}.json`, import.meta.url)), "utf8")),
    name,
  );
const table = (rows: CellRow[], record: RecordKind, firstYear = 2001, lastYear = 2025) =>
  buildTable(rows, { record, measure: "count", firstYear, lastYear });

const row = (lat: number, year: number, month: number, modis: number, viirs: number, harm: number): CellRow => [
  lat, 10.12, year, month, modis, viirs, harm, 0, 0, 0,
];

describe("trendOf", () => {
  it("draws Sen's line through the yearly totals", () => {
    // Six steady years: with only four, even a perfect rise is not significant (p = 0.09).
    const rows = [2010, 2011, 2012, 2013, 2014, 2015].map((y, i) => row(50.12, y, 7, 0, 0, 10 + 5 * i));
    const t = trendOf(table(rows, "corrected", 2010, 2015));
    expect(t.totals).toEqual([10, 15, 20, 25, 30, 35]);
    expect(t.line).toEqual([10, 15, 20, 25, 30, 35]);
    expect(t.test!.direction).toBe("rising");
  });

  it("has no line with fewer than 3 years", () => {
    const t = trendOf(table([], "corrected", 2010, 2011));
    expect(t.line).toBeNull();
    expect(describeTrend(table([], "corrected", 2010, 2011))).toBe("Choose at least 3 years to test for a trend.");
  });

  it("formats p-values", () => {
    expect(formatP(0.0004)).toBe("p < 0.001");
    expect(formatP(0.2336)).toBe("p = 0.234");
  });
});

// Step 10 check: the raw record shows a false rise that the corrected record
// does not. Of the 16 countries, 8 show this (Austria, Czech Republic, France,
// Greece, Italy, Spain, Turkey, Ukraine); scipy gives the same S and p.
describe("the false rise in the raw record", () => {
  it.each([
    ["Italy", 176, 22],
    ["France", 130, -12],
  ] as const)("%s rises in raw, not in corrected", (country, rawS, correctedS) => {
    const rows = load(country);
    const raw = trendOf(table(rows, "raw")).test!;
    const corrected = trendOf(table(rows, "corrected")).test!;
    expect(raw.s).toBe(rawS);
    expect(raw.direction).toBe("rising");
    expect(corrected.s).toBe(correctedS);
    expect(corrected.direction).toBe("none");

    expect(describeTrend(table(rows, "raw"))).toMatch(/^The selected record shows a rising monotonic trend in hotspot detections .* The raw record switches from MODIS to VIIRS in 2012/);
    expect(describeTrend(table(rows, "corrected"))).toMatch(/^No statistically clear monotonic trend in hotspot detections from 2001 to 2025 \(Mann–Kendall p = 0\.\d{3}\)/);
  });

  // Sen's slope 72.06 per year, computed independently in Python.
  it("Germany's rise is real: it shows in the corrected record too", () => {
    expect(describeTrend(table(load("Germany"), "corrected"))).toBe(
      "The selected record shows a rising monotonic trend in hotspot detections of about 72 detections per year from 2001 to 2025 (Mann–Kendall p < 0.001). This test does not adjust for serial correlation or repeated selection of date ranges.",
    );
  });
});

describe("extentByMonth", () => {
  const rows = [
    row(50.12, 2012, 7, 0, 3, 3),
    row(50.38, 2012, 7, 0, 1, 1),
    row(50.62, 2012, 7, 0, 0, 0), // no fire: not counted
    row(50.12, 2013, 1, 0, 2, 2),
    row(50.12, 2015, 1, 0, 2, 2), // outside the range
  ];

  it("counts squares with fire in each month of the range", () => {
    const e = extentByMonth(rows, { record: "corrected", measure: "count", firstYear: 2012, lastYear: 2013 });
    expect(e.labels).toHaveLength(24);
    expect(e.labels[0]).toBe("2012-01");
    expect(e.labels[23]).toBe("2013-12");
    expect(e.squares[6]).toBe(2);
    expect(e.squares[12]).toBe(1);
    expect(e.squares.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe("burnFrequency", () => {
  it("counts the years each square had fire", () => {
    const rows = [
      row(50.12, 2012, 7, 0, 3, 3),
      row(50.12, 2012, 8, 0, 1, 1), // same year: still one year
      row(50.12, 2014, 1, 0, 2, 2),
      row(50.38, 2013, 1, 0, 2, 2),
      row(50.62, 2013, 1, 0, 0, 0),
    ];
    const f = burnFrequency(rows, { record: "corrected", measure: "count", firstYear: 2012, lastYear: 2014 });
    expect(f).toEqual([
      { lat: 50.12, lon: 10.12, value: 2 },
      { lat: 50.38, lon: 10.12, value: 1 },
    ]);
  });
});

describe("extentCaution", () => {
  it("warns only when the range starts before 2012", () => {
    expect(extentCaution(2001)).toMatch(/^Before 2012, fewer grid squares have a retained detection/);
    expect(extentCaution(2012)).toBeNull();
  });
});

describe("describeFrequency", () => {
  const sq = (value: number) => ({ lat: 50, lon: 10, value });

  it("gives the median number of years and the squares that burned every year", () => {
    expect(describeFrequency([sq(3), sq(25), sq(21), sq(25)], 25)).toBe(
      "Half of the 4 squares with detections had at least one in 23 of the 25 years; 2 had a detection in every year.",
    );
    expect(describeFrequency([sq(1), sq(2), sq(9)], 25)).toBe(
      "Half of the 3 squares with detections had at least one in 2 of the 25 years.",
    );
    expect(describeFrequency([], 25)).toBe("No square had a filtered hotspot detection in the chosen years.");
  });

  // Hand count in Python from the data file: 660 squares, median 21 years.
  it("matches a hand count for Italy", () => {
    const f = burnFrequency(load("Italy"), { record: "corrected", measure: "count", firstYear: 2001, lastYear: 2025 });
    expect(f).toHaveLength(660);
    expect(describeFrequency(f, 25)).toMatch(/^Half of the 660 squares with detections had at least one in 21 of the 25 years/);
  });
});
