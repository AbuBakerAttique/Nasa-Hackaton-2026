// Historical weather context from Open-Meteo's Historical Weather API, using
// the ERA5 reanalysis only. This module builds the request, checks the
// answer and turns it into plain language. No fetching and no React here.
//
// Weather is context only. Nothing here changes fire counts, the
// harmonization or anything the fire record says.
//
// API: https://open-meteo.com/en/docs/historical-weather-api
// Terms: free for non-commercial use, CC BY 4.0, https://open-meteo.com/en/terms

/** Open-Meteo's archive endpoint. */
export const WEATHER_ENDPOINT = "https://archive-api.open-meteo.com/v1/archive";

/** ERA5 only, so every year 2001 to 2025 comes from the same model. */
export const WEATHER_MODEL = "era5";

/** All times are requested and shown in UTC ("GMT" in the API). */
export const WEATHER_TIMEZONE = "GMT";

/** The hourly variables requested, in the API's own names. */
export const WEATHER_VARIABLES = [
  "wind_speed_10m",
  "wind_direction_10m",
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const;

/** Units we ask for and expect back. A different unit is treated as an error. */
export const WEATHER_UNITS = {
  wind_speed_10m: "km/h",
  wind_direction_10m: "°",
  temperature_2m: "°C",
  relative_humidity_2m: "%",
  precipitation: "mm",
} as const;

export const WEATHER_SOURCE = "ERA5 historical weather estimates";

/** A request: one point and one day. */
export interface WeatherQuery {
  lat: number;
  lon: number;
  /** "YYYY-MM-DD", a UTC calendar day. */
  date: string;
}

/** One hour of weather. Any value may be missing in the source. */
export interface WeatherHour {
  /** 0 to 23, UTC. */
  hour: number;
  /** km/h at 10 m. */
  windSpeed: number | null;
  /** Degrees the wind comes FROM, 0 = north, 90 = east (meteorological). */
  windFrom: number | null;
  /** °C at 2 m. */
  temperature: number | null;
  /** % at 2 m. */
  humidity: number | null;
  /** mm in the hour before this time. */
  precipitation: number | null;
}

/** One validated day of weather at one point. */
export interface WeatherDay {
  query: WeatherQuery;
  /** The ERA5 grid point the API answered for, which differs from the requested point. */
  grid: { lat: number; lon: number; elevation: number | null };
  /** 24 entries, 00:00 to 23:00 UTC. */
  hours: WeatherHour[];
}

/** An error whose message is written for the person using the app. */
export class WeatherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeatherError";
  }
}

/** A date as "YYYY-MM-DD" that really exists, for example not "2021-02-30". */
export function isValidDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** Coordinates rounded to 0.01° (about 1 km): far finer than the 25 km grid, and stable cache keys. */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Checks a query and returns it with rounded coordinates. Throws a WeatherError. */
export function normaliseQuery(query: WeatherQuery): WeatherQuery {
  const lat = roundCoord(query.lat);
  const lon = roundCoord(query.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new WeatherError("The latitude must be between -90 and 90.");
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new WeatherError("The longitude must be between -180 and 180.");
  }
  if (!isValidDate(query.date)) throw new WeatherError(`"${query.date}" is not a valid date.`);
  return { lat, lon, date: query.date };
}

/** Cache key: model, point and day. */
export function weatherKey(query: WeatherQuery): string {
  const q = normaliseQuery(query);
  return `${WEATHER_MODEL}|${q.lat}|${q.lon}|${q.date}`;
}

