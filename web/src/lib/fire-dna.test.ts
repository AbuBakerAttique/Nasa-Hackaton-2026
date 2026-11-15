import { describe, expect, it } from "vitest";
import { fireDna, compareSensors } from "./fire-dna";
import type { CellRow } from "./types";

const row = (year: number, month: number, modis: number, viirs: number, harmonized: number): CellRow =>
  [50, 10, year, month, modis, viirs, harmonized, 0, 0, 0];

describe("FireDNA follows the selected record", () => {
  const rows = [row(2011, 7, 10, 0, 30), row(2012, 8, 20, 40, 40)];

  it("uses raw sensor counts across the sensor transition", () => {
    const dna = fireDna(rows, 2011, 2012, "raw");
    expect(dna.monthTotals[6]).toBe(10);
    expect(dna.monthTotals[7]).toBe(40);
    expect(dna.total).toBe(50);
  });

  it("uses corrected values when corrected mode is selected", () => {
    const dna = fireDna(rows, 2011, 2012, "corrected");
    expect(dna.monthTotals[6]).toBe(30);
    expect(dna.monthTotals[7]).toBe(40);
    expect(dna.total).toBe(70);
  });
});

describe("sensor comparison denominator", () => {
  it("includes calendar months with no detection rows as zero-detection months", () => {
    const result = compareSensors([row(2012, 1, 2, 4, 4)], 2, 2012, 2013);
    expect(result.monthsCompared).toBe(24);
    expect(result.meanAbsoluteError).toBe(0);
  });
});
