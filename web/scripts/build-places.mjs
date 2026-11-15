// Builds public/data/places.json: towns and cities around our countries, used
// to name the place nearest to a clicked map square ("near Cottbus").
//
// Source: GeoNames cities15000 (all places with at least 15,000 people),
// licensed CC BY 4.0, https://www.geonames.org/. Download and unzip it, then:
//
//   curl -O https://download.geonames.org/export/dump/cities15000.zip
//   unzip cities15000.zip
//   node scripts/build-places.mjs path/to/cities15000.txt
//
// City districts are left out, so the centre of Berlin reads "Berlin", not
// "Mitte". Only places inside the countries' bounds plus a margin are kept, so a
// square near a border can still name a town across it.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARGIN = 2; // degrees around the countries' combined bounds

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/build-places.mjs path/to/cities15000.txt");
  process.exit(1);
}

const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = JSON.parse(await readFile(path.join(webDir, "public/data/index.json"), "utf8"));
const [west, south, east, north] = index.countries.reduce(
  ([w, s, e, n], c) => [Math.min(w, c.bounds[0]), Math.min(s, c.bounds[1]), Math.max(e, c.bounds[2]), Math.max(n, c.bounds[3])],
  [Infinity, Infinity, -Infinity, -Infinity],
);

const places = [];
for (const line of (await readFile(source, "utf8")).split("\n")) {
  if (!line) continue;
  // GeoNames columns: 1 name, 4 latitude, 5 longitude, 7 feature code, 8 country code, 14 population.
  const f = line.split("\t");
  // PPLX is a district of a city (Berlin-Mitte, Kreuzberg …); name the city instead.
  if (f[7] === "PPLX") continue;
  const [name, lat, lon, country, population] = [f[1], Number(f[4]), Number(f[5]), f[8], Number(f[14])];
  if (!name || !country || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(population)) continue;
  if (lat < south - MARGIN || lat > north + MARGIN || lon < west - MARGIN || lon > east + MARGIN) continue;
  places.push([name, country, Math.round(lat * 1000) / 1000, Math.round(lon * 1000) / 1000, population]);
}
places.sort((a, b) => b[4] - a[4]);

const out = {
  source: "GeoNames cities15000, https://www.geonames.org/, CC BY 4.0",
  columns: ["name", "country", "lat", "lon", "population"],
  places,
};
await writeFile(path.join(webDir, "public/data/places.json"), JSON.stringify(out) + "\n");
console.log(`build-places: ${places.length} places written to public/data/places.json`);
