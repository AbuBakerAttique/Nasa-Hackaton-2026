// Map calculations: fire per map square, the area to show, and the squares
// as GeoJSON for MapLibre. Plain functions, no React and no map library.

import type { Feature, FeatureCollection, Polygon } from "geojson";
import { rowValue, type Measure, type RecordKind } from "./calendar";
import { COL, type CellRow } from "./types";

/** Half the width of a map square in degrees. Squares are 0.25° wide. */
export const HALF_CELL = 0.125;

/** West, south, east, north in degrees. */
export type Bounds = [west: number, south: number, east: number, north: number];

export interface SquareValue {
  lat: number;
  lon: number;
  value: number;
}

export interface SquareOptions {
  record: RecordKind;
  measure: Measure;
  firstYear: number;
  lastYear: number;
  /** Only this month. Without it, all months in the year range are added up. */
  month?: { year: number; month: number } | null;
}

/** Fire per map square for the chosen years or month. Only squares with fire. */
export function squareValues(rows: readonly CellRow[], options: SquareOptions): SquareValue[] {
  const { record, measure, firstYear, lastYear, month } = options;
  const byCell = new Map<string, SquareValue>();
  for (const row of rows) {
    const year = row[COL.year];
    if (month) {
      if (year !== month.year || row[COL.month] !== month.month) continue;
    } else if (year < firstYear || year > lastYear) {
      continue;
    }
    const value = rowValue(row, record, measure);
    if (value <= 0) continue;
    const lat = row[COL.lat];
    const lon = row[COL.lon];
    const key = `${lat},${lon}`;
    const square = byCell.get(key);
    if (square) square.value += value;
    else byCell.set(key, { lat, lon, value });
  }
  return [...byCell.values()];
}

/** Squares further apart than this, in degrees, are treated as separate land. */
const GAP = 2;

interface WeightedCell {
  lat: number;
  lon: number;
  weight: number;
}

/**
 * Splits the cells wherever two neighbours along one axis are more than GAP
 * degrees apart, and keeps the group that holds the most fire.
 */
function heaviestGroup(cells: WeightedCell[], axis: "lat" | "lon"): WeightedCell[] {
  const sorted = [...cells].sort((a, b) => a[axis] - b[axis]);
  let best: WeightedCell[] = [];
  let bestWeight = -1;
  let group: WeightedCell[] = [];
  let weight = 0;
  sorted.forEach((cell, i) => {
    if (i > 0 && cell[axis] - sorted[i - 1][axis] > GAP) {
      if (weight > bestWeight) [best, bestWeight] = [group, weight];
      group = [];
      weight = 0;
    }
    group.push(cell);
    weight += cell.weight;
  });
  return weight > bestWeight ? group : best;
}

/**
 * The area the map should show for a country: the part of it that holds the
 * most fire, so far islands do not zoom the map out to the open sea. Without
 * this, Portugal's Azores would put the map in the middle of the Atlantic.
 * Weights are the corrected detections over all years.
 * null for a country without squares.
 */
export function viewBounds(rows: readonly CellRow[]): Bounds | null {
  const byCell = new Map<string, WeightedCell>();
  for (const row of rows) {
    const key = `${row[COL.lat]},${row[COL.lon]}`;
    const cell = byCell.get(key);
    if (cell) cell.weight += row[COL.harmonized];
    else byCell.set(key, { lat: row[COL.lat], lon: row[COL.lon], weight: row[COL.harmonized] });
  }
  if (!byCell.size) return null;
  const main = heaviestGroup(heaviestGroup([...byCell.values()], "lon"), "lat");
  const lats = main.map((c) => c.lat);
  const lons = main.map((c) => c.lon);
  return [
    Math.min(...lons) - HALF_CELL,
    Math.min(...lats) - HALF_CELL,
    Math.max(...lons) + HALF_CELL,
    Math.max(...lats) + HALF_CELL,
  ];
}

export interface SquareProperties {
  value: number;
  /** 0 to 1, from value / max: square root by default, as in the calendar colours. */
  t: number;
}

/**
 * The exact centre of the 0.25° grid square a stored coordinate belongs to.
 * The data stores centres rounded to two decimals (52.12 for 52.125), which
 * would leave thin gaps and overlaps between neighbouring squares on the map.
 */
export function snapToGrid(value: number): number {
  return Math.floor(value / (2 * HALF_CELL)) * 2 * HALF_CELL + HALF_CELL;
}

function colourPosition(fraction: number, scale: "sqrt" | "linear"): number {
  return scale === "sqrt" ? Math.sqrt(fraction) : fraction;
}

/** The squares as GeoJSON polygons, each with its value and colour position. */
export function squaresGeoJSON(
  squares: readonly SquareValue[],
  max: number,
  /** "sqrt" spreads out many small amounts; "linear" suits counts such as years. */
  scale: "sqrt" | "linear" = "sqrt",
): FeatureCollection<Polygon, SquareProperties> {
  const features = squares.map((s): Feature<Polygon, SquareProperties> => {
    const lat = snapToGrid(s.lat);
    const lon = snapToGrid(s.lon);
    const [w, e, south, n] = [lon - HALF_CELL, lon + HALF_CELL, lat - HALF_CELL, lat + HALF_CELL];
    return {
      type: "Feature",
      properties: { value: s.value, t: max > 0 ? colourPosition(Math.min(s.value, max) / max, scale) : 0 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [w, south],
            [e, south],
            [e, n],
            [w, n],
            [w, south],
          ],
        ],
      },
    };
  });
  return { type: "FeatureCollection", features };
}
