"use client";

import { useEffect, useState } from "react";
import { WeatherError, weatherMonthKey, type WeatherMonthQuery } from "@/lib/weather";
import {
  currentMonthlyWeather,
  weatherCache,
  type MonthlyWeatherState,
  type StoredMonthlyWeather,
} from "@/lib/weatherApi";

/** Loads and caches the selected month's hourly ERA5 wind at one map point. */
export function useWeatherMonth(query: WeatherMonthQuery | null): MonthlyWeatherState {
  let key: string | null = null;
  let invalid: string | null = null;
  if (query) {
    try {
      key = weatherMonthKey(query);
    } catch (error) {
      invalid = error instanceof WeatherError ? error.message : "The monthly weather request is not valid.";
    }
  }

  const [stored, setStored] = useState<StoredMonthlyWeather | null>(null);
  useEffect(() => {
    if (!key || !query) return;
    const controller = new AbortController();
    weatherCache.loadMonth(query, controller.signal).then(
      (month) => {
        if (!controller.signal.aborted) setStored({ key, state: { status: "ready", month } });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof WeatherError ? error.message : "Something went wrong while loading monthly wind.";
        setStored({ key, state: { status: "error", message } });
      },
    );
    return () => controller.abort();
    // The key contains all query fields that affect the response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (invalid) return { status: "error", message: invalid };
  return currentMonthlyWeather(stored, key);
}
