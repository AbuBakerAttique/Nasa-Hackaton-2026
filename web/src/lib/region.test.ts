import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTable } from "./calendar";
import { parseCells, parseIndex } from "./data";
import {
  countriesInRegion,
  inRegion,
  parseBox,
  pointInRing,
  regionBounds,
  regionLabel,
  rowsInRegion,
  type LonLat,
  type Region,
} from "./region";
import type { CellRow } from "./types";

const file = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const readJson = (path: string): unknown => JSON.parse(readFileSync(file(path), "utf8"));

const row = (lat: number, lon: number, harm = 1): CellRow => [lat, lon, 2015, 8, 0, harm, harm, 0, 0, 0];

describe("pointInRing", () => {
  // An L shape: the notch at the top right is outside.
  const ring: LonLat[] = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4], [0, 0]];

  it("finds points inside and outside a concave polygon", () => {
    expect(pointInRing(1, 1, ring)).toBe(true);
    expect(pointInRing(3, 1, ring)).toBe(true);
    expect(pointInRing(1, 3, ring)).toBe(true);
    expect(pointInRing(3, 3, ring)).toBe(false); // in the notch
    expect(pointInRing(5, 1, ring)).toBe(false);
  });

  it("works whether or not the ring repeats its first point", () => {
    expect(pointInRing(3, 3, ring.slice(0, -1))).toBe(false);
    expect(pointInRing(1, 1, ring.slice(0, -1))).toBe(true);
  });
});

describe("box regions", () => {
  const box: Region = { kind: "box", south: 50, north: 52, west: 10, east: 12 };

  it("counts squares whose centre is inside, edges included", () => {
    expect(inRegion(51, 11, box)).toBe(true);
    expect(inRegion(52, 12, box)).toBe(true);
    expect(inRegion(52.01, 11, box)).toBe(false);
  });

  it("filters rows and gives its bounds", () => {
    expect(rowsInRegion([row(51, 11), row(53, 11), row(51, 9)], box)).toHaveLength(1);
    expect(regionBounds(box)).toEqual([10, 50, 12, 52]);
  });

  it("has a readable label", () => {
    expect(regionLabel(box)).toBe("Box 50°N to 52°N, 10°E to 12°E");
    expect(regionLabel({ kind: "box", south: -1, north: 1, west: -9, east: -8 })).toBe("Box 1°S to 1°N, 9°W to 8°W");
  });
});

describe("parseBox", () => {
  it("reads four numbers, with a dot or a comma", () => {
    expect(parseBox({ south: "51.35", north: "53,56", west: " 11.26", east: "14.77" })).toEqual({
      region: { kind: "box", south: 51.35, north: 53.56, west: 11.26, east: 14.77 },
    });
  });

  it("says what is wrong", () => {
    const ok = { south: "1", north: "2", west: "3", east: "4" };
    expect(parseBox({ ...ok, east: "" })).toEqual({ error: "Enter a number in each of the four fields." });
    expect(parseBox({ ...ok, east: "abc" })).toEqual({ error: "Enter a number in each of the four fields." });
    expect(parseBox({ ...ok, north: "95" })).toEqual({ error: "Latitude must be between -90 and 90." });
    expect(parseBox({ ...ok, west: "-200" })).toEqual({ error: "Longitude must be between -180 and 180." });
    expect(parseBox({ ...ok, south: "3" })).toEqual({ error: "South must be smaller than north." });
    expect(parseBox({ ...ok, west: "5" })).toEqual({ error: "West must be smaller than east." });
  });
});

const index = parseIndex(readJson("../../public/data/index.json") as Parameters<typeof parseIndex>[0]);

describe("parseIndex", () => {
  it("rejects bounds that are not four numbers", () => {
    const bad = { firstYear: 2001, lastYear: 2025, countries: [{ id: "X", name: "X", file: "X.json", rows: 1, bounds: [1, 2, 3] }] };
    expect(() => parseIndex(bad)).toThrow("index.json: the bounds of X must be four numbers");
  });
});

describe("countriesInRegion", () => {
  it("finds every country a region touches", () => {
    const berlin: Region = { kind: "box", south: 51.35, north: 53.56, west: 11.26, east: 14.77 };
    expect(countriesInRegion(index.countries, berlin).map((c) => c.id)).toEqual(["Germany", "Poland"]);
    const atlantic: Region = { kind: "box", south: 40, north: 45, west: -40, east: -35 };
    expect(countriesInRegion(index.countries, atlantic)).toEqual([]);
  });
});

// Step 8 check: a box around Brandenburg gives the same totals as the
// prototype's "Brandenburg and Berlin area" region on the project board.
// The box crosses the border, so the rows come from Germany and Poland.
describe("Brandenburg matches the prototype region", () => {
  const box: Region = { kind: "box", south: 51.35, north: 53.56, west: 11.26, east: 14.77 };
  const loaded = countriesInRegion(index.countries, box).flatMap((c) =>
    parseCells(readJson(`../../public/data/cells/${c.file}`), c.file),
  );
  const rows = rowsInRegion(loaded, box);

  const protoText = readFileSync(file("../../../assets/proto/region_Brandenburg_and_Berlin_area.js"), "utf8");
  const proto = JSON.parse(protoText.slice(protoText.indexOf("=") + 1).trim().replace(/;$/, "")) as {
    cal: Record<"raw" | "harm", number[][]>;
  };

  it.each([
    ["corrected", "harm"],
    ["raw", "raw"],
  ] as const)("%s record, every month", (record, key) => {
    const ours = buildTable(rows, { record, measure: "count", firstYear: 2001, lastYear: 2025 }).values;
    // The prototype stores each month rounded to a whole number.
    ours.forEach((months, y) =>
      months.forEach((v, m) =>
        expect(Math.abs(v - proto.cal[key][y][m]), `${2001 + y}-${m + 1}`).toBeLessThanOrEqual(0.5 + 1e-9),
      ),
    );
  });

  it("gives the same squares when the box is drawn as a polygon", () => {
    const polygon: Region = { kind: "polygon", ring: [[11.26, 51.35], [14.77, 51.35], [14.77, 53.56], [11.26, 53.56], [11.26, 51.35]] };
    expect(rowsInRegion(loaded, polygon)).toHaveLength(rows.length);
  });

  it("needs Poland: Germany alone falls short", () => {
    const germanyOnly = rows.filter((r) => loaded.indexOf(r) < index.countries.find((c) => c.id === "Germany")!.rows);
    expect(germanyOnly.length).toBeLessThan(rows.length);
  });
});
