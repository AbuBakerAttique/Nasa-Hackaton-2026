import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  countryName,
  describeNearest,
  directionFrom,
  distanceKm,
  loadPlaces,
  nearestPlaces,
  parsePlaces,
  type Place,
} from "./places";

const places = parsePlaces(
  JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/places.json", import.meta.url)), "utf8")),
);
const at = (lat: number, lon: number) => describeNearest(nearestPlaces(places, lat, lon));

describe("geometry", () => {
  it("measures distances", () => {
    // Berlin to Cottbus is about 110 km.
    expect(distanceKm(52.524, 13.411, 51.758, 14.329)).toBeGreaterThan(100);
    expect(distanceKm(52.524, 13.411, 51.758, 14.329)).toBeLessThan(115);
    expect(distanceKm(50, 10, 50, 10)).toBe(0);
  });

  it("gives the direction of a point as seen from a town", () => {
    expect(directionFrom(50, 10, 51, 10)).toBe("north");
    expect(directionFrom(50, 10, 50, 11)).toBe("east");
    expect(directionFrom(50, 10, 49.5, 9.3)).toBe("southwest");
  });

  it("names countries in English", () => {
    expect(countryName("DE")).toBe("Germany");
    expect(countryName("PT")).toBe("Portugal");
  });
});

describe("the place list", () => {
  it("covers the 16 countries with thousands of towns", () => {
    expect(places.length).toBeGreaterThan(5000);
    expect(places.some((p) => p[0] === "Cottbus" && p[1] === "DE")).toBe(true);
  });

  it("skips malformed entries", () => {
    expect(parsePlaces({ places: [["A", "DE", 50, 10, 20000], ["B", "DE", "50", 10, 1], ["C"]] })).toHaveLength(1);
    expect(() => parsePlaces({})).toThrow("not readable");
  });
});

describe("naming a clicked square", () => {
  // The nearest city of 100,000+ is Zielona Góra across the border (77 km),
  // closer than Berlin (about 110 km); its country is named.
  it("names a square next to Cottbus, and the nearest large city across the border", () => {
    expect(at(51.88, 14.38)).toBe("Near Cottbus, Germany (14 km north) · Zielona Góra, Poland 77 km");
  });

  it("does not name the country of a large city in the same country", () => {
    expect(at(51.38, 12.12)).toMatch(/· (Leipzig|Halle \(Saale\)) \d+ km$/);
  });

  it("says 'In' when the square centre is in the town", () => {
    expect(at(51.758, 14.329)).toMatch(/^In Cottbus, Germany/);
  });

  it("does not repeat a large city that is itself the nearest town", () => {
    expect(at(52.52, 13.41)).toBe("In Berlin, Germany");
  });

  it("names the square of the dialog in the screenshot (50.12°N, 11.88°E)", () => {
    expect(at(50.12, 11.88)).toMatch(/^Near [^,]+, Germany \(\d+ km \w+\)/);
  });

  it("calls a far-away town a rural area", () => {
    const list: Place[] = [["Smallville", "SE", 60, 15, 20000]];
    expect(describeNearest(nearestPlaces(list, 61, 15))).toBe("Rural area, 111 km north of Smallville, Sweden");
    expect(describeNearest(nearestPlaces([], 61, 15))).toBeNull();
  });
});

describe("loadPlaces", () => {
  it("can try again after a failed download", async () => {
    const failing = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
    await expect(loadPlaces(failing)).rejects.toThrow("(503)");
    const working = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ places: [["A", "DE", 50, 10, 20000]] }) }) as Response);
    await expect(loadPlaces(working)).resolves.toHaveLength(1);
  });
});