/** The request URL for one day at one point. */
export function buildWeatherUrl(query: WeatherQuery): string {
  const q = normaliseQuery(query);
  const params = new URLSearchParams({
    latitude: String(q.lat),
    longitude: String(q.lon),
    start_date: q.date,
    end_date: q.date,
    hourly: WEATHER_VARIABLES.join(","),
    models: WEATHER_MODEL,
    timezone: WEATHER_TIMEZONE,
    wind_speed_unit: "kmh",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
    timeformat: "iso8601",
  });
  return `${WEATHER_ENDPOINT}?${params}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** A number, or null for a missing value. Anything else is a format error. */
function readValue(values: unknown[], i: number, name: string): number | null {
  const v = values[i];
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new WeatherError(`The weather answer has a bad ${name} value.`);
  return v;
}

/**
 * Checks an API answer and turns it into a WeatherDay. Throws a WeatherError
 * for an API error, an unexpected format, other units, a time zone other than
 * UTC, or hours that do not belong to the requested day.
 */
export function parseWeather(value: unknown, query: WeatherQuery): WeatherDay {
  const q = normaliseQuery(query);
  if (!isRecord(value)) throw new WeatherError("The weather service sent an unreadable answer.");
  if (value.error === true) {
    const reason = typeof value.reason === "string" ? value.reason : "no reason given";
    throw new WeatherError(`The weather service refused the request: ${reason}`);
  }
  if (value.utc_offset_seconds !== 0) throw new WeatherError("The weather answer is not in UTC.");

  const { latitude, longitude, elevation, hourly, hourly_units: units } = value;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !isRecord(hourly) || !isRecord(units)) {
    throw new WeatherError("The weather answer is missing its location or hourly data.");
  }
  for (const [name, unit] of Object.entries(WEATHER_UNITS)) {
    if (units[name] !== unit) {
      throw new WeatherError(`The weather answer gives ${name} in "${String(units[name])}", expected "${unit}".`);
    }
  }

  const times = hourly.time;
  if (!Array.isArray(times) || times.length !== 24) {
    throw new WeatherError("The weather answer does not hold 24 hours for this day.");
  }
  const columns = Object.fromEntries(
    WEATHER_VARIABLES.map((name) => {
      const column = hourly[name];
      if (!Array.isArray(column) || column.length !== 24) throw new WeatherError(`The weather answer is missing ${name}.`);
      return [name, column as unknown[]];
    }),
  ) as Record<(typeof WEATHER_VARIABLES)[number], unknown[]>;

  const hours = times.map((time, i): WeatherHour => {
    const expected = `${q.date}T${String(i).padStart(2, "0")}:00`;
    if (time !== expected) throw new WeatherError(`The weather answer has the time "${String(time)}", expected ${expected}.`);
    return {
      hour: i,
      windSpeed: readValue(columns.wind_speed_10m, i, "wind speed"),
      windFrom: readValue(columns.wind_direction_10m, i, "wind direction"),
      temperature: readValue(columns.temperature_2m, i, "temperature"),
      humidity: readValue(columns.relative_humidity_2m, i, "humidity"),
      precipitation: readValue(columns.precipitation, i, "precipitation"),
    };
  });

  return {
    query: q,
    grid: { lat: latitude, lon: longitude, elevation: typeof elevation === "number" ? elevation : null },
    hours,
  };
}

const COMPASS = [
  "north", "north-northeast", "northeast", "east-northeast",
  "east", "east-southeast", "southeast", "south-southeast",
  "south", "south-southwest", "southwest", "west-southwest",
  "west", "west-northwest", "northwest", "north-northwest",
] as const;

/** Any angle as 0 to 360. */
export function normaliseDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** The 16-point compass name of a direction: 150° is "south-southeast". */
export function compassName(deg: number): string {
  return COMPASS[Math.round(normaliseDegrees(deg) / 22.5) % 16];
}

/**
 * The direction the wind blows TOWARDS. Weather data gives where it comes
 * FROM: a 270° (west) wind travels east, to 90°. The map arrow uses this.
 */
export function windTowards(fromDeg: number): number {
  return normaliseDegrees(fromDeg + 180);
}

/** "Wind from the south-southeast (150°), blowing towards the north-northwest, at 20.3 km/h." */
export function describeWind(hour: WeatherHour): string {
  const { windSpeed: speed, windFrom: from } = hour;
  if (speed === null && from === null) return "No wind estimate for this hour.";
  if (speed !== null && speed < 1) return `Calm: ${formatNumber(speed)} km/h.`;
  if (from === null) return `Wind at ${formatNumber(speed!)} km/h; the direction is missing for this hour.`;
  const base = `Wind from the ${compassName(from)} (${Math.round(normaliseDegrees(from))}°), blowing towards the ${compassName(windTowards(from))}`;
  return speed === null ? `${base}; the speed is missing for this hour.` : `${base}, at ${formatNumber(speed)} km/h.`;
}

/** One decimal, without a trailing ".0". */
export function formatNumber(v: number): string {
  return String(Math.round(v * 10) / 10);
}

/** A value with its unit, or "no value". */
export function formatMeasure(v: number | null, unit: string): string {
  if (v === null) return "no value";
  return unit === "%" || unit === "°C" ? `${formatNumber(v)}${unit === "%" ? "%" : " °C"}` : `${formatNumber(v)} ${unit}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "15 October 2017, 12:00 UTC". */
export function formatUtcTime(date: string, hour: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}, ${String(hour).padStart(2, "0")}:00 UTC`;
}

/** First and last day of a month as "YYYY-MM-DD", for the date picker. */
export function monthRange(year: number, month: number): { min: string; max: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { min: `${year}-${mm}-01`, max: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/** "52.50°N, 13.40°E". */
export function formatPoint(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
}
