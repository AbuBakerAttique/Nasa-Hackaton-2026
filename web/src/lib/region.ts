// A region chosen by the user: a latitude / longitude box or a drawn polygon.
// Decides which map squares and which country files belong to it.
// Plain functions, no React and no map library.

import type { Bounds } from "./map";
import { COL, type CellRow, type CountryEntry } from "./types";

/** A corner point as [longitude, latitude], the GeoJSON order. */
export type LonLat = [lon: number, lat: number];

export type Region =
  | { kind: "box"; south: number; north: number; west: number; east: number }
  | { kind: "polygon"; ring: LonLat[] };

/** The smallest box around the region: west, south, east, north. */
export function regionBounds(region: Region): Bounds {
  if (region.kind === "box") return [region.west, region.south, region.east, region.north];
  const lons = region.ring.map((p) => p[0]);
  const lats = region.ring.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/**
 * Whether a point lies inside a polygon ring, by counting how often a line
 * from the point to the east crosses the edges: an odd count means inside.
 * The ring may or may not repeat its first point at the end.
 */
export function pointInRing(lon: number, lat: number, ring: readonly LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Whether a square belongs to the region: its centre must lie inside.
 * Box edges count as inside, as in the prototype.
 */
export function inRegion(lat: number, lon: number, region: Region): boolean {
  if (region.kind === "box") {
    return lat >= region.south && lat <= region.north && lon >= region.west && lon <= region.east;
  }
  return pointInRing(lon, lat, region.ring);
}

/** The rows whose square lies in the region. */
export function rowsInRegion(rows: readonly CellRow[], region: Region): CellRow[] {
  const [w, s, e, n] = regionBounds(region);
  return rows.filter((r) => {
    const lat = r[COL.lat];
    const lon = r[COL.lon];
    // The quick box test first; the polygon test only for squares near it.
    return lat >= s && lat <= n && lon >= w && lon <= e && inRegion(lat, lon, region);
  });
}

/**
 * The countries whose squares may lie in the region. A region near a border
 * needs both countries: the Brandenburg box reaches into Poland.
 */
export function countriesInRegion(countries: readonly CountryEntry[], region: Region): CountryEntry[] {
  const [w, s, e, n] = regionBounds(region);
  return countries.filter((c) => {
    const [cw, cs, ce, cn] = c.bounds;
    return cw <= e && ce >= w && cs <= n && cn >= s;
  });
}

/** The four box fields as typed by the user. */
export interface BoxInput {
  south: string;
  north: string;
  west: string;
  east: string;
}

/**
 * Reads a typed box. Returns the region, or a message that says what to fix.
 * Accepts a comma as decimal separator, as many European keyboards type it.
 */
export function parseBox(input: BoxInput): { region: Region } | { error: string } {
  const read = (v: string) => (v.trim() === "" ? NaN : Number(v.trim().replace(",", ".")));
  const [south, north, west, east] = [read(input.south), read(input.north), read(input.west), read(input.east)];
  if ([south, north, west, east].some((v) => !Number.isFinite(v))) {
    return { error: "Enter a number in each of the four fields." };
  }
  if (south < -90 || north > 90) return { error: "Latitude must be between -90 and 90." };
  if (west < -180 || east > 180) return { error: "Longitude must be between -180 and 180." };
  if (south >= north) return { error: "South must be smaller than north." };
  if (west >= east) return { error: "West must be smaller than east." };
  return { region: { kind: "box", south, north, west, east } };
}

/** Short description of a region for headings. */
export function regionLabel(region: Region): string {
  if (region.kind === "polygon") return "Drawn area";
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v)}°${v >= 0 ? pos : neg}`;
  return `Box ${f(region.south, "N", "S")} to ${f(region.north, "N", "S")}, ${f(region.west, "E", "W")} to ${f(region.east, "E", "W")}`;
}
