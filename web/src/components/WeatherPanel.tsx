"use client";

// Historical weather context at one point, for one chosen day and hour.
// Only shows what lib/weather.ts validated. This is context for the fire
// record, not a fire prediction: nothing here changes fire values.

import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import type { MonthPick } from "@/components/CalendarGrid";
import { EChart, useChartColors } from "@/components/EChart";
import type { HistoricalWeather } from "@/hooks/useHistoricalWeather";
import { monthName } from "@/lib/format";
import {
  WEATHER_SOURCE,
  WEATHER_UNITS,
  describeWind,
  formatMeasure,
  formatPoint,
  formatUtcTime,
  compassName,
  type MonthlyWindSummary,
  type WeatherMonth,
  type WeatherDay,
} from "@/lib/weather";

const fieldClass = "mt-1 rounded-md border border-line bg-background px-3 py-2 text-sm";
const buttonClass = "rounded-md border border-line px-3 py-1.5 text-sm hover:border-foreground";

function DailyWindChart({ day, hour }: { day: WeatherDay; hour: number | null }) {
  const colors = useChartColors();
  const option = useMemo(
    (): EChartsCoreOption => ({
      aria: { enabled: true },
      grid: { left: 44, right: 12, top: 16, bottom: 28 },
      tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? `${v} km/h` : "no value") },
      xAxis: {
        type: "category",
        data: day.hours.map((h) => `${String(h.hour).padStart(2, "0")}:00`),
        axisLine: { lineStyle: { color: colors.line } },
        axisLabel: { color: colors.muted, interval: 5 },
      },
      yAxis: {
        type: "value",
        name: "km/h",
        nameTextStyle: { color: colors.muted },
        axisLabel: { color: colors.muted },
        splitLine: { lineStyle: { color: colors.line } },
      },
      series: [
        {
          name: "Wind speed at 10 m",
          type: "line",
          data: day.hours.map((h) => h.windSpeed),
          connectNulls: false,
          symbol: "none",
          lineStyle: { color: colors.trend, width: 2 },
          itemStyle: { color: colors.trend },
          markLine:
            hour === null
              ? undefined
              : {
                  symbol: "none",
                  silent: true,
                  lineStyle: { color: colors.muted, type: "dashed" },
                  label: { formatter: "Chosen hour", color: colors.muted },
                  data: [{ xAxis: hour }],
                },
        },
      ],
    }),
    [day, hour, colors],
  );
  return (
    <EChart
      option={option}
      label={`Line chart of hourly wind speed at 10 m on ${day.query.date}, UTC, at the sampling point`}
      className="mt-2 h-44 w-full"
    />
  );
}

function MonthlyWindChart({ month, summary }: { month: WeatherMonth; summary: MonthlyWindSummary }) {
  const colors = useChartColors();
  const option = useMemo(
    (): EChartsCoreOption => ({
      aria: { enabled: true },
      grid: { left: 48, right: 16, top: 12, bottom: 30 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: unknown) => typeof value === "number" ? `${value.toFixed(1)} km/h` : "no wind estimate",
      },
      xAxis: {
        type: "category",
        data: summary.dailyMeans.map((item) => String(item.day).padStart(2, "0")),
        axisLine: { lineStyle: { color: colors.line } },
        axisLabel: { color: colors.muted, interval: 4 },
        name: "Day of month",
        nameLocation: "middle",
        nameGap: 22,
        nameTextStyle: { color: colors.muted },
      },
      yAxis: {
        type: "value",
        name: "km/h",
        nameTextStyle: { color: colors.muted },
        axisLabel: { color: colors.muted },
        splitLine: { lineStyle: { color: colors.line } },
      },
      series: [{
        name: "Daily mean wind speed at 10 m",
        type: "line",
        data: summary.dailyMeans.map((item) => item.windSpeed),
        connectNulls: false,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: colors.trend, width: 2 },
        itemStyle: { color: colors.trend },
      }],
    }),
    [summary, colors],
  );
  return (
    <EChart
      option={option}
      label={`Daily mean 10 metre wind speed during ${month.query.year}-${String(month.query.month).padStart(2, "0")}, at the selected point`}
      className="mt-2 h-48 w-full"
    />
  );
}

