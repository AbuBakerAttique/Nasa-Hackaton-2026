import { describe, expect, it } from "vitest";
import {
  WEATHER_ENDPOINT,
  WeatherError,
  buildWeatherUrl,
  compassName,
  describeWind,
  formatMeasure,
  formatPoint,
  formatUtcTime,
  isValidDate,
  monthRange,
  parseWeather,
  weatherKey,
  windTowards,
  type WeatherHour,
} from "./weather";
import { sampleAnswer } from "./weather.fixture";

const query = { lat: 52.5, lon: 13.4, date: "2018-07-25" };

const hour = (over: Partial<WeatherHour>): WeatherHour => ({
  hour: 12,
  windSpeed: 20.3,
  windFrom: 150,
  temperature: 20,
  humidity: 30,
  precipitation: 0,
  ...over,
});

describe("wind direction", () => {
  it("turns where the wind comes FROM into where it blows TO", () => {
    expect(windTowards(270)).toBe(90); // a west wind blows east
    expect(windTowards(0)).toBe(180); // a north wind blows south
    expect(windTowards(150)).toBe(330);
    expect(windTowards(359)).toBe(179);
    expect(windTowards(-90)).toBe(90);
  });

  it("names 16 compass points", () => {
    expect(compassName(0)).toBe("north");
    expect(compassName(360)).toBe("north");
    expect(compassName(11)).toBe("north");
    expect(compassName(12)).toBe("north-northeast");
    expect(compassName(150)).toBe("south-southeast");
    expect(compassName(270)).toBe("west");
    expect(compassName(349)).toBe("north");
  });

  it("describes the wind in plain language", () => {
    expect(describeWind(hour({}))).toBe(
      "Wind from the south-southeast (150°), blowing towards the north-northwest, at 20.3 km/h.",
    );
    expect(describeWind(hour({ windSpeed: 0.4 }))).toBe("Calm: 0.4 km/h.");
  });

  it("says when values are missing", () => {
    expect(describeWind(hour({ windSpeed: null, windFrom: null }))).toBe("No wind estimate for this hour.");
    expect(describeWind(hour({ windFrom: null }))).toBe("Wind at 20.3 km/h; the direction is missing for this hour.");
    expect(describeWind(hour({ windSpeed: null }))).toMatch(/; the speed is missing for this hour\.$/);
  });
});

describe("units and formatting", () => {
  it("shows each value with its unit, or that it is missing", () => {
    expect(formatMeasure(18.25, "°C")).toBe("18.3 °C");
    expect(formatMeasure(40, "%")).toBe("40%");
    expect(formatMeasure(0.2, "mm")).toBe("0.2 mm");
    expect(formatMeasure(null, "mm")).toBe("no value");
  });

  it("formats timestamps in UTC and points with hemispheres", () => {
    expect(formatUtcTime("2017-10-15", 6)).toBe("15 October 2017, 06:00 UTC");
    expect(formatPoint(40.1234, -8.1)).toBe("40.12°N, 8.10°W");
  });

  it("gives the days of a month, also in a leap year", () => {
    expect(monthRange(2016, 2)).toEqual({ min: "2016-02-01", max: "2016-02-29" });
    expect(monthRange(2017, 10)).toEqual({ min: "2017-10-01", max: "2017-10-31" });
  });

  it("accepts only real dates", () => {
    expect(isValidDate("2016-02-29")).toBe(true);
    expect(isValidDate("2017-02-29")).toBe(false);
    expect(isValidDate("2017-13-01")).toBe(false);
    expect(isValidDate("15.10.2017")).toBe(false);
  });
});

describe("the request", () => {
  it("asks for one UTC day of ERA5 with explicit units", () => {
    const url = new URL(buildWeatherUrl(query));
    expect(`${url.origin}${url.pathname}`).toBe(WEATHER_ENDPOINT);
    const p = url.searchParams;
    expect(p.get("models")).toBe("era5");
    expect(p.get("timezone")).toBe("GMT");
    expect(p.get("start_date")).toBe("2018-07-25");
    expect(p.get("end_date")).toBe("2018-07-25");
    expect(p.get("hourly")).toBe("wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m,precipitation");
    expect(p.get("wind_speed_unit")).toBe("kmh");
    expect(p.get("temperature_unit")).toBe("celsius");
    expect(p.get("precipitation_unit")).toBe("mm");
  });

  it("uses one cache key per model, rounded point and day", () => {
    expect(weatherKey({ lat: 52.5012, lon: 13.4049, date: "2018-07-25" })).toBe("era5|52.5|13.4|2018-07-25");
    expect(weatherKey({ lat: 52.5012, lon: 13.4049, date: "2018-07-25" })).toBe(weatherKey(query));
    expect(weatherKey({ ...query, date: "2018-07-26" })).not.toBe(weatherKey(query));
  });

  it("rejects bad points and dates", () => {
    expect(() => buildWeatherUrl({ ...query, lat: 95 })).toThrow(WeatherError);
    expect(() => buildWeatherUrl({ ...query, date: "2018-02-30" })).toThrow('"2018-02-30" is not a valid date.');
  });
});

describe("parseWeather", () => {
  it("reads 24 UTC hours and the grid point the API used", () => {
    const day = parseWeather(sampleAnswer(), query);
    expect(day.hours).toHaveLength(24);
    expect(day.grid).toEqual({ lat: 52.5, lon: 13.5, elevation: 43 });
    expect(day.hours[14]).toEqual({
      hour: 14,
      windSpeed: 10,
      windFrom: 270,
      temperature: 25,
      humidity: 40,
      precipitation: 0,
    });
  });

  it("keeps missing values as null", () => {
    const answer = sampleAnswer();
    answer.hourly.wind_speed_10m[3] = null as unknown as number;
    answer.hourly.wind_direction_10m[3] = null as unknown as number;
    const day = parseWeather(answer, query);
    expect(day.hours[3].windSpeed).toBeNull();
    expect(day.hours[3].windFrom).toBeNull();
    expect(day.hours[4].windSpeed).toBe(5);
  });

  it("refuses API errors, other units, other time zones and wrong hours", () => {
    expect(() => parseWeather({ error: true, reason: "Parameter 'models' invalid" }, query)).toThrow(
      "The weather service refused the request: Parameter 'models' invalid",
    );
    const mph = sampleAnswer();
    mph.hourly_units.wind_speed_10m = "mp/h";
    expect(() => parseWeather(mph, query)).toThrow('wind_speed_10m in "mp/h", expected "km/h"');
    expect(() => parseWeather(sampleAnswer("2018-07-25", { utc_offset_seconds: 7200 }), query)).toThrow(
      "The weather answer is not in UTC.",
    );
    expect(() => parseWeather(sampleAnswer("2018-07-26"), query)).toThrow('time "2018-07-26T00:00", expected 2018-07-25T00:00');
    const short = sampleAnswer();
    short.hourly.time = short.hourly.time.slice(0, 23);
    expect(() => parseWeather(short, query)).toThrow("does not hold 24 hours");
    const text = sampleAnswer();
    text.hourly.precipitation[0] = "0.1" as unknown as number;
    expect(() => parseWeather(text, query)).toThrow("bad precipitation value");
    expect(() => parseWeather("<html>", query)).toThrow("unreadable answer");
  });
});
