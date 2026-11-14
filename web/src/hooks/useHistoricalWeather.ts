"use client";

import { useMemo, useState } from "react";
import type { MonthPick } from "@/components/CalendarGrid";
import type { WeatherMarker } from "@/components/FireMap";
import { useWeatherDay } from "@/hooks/useWeatherDay";
import { describeWind, formatUtcTime, isValidDate, monthRange, windTowards, type WeatherHour } from "@/lib/weather";
import type { WeatherState } from "@/lib/weatherApi";

export interface HistoricalWeather {
  point: { lat: number; lon: number } | null;
  setPoint: (point: { lat: number; lon: number } | null) => void;
  picking: boolean;
  setPicking: (picking: boolean) => void;
  /** The chosen day, or null. Never filled in automatically. */
  date: string | null;
  setDate: (date: string | null) => void;
  /** The chosen hour 0 to 23 UTC, or null. Never filled in automatically. */
  hour: number | null;
  setHour: (hour: number | null) => void;
  /** Allowed days for the date picker: the calendar month if one is picked, else the record. */
  minDate: string;
  maxDate: string;
  state: WeatherState;
  /** The chosen hour's values, when the day has loaded and an hour is chosen. */
  selected: WeatherHour | null;
  marker: WeatherMarker | null;
}

/**
 * State for the historical weather panel: sampling point, day and hour, and
 * the loaded day. The calendar month only narrows the date picker; the day
 * and hour must always be chosen explicitly, because one hour of wind never
 * stands for a whole month.
 */
export function useHistoricalWeather(
  month: MonthPick | null,
  firstYear: number,
  lastYear: number,
): HistoricalWeather {
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [chosenDate, setDate] = useState<string | null>(null);
  const [hour, setHour] = useState<number | null>(null);

  const { min: minDate, max: maxDate } = month
    ? monthRange(month.year, month.month)
    : { min: `${firstYear}-01-01`, max: `${lastYear}-12-31` };

  // A day outside the allowed range (for example after picking another
  // calendar month) is no longer chosen. Derived, so nothing stale is shown.
  const date = chosenDate && isValidDate(chosenDate) && chosenDate >= minDate && chosenDate <= maxDate ? chosenDate : null;

  const query = useMemo(() => (point && date ? { lat: point.lat, lon: point.lon, date } : null), [point, date]);
  const state = useWeatherDay(query);
  const selected = state.status === "ready" && hour !== null ? (state.day.hours[hour] ?? null) : null;

  const marker = useMemo((): WeatherMarker | null => {
    if (!point) return null;
    if (!selected || !date) {
      return { lat: point.lat, lon: point.lon, towards: null, label: "Weather sampling point" };
    }
    return {
      lat: point.lat,
      lon: point.lon,
      towards: selected.windFrom === null ? null : windTowards(selected.windFrom),
      label: `Weather sampling point, ${formatUtcTime(date, selected.hour)}. ${describeWind(selected)}`,
    };
  }, [point, selected, date]);

  return {
    point,
    setPoint,
    picking,
    setPicking,
    date,
    setDate,
    hour,
    setHour,
    minDate,
    maxDate,
    state,
    selected,
    marker,
  };
}