export function WeatherPanel({
  weather,
  month,
  onPickingChange,
  allowPointPicking = true,
}: {
  weather: HistoricalWeather;
  /** The picked month triggers the monthly wind summary and narrows the date picker. */
  month: MonthPick | null;
  /** Turning point picking on must turn region drawing off. */
  onPickingChange: (picking: boolean) => void;
  allowPointPicking?: boolean;
}) {
  const { point, picking, date, hour, minDate, maxDate, state, selected, monthlyState, monthlySummary } = weather;

  return (
    <section aria-labelledby="weather-heading" className="insight-card mt-4 rounded-md border border-line p-4">
      <p className="eyebrow mb-2">WEATHER CONTEXT</p>
      <h3 id="weather-heading" className="font-semibold">
        Historical weather at one point
      </h3>
      <p className="mt-1 text-sm text-muted">
        {WEATHER_SOURCE} for a selected point and month, with optional day-and-hour detail. ERA5 is a reanalysis on a grid of about 25 km: it does not
        show local gusts or winds shaped by valleys and hills. This is context only. It does not explain why a fire
        started and does not predict fire.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <div>
          <span className="block text-sm font-medium">Sampling point</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {allowPointPicking && <button
              type="button"
              aria-pressed={picking}
              onClick={() => onPickingChange(!picking)}
              className={picking ? `${buttonClass} border-accent bg-accent text-background` : buttonClass}
            >
              {picking ? "Click the map…" : point ? "Move the point" : "Choose a point on the map"}
            </button>}
            {point && <span className="text-sm">{formatPoint(point.lat, point.lon)}</span>}
          </div>
        </div>

        <div>
          <label htmlFor="weather-date" className="block text-sm font-medium">
            Day (UTC)
          </label>
          <input
            id="weather-date"
            type="date"
            min={minDate}
            max={maxDate}
            value={date ?? ""}
            onChange={(e) => weather.setDate(e.target.value || null)}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="weather-hour" className="block text-sm font-medium">
            Hour (UTC)
          </label>
          <select
            id="weather-hour"
            value={hour ?? ""}
            onChange={(e) => weather.setHour(e.target.value === "" ? null : Number(e.target.value))}
            className={fieldClass}
          >
            <option value="">Choose an hour</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      </div>

      {month && (
        <section className="mt-4 border-t border-line pt-4" aria-labelledby="monthly-wind-heading" aria-live="polite" aria-busy={monthlyState.status === "loading"}>
          <h4 id="monthly-wind-heading" className="font-semibold">Wind during {monthName(month.month, true)} {month.year}</h4>
          {!point && <p className="mt-2 text-sm text-muted">No fire grid cell is available for this month. Choose a point on the map to load its wind summary.</p>}
          {point && monthlyState.status === "loading" && <p className="mt-2 text-sm text-muted">Loading hourly ERA5 wind for the whole month…</p>}
          {point && monthlyState.status === "error" && (
            <p role="alert" className="mt-2 rounded-md border border-accent px-3 py-2 text-sm text-accent">{monthlyState.message}</p>
          )}
          {point && monthlyState.status === "ready" && monthlySummary && (
            <>
              <p className="mt-1 text-xs text-muted">Nearest ERA5 grid point: {formatPoint(monthlyState.month.grid.lat, monthlyState.month.grid.lon)} · 10 m wind · {monthlySummary.validSpeedHours}/{monthlySummary.expectedHours} hourly speed readings available</p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <div><dt className="text-xs text-muted">Mean hourly speed</dt><dd className="font-medium">{formatMeasure(monthlySummary.meanSpeed, WEATHER_UNITS.wind_speed_10m)}</dd></div>
                <div><dt className="text-xs text-muted">Median hourly speed</dt><dd className="font-medium">{formatMeasure(monthlySummary.medianSpeed, WEATHER_UNITS.wind_speed_10m)}</dd></div>
                <div><dt className="text-xs text-muted">Most frequent direction</dt><dd className="font-medium">{monthlySummary.prevailingFrom === null ? "no direction estimate" : `from ${compassName(monthlySummary.prevailingFrom)} (${Math.round(monthlySummary.prevailingFrom)}°)`}</dd><dd className="text-xs text-muted">{monthlySummary.prevailingShare === null ? "No valid non-calm directions" : `${(monthlySummary.prevailingShare * 100).toFixed(0)}% of ${monthlySummary.directionSamples} non-calm hourly directions`}</dd></div>
              </dl>
              <p className="mt-4 text-sm font-medium">Daily mean wind speed through the month</p>
              <MonthlyWindChart month={monthlyState.month} summary={monthlySummary} />
              <p className="mt-2 text-xs text-muted">Direction is the most frequent 16-point compass sector among non-calm hours. Missing hours remain missing. This is one ERA5 grid point, not a wind average over the selected fire region.</p>
            </>
          )}
        </section>
      )}

      <p className="mt-2 text-xs text-muted">
        {month
          ? `Calendar month selected: ${monthName(month.month, true)} ${month.year}. The sampling point starts at the month’s most active fire grid cell; move it on the map if you want another location. Choose a day and hour below for detailed conditions.`
          : "Pick a day and an hour for detailed weather. Selecting a calendar month also loads its wind summary for the chosen map point."}
      </p>

      <div className="mt-3" aria-live="polite" aria-busy={state.status === "loading"}>
        {!point && <p className="text-sm text-muted">Choose a point on the map to see the weather there.</p>}
        {point && !date && <p className="text-sm text-muted">Choose a day to load its hourly weather.</p>}
        {state.status === "loading" && <p className="text-sm text-muted">Loading ERA5 weather for {date}…</p>}
        {state.status === "error" && (
          <p role="alert" className="rounded-md border border-accent px-3 py-2 text-sm text-accent">
            {state.message}
          </p>
        )}

        {state.status === "ready" && (
          <div>
            <p className="text-sm">
              <span className="font-medium">Location:</span> you chose {formatPoint(state.day.query.lat, state.day.query.lon)};
              the nearest ERA5 grid point is {formatPoint(state.day.grid.lat, state.day.grid.lon)}
              {state.day.grid.elevation !== null && ` at ${Math.round(state.day.grid.elevation)} m`}. These values describe
              that one point, not the whole country or selected area.
            </p>

            {hour === null || !selected ? (
              <p className="mt-2 text-sm text-muted">Choose an hour to see the wind arrow and the values for it.</p>
            ) : (
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="font-medium">Time</dt>
                <dd>{formatUtcTime(state.day.query.date, hour)}</dd>
                <dt className="font-medium">Wind at 10 m</dt>
                <dd>{describeWind(selected)}</dd>
                <dt className="font-medium">Temperature at 2 m</dt>
                <dd>{formatMeasure(selected.temperature, WEATHER_UNITS.temperature_2m)}</dd>
                <dt className="font-medium">Relative humidity at 2 m</dt>
                <dd>{formatMeasure(selected.humidity, WEATHER_UNITS.relative_humidity_2m)}</dd>
                <dt className="font-medium">Precipitation</dt>
                <dd>{formatMeasure(selected.precipitation, WEATHER_UNITS.precipitation)} in the hour before</dd>
              </dl>
            )}

            <div className="mt-4">
              <label htmlFor="weather-slider" className="block text-sm font-medium">
                Step through the day: {hour === null ? "no hour chosen" : `${String(hour).padStart(2, "0")}:00 UTC`}
              </label>
              <input
                id="weather-slider"
                type="range"
                min={0}
                max={23}
                step={1}
                value={hour ?? 12}
                disabled={hour === null}
                aria-valuetext={hour === null ? "No hour chosen" : `${String(hour).padStart(2, "0")}:00 UTC`}
                onChange={(e) => weather.setHour(Number(e.target.value))}
                className="mt-1 w-full max-w-md accent-[var(--accent)] disabled:opacity-40"
              />
            </div>

            <p className="mt-3 text-sm font-medium">Wind speed through the day, km/h at 10 m</p>
            <DailyWindChart day={state.day} hour={hour} />

            <p className="mt-2 rounded-md border border-line px-3 py-2 text-xs text-muted">
              The fire squares on the map are monthly totals. They do not change with the hour: there are no hourly
              fire observations here. The arrow on the map points where the wind blows to.
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        Weather data:{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">
          Open-Meteo.com
        </a>{" "}
        Historical Weather API, licensed{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">
          CC BY 4.0
        </a>
        . ERA5 reanalysis: generated using Copernicus Climate Change Service information. Times in UTC.
      </p>
    </section>
  );
}
