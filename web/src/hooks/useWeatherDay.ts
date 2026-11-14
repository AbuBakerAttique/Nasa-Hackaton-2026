"use client";

import { useEffect, useState } from "react";
import { WeatherError, weatherKey, type WeatherQuery } from "@/lib/weather";
import { currentWeather, weatherCache, type StoredWeather, type WeatherState } from "@/lib/weatherApi";

/**
 * Loads one day of ERA5 weather at one point. Pass null while no point or
 * day is chosen. A quick change of point or day cancels the earlier wait and
 * never shows its result: the result is stored with its key, and only the
 * current key's result is shown.
 */
export function useWeatherDay(query: WeatherQuery | null): WeatherState {
  let key: string | null = null;
  let invalid: string | null = null;
  if (query) {
    try {
      key = weatherKey(query);
    } catch (error) {
      invalid = error instanceof WeatherError ? error.message : "The weather request is not valid.";
    }
  }

  const [stored, setStored] = useState<StoredWeather | null>(null);

  useEffect(() => {
    if (!key || !query) return;
    const controller = new AbortController();
    weatherCache.load(query, controller.signal).then(
      (day) => {
        if (!controller.signal.aborted) setStored({ key, state: { status: "ready", day } });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof WeatherError ? error.message : "Something went wrong while loading the weather.";
        setStored({ key, state: { status: "error", message } });
      },
    );
    return () => controller.abort();
    // The key holds everything in the query that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (invalid) return { status: "error", message: invalid };
  return currentWeather(stored, key);
}
