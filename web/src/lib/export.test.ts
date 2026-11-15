import { describe, expect, it } from "vitest";
import { buildTable } from "./calendar";
import { calendarCsv, calendarSvg, exportFileName, gridCsv, toCsv } from "./export";
import type { CellRow, CurrentYear } from "./types";

// [lat, lon, year, month, modis, viirs, harmonized, modisFrp, viirsFrp, harmFrp]
const rows: CellRow[] = [
  [40.125, -8.125, 2011, 8, 10, 0, 31.63, 50, 0, 120],
  [40.125, -8.125, 2025, 8, 0, 40, 40, 0, 90, 90],
  [40.375, -8.125, 2026, 8, 0, 25, 25, 0, 60, 60],
  [40.125, -8.125, 2026, 3, 0, 5, 5, 0, 10, 10],
  [40.125, -8.125, 2026, 11, 0, 2, 2, 0, 3, 3],
];
const current: CurrentYear = { year: 2026, lastDate: "2026-11-02", provisionalFrom: "2026-08-01", observedUntil: { year: 2026, month: 10 } };
const table = buildTable(rows, { record: "corrected", measure: "count", firstYear: 2011, lastYear: 2026, observedUntil: current.observedUntil });
const lines = (csv: string) => csv.trimEnd().split("\r\n");

describe("toCsv", () => {
  it("quotes fields with commas or quotes and rounds numbers to 3 decimals, enough for exact 0.25° grid centres", () => {
    expect(toCsv([["a,b", 'say "hi"', 1.23456, null]])).toBe('"a,b","say ""hi""",1.235,\r\n');
  });
});

describe("calendarCsv", () => {
  const csv = lines(calendarCsv(table, current));
  it("has a header, then one line per year", () => {
    expect(csv[0]).toBe("year,jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec,year_total_detections,record,status");
    expect(csv).toHaveLength(1 + 16);
  });
  it("marks estimated years and keeps their corrected values", () => {
    expect(csv[1]).toBe("2011,0,0,0,0,0,0,0,31.63,0,0,0,0,31.63,corrected,estimated from MODIS");
  });
  it("leaves months not reached yet empty, not zero, and labels the part year", () => {
    expect(csv[16]).toBe(
      "2026,0,0,5,0,0,0,0,25,0,0,,,32,corrected,\"part year, data to 2026-11-02; provisional from 2026-08-01\"",
    );
  });
});

describe("gridCsv", () => {
  const csv = lines(gridCsv(rows, 2025, 2026, current));
  it("keeps only the chosen years, sorted by date then place", () => {
    expect(csv.map((l) => l.split(",").slice(2, 4).join("-")).slice(1)).toEqual(["2025-8", "2026-3", "2026-8", "2026-11"]);
  });
  it("labels provisional months of the current year", () => {
    expect(csv[3]).toBe("40.375,-8.125,2026,8,0,25,25,0,60,60,provisional");
    expect(csv[2].endsWith(",")).toBe(true); // March 2026 is final data
  });
});

describe("exportFileName", () => {
  it("builds a safe, descriptive name", () => {
    expect(exportFileName("fire-calendar", "All Europe · 16 countries", "corrected", 2020, 2026, "csv")).toBe(
      "fire-calendar_all-europe-16-countries_corrected_2020-2026.csv",
    );
  });
});

describe("calendarSvg", () => {
  const svg = calendarSvg(table, { title: "Portugal & <test>", current });
  it("is a standalone SVG with an escaped title", () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain("Portugal &amp; &lt;test&gt;");
  });
  it("names the source and the part year", () => {
    expect(svg).toContain("Source: NASA FIRMS");
    expect(svg).toContain("data to 2026-11-02");
  });
});
