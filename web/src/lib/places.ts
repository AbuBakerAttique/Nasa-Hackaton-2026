// Names the place nearest to a point, for example a clicked map square:
// "8 km northeast of Cottbus, Germany". Uses a bundled list of towns with at
// least 15,000 people (GeoNames, CC BY 4.0), so no web service is called.
// Plain functions; loading the list is in loadPlaces().

/** One town: name, ISO country code, latitude, longitude, population. */
export type Place = [name: string, country: string, lat: number, lon: number, population: number];

/** Towns at least this big count as a "large city". */
export const LARGE_CITY = 100_000;
/** Beyond this distance the town is not called "near". */
export const NEAR_KM = 40;

/** Checks public/data/places.json and returns its places. */
export function parsePlaces(value: unknown): Place[] {
  const places = (value as { places?: unknown })?.places;
  if (!Array.isArray(places)) throw new Error("The place list is not readable.");
  return places.filter(
    (p): p is Place =>
      Array.isArray(p) &&
      p.length === 5 &&
      typeof p[0] === "string" &&
      typeof p[1] === "string" &&
      [p[2], p[3], p[4]].every((v) => typeof v === "number" && Number.isFinite(v)),
  );
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

const DIRECTIONS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"] as const;

/** Compass direction from the first point to the second, in 8 steps. */
export function directionFrom(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return DIRECTIONS[Math.round(bearing / 45) % 8];
}

export interface NearbyPlace {
  name: string;
  country: string;
  km: number;
  /** Direction of the point as seen from the town. */
  direction: string;
}

export interface Nearest {
  town: NearbyPlace | null;
  /** The nearest city of 100,000 or more, when it is not the same as the town. */
  city: NearbyPlace | null;
}

/** The nearest town, and the nearest large city if that is a different place. */
export function nearestPlaces(places: readonly Place[], lat: number, lon: number): Nearest {
  let town: Place | null = null;
  let townKm = Infinity;
  let city: Place | null = null;
  let cityKm = Infinity;
  for (const p of places) {
    const km = distanceKm(lat, lon, p[2], p[3]);
    if (km < townKm) [town, townKm] = [p, km];
    if (p[4] >= LARGE_CITY && km < cityKm) [city, cityKm] = [p, km];
  }
  const describe = (p: Place | null, km: number): NearbyPlace | null =>
    p && { name: p[0], country: p[1], km, direction: directionFrom(p[2], p[3], lat, lon) };
  return { town: describe(town, townKm), city: city === town ? null : describe(city, cityKm) };
}

/** English country name for an ISO code, "DE" → "Germany". */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "8 km northeast of Cottbus, Germany", or "In Cottbus, Germany" when within 3 km. */
export function describePlace(p: NearbyPlace): string {
  const where = `${p.name}, ${countryName(p.country)}`;
  if (p.km < 3) return `In ${where}`;
  return `${Math.round(p.km)} km ${p.direction} of ${where}`;
}

/**
 * One line for the map square, for example
 * "Near Cottbus, Germany (14 km north) · Zielona Góra, Poland 77 km". The square is
 * about 25 km wide, so this names its surroundings, not an exact spot.
 */
export function describeNearest(nearest: Nearest): string | null {
  const { town, city } = nearest;
  if (!town) return null;
  const head =
    town.km <= NEAR_KM
      ? town.km < 3
        ? `In ${town.name}, ${countryName(town.country)}`
        : `Near ${town.name}, ${countryName(town.country)} (${Math.round(town.km)} km ${town.direction})`
      : `Rural area, ${describePlace(town)}`;
  if (!city) return head;
  // Name the country only when the city lies across a border.
  const cityName = city.country === town.country ? city.name : `${city.name}, ${countryName(city.country)}`;
  return `${head} · ${cityName} ${Math.round(city.km)} km`;
}

let cached: Promise<Place[]> | null = null;

/** Loads the place list once; later calls reuse it. A failed load can be tried again. */
export function loadPlaces(fetchImpl: typeof fetch = fetch): Promise<Place[]> {
  if (!cached) {
    cached = fetchImpl("/data/places.json")
      .then((r) => {
        if (!r.ok) throw new Error(`The place list could not be loaded (${r.status}).`);
        return r.json();
      })
      .then(parsePlaces)
      .catch((error: unknown) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}
