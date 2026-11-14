// A test answer shaped like Open-Meteo's Historical Weather API, for the weather tests.

/** An answer shaped like Open-Meteo's, as seen live for 52.5°N 13.4°E on 2018-07-25. */
export function sampleAnswer(date = "2018-07-25", overrides: Record<string, unknown> = {}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return {
    latitude: 52.5,
    longitude: 13.5,
    generationtime_ms: 0.1,
    utc_offset_seconds: 0,
    timezone: "GMT",
    timezone_abbreviation: "GMT",
    elevation: 43,
    hourly_units: {
      time: "iso8601",
      wind_speed_10m: "km/h",
      wind_direction_10m: "°",
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      precipitation: "mm",
    },
    hourly: {
      time: hours.map((h) => `${date}T${String(h).padStart(2, "0")}:00`),
      wind_speed_10m: hours.map((h) => 3 + h * 0.5),
      wind_direction_10m: hours.map(() => 270),
      temperature_2m: hours.map((h) => 18 + h / 2),
      relative_humidity_2m: hours.map(() => 40),
      precipitation: hours.map(() => 0),
    },
    ...overrides,
  };
}
