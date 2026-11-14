import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCells } from "./data";
import { HALF_CELL, snapToGrid, squareValues, squaresGeoJSON, viewBounds } from "./map";
import type { CellRow } from "./types";

const row = (lat: number, lon: number, year: number, month: number, modis: number, viirs: number, harm: number): CellRow => [
  lat, lon, year, month, modis, viirs, harm, 0, 0, 0,
];

describe("squareValues", () => {
  const rows = [
    row(40.12, -8.12, 2010, 8, 2, 0, 6),
    row(40.12, -8.12, 2010, 9, 1, 0, 3), // same square, next month: added up
    row(40.38, -8.12, 2013, 8, 1, 4, 4),
    row(41.12, -7.12, 2013, 8, 0, 0, 0), // no fire: left out
    row(40.12, -8.12, 2020, 8, 0, 9, 9), // outside 2010 to 2015
  ];
  const base = { measure: "count" as const, firstYear: 2010, lastYear: 2015 };

  it("adds up each square over the year range and leaves out squares without fire", () => {
    const s = squareValues(rows, { record: "corrected", ...base });
    expect(s).toEqual([
      { lat: 40.12, lon: -8.12, value: 9 },
      { lat: 40.38, lon: -8.12, value: 4 },
    ]);
  });

  it("uses the chosen record", () => {
    const s = squareValues(rows, { record: "raw", ...base });
    expect(s.find((q) => q.lat === 40.12)!.value).toBe(3); // MODIS before 2012
    expect(s.find((q) => q.lat === 40.38)!.value).toBe(4); // VIIRS from 2012
  });

  it("can show a single month", () => {
    const s = squareValues(rows, { record: "corrected", ...base, month: { year: 2010, month: 9 } });
    expect(s).toEqual([{ lat: 40.12, lon: -8.12, value: 3 }]);
  });
});

describe("snapToGrid", () => {
  it("restores the exact centre of a rounded coordinate, also west of 0°", () => {
    expect(snapToGrid(52.12)).toBe(52.125);
    expect(snapToGrid(52.38)).toBe(52.375);
    expect(snapToGrid(-8.12)).toBe(-8.125);
    expect(snapToGrid(-7.88)).toBe(-7.875);
  });

  it("makes neighbouring squares touch exactly", () => {
    const fc = squaresGeoJSON([{ lat: 52.12, lon: 13.38, value: 1 }, { lat: 52.38, lon: 13.38, value: 1 }], 1);
    const top = (i: number) => Math.max(...fc.features[i].geometry.coordinates[0].map((p) => p[1]));
    const bottom = (i: number) => Math.min(...fc.features[i].geometry.coordinates[0].map((p) => p[1]));
    expect(top(0)).toBe(bottom(1));
  });
});

describe("squaresGeoJSON", () => {
  it("draws each square as a closed 0.25° polygon with its colour position", () => {
    const fc = squaresGeoJSON([{ lat: 40, lon: -8, value: 25 }, { lat: 41, lon: -8, value: 100 }], 100);
    expect(fc.features).toHaveLength(2);
    const ring = fc.features[0].geometry.coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(ring[2][0] - ring[0][0]).toBeCloseTo(2 * HALF_CELL, 10);
    expect(fc.features[0].properties.t).toBe(0.5); // sqrt(25 / 100)
    expect(fc.features[1].properties.t).toBe(1);
    expect(squaresGeoJSON([{ lat: 40, lon: -8, value: 25 }], 100, "linear").features[0].properties.t).toBe(0.25);
  });
});

describe("Portugal", () => {
  const file = fileURLToPath(new URL("../../public/data/cells/Portugal.json", import.meta.url));
  const rows = parseCells(JSON.parse(readFileSync(file, "utf8")), "Portugal.json");

  // Step 7 check. On 15 October 2017 large fires burned across central
  // Portugal, in the districts of Coimbra, Viseu, Guarda and Leiria.
  it("shows the October 2017 cluster in central Portugal", () => {
    const s = squareValues(rows, {
      record: "corrected",
      measure: "count",
      firstYear: 2001,
      lastYear: 2025,
      month: { year: 2017, month: 10 },
    });
    const total = s.reduce((a, q) => a + q.value, 0);
    const central = (q: { lat: number; lon: number }) => q.lat >= 39.5 && q.lat <= 41 && q.lon >= -8.75 && q.lon <= -7;
    const inCentre = s.filter(central).reduce((a, q) => a + q.value, 0);
    expect(inCentre / total).toBeGreaterThan(0.7);

    const top5 = [...s].sort((a, b) => b.value - a.value).slice(0, 5);
    expect(top5.every(central)).toBe(true);
  });

  it("frames mainland Portugal, not the Azores or Madeira", () => {
    const [west, south, east, north] = viewBounds(rows)!;
    expect(west).toBeGreaterThan(-10);
    expect(south).toBeGreaterThan(36.5);
    expect(east).toBeGreaterThan(-7);
    expect(north).toBeGreaterThan(41.5);
  });
});

describe("viewBounds", () => {
  it("is null without squares", () => {
    expect(viewBounds([])).toBeNull();
  });

  it("drops a far island with little fire, keeps nearby land", () => {
    const rows = [
      row(40.12, -8.12, 2015, 8, 0, 50, 50),
      row(41.12, -7.12, 2015, 8, 0, 30, 30),
      row(38.62, -27.12, 2015, 8, 0, 2, 2), // island, 19° away
    ];
    expect(viewBounds(rows)).toEqual([-8.12 - HALF_CELL, 40.12 - HALF_CELL, -7.12 + HALF_CELL, 41.12 + HALF_CELL]);
  });
});

describe("viewBounds for every country", () => {
  const index = JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/index.json", import.meta.url)), "utf8")) as {
    countries: { id: string; file: string }[];
  };
  // Far islands are left out on purpose. Spain's Canary Islands hold 6% of its
  // fire, the most of any country; they are still drawn, just off screen.
  it.each(index.countries.map((c) => [c.id, c.file]))("%s keeps at least 90% of its fire in view", (_, file) => {
    const path = fileURLToPath(new URL(`../../public/data/cells/${file}`, import.meta.url));
    const rows = parseCells(JSON.parse(readFileSync(path, "utf8")), file);
    const [w, s, e, n] = viewBounds(rows)!;
    const total = rows.reduce((a, r) => a + r[6], 0);
    const inside = rows.filter((r) => r[1] >= w && r[1] <= e && r[0] >= s && r[0] <= n).reduce((a, r) => a + r[6], 0);
    expect(inside / total).toBeGreaterThan(0.9);
  });
});
