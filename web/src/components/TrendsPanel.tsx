"use client";

// Trend of the yearly totals and how many squares burn each month.
// Only draws what lib/trends.ts calculated.

import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart, useChartColors } from "@/components/EChart";
import { isEstimated, type CalendarTable } from "@/lib/calendar";
import { formatTotal } from "@/lib/format";
import { describeTrend, extentCaution, trendOf, type ExtentSeries } from "@/lib/trends";
import { VIIRS_FIRST_YEAR } from "@/lib/types";

export function TrendsPanel({ table, extent }: { table: CalendarTable; extent: ExtentSeries }) {
  const colors = useChartColors();
  const trend = useMemo(() => trendOf(table), [table]);
  const caution = extentCaution(table.firstYear);

  const axis = useMemo(
    () => ({
      axisLine: { lineStyle: { color: colors.line } },
      axisLabel: { color: colors.muted },
      splitLine: { lineStyle: { color: colors.line } },
    }),
    [colors],
  );

  const trendOption = useMemo((): EChartsCoreOption => {
    const estimated = (year: number) => table.record === "corrected" && isEstimated(year);
    return {
      aria: { enabled: true },
      grid: { left: 56, right: 16, top: 16, bottom: 32 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: unknown) => (typeof v === "number" ? formatTotal(v) : String(v)),
      },
      xAxis: { type: "category", data: trend.years.map(String), ...axis, splitLine: { show: false } },
      yAxis: { type: "value", ...axis },
      series: [
        {
          name: "Year total",
          type: "bar",
          data: trend.totals.map((v, i) => ({
            value: Math.round(v),
            itemStyle: { color: estimated(trend.years[i]) ? colors.estimate : colors.accent },
          })),
        },
        ...(trend.line
          ? [
              {
                name: "Trend (Sen's slope)",
                type: "line",
                data: trend.line.map((v) => Math.round(v)),
                symbol: "none",
                lineStyle: { color: colors.trend, width: 2, type: "dashed" },
                itemStyle: { color: colors.trend },
              },
            ]
          : []),
      ],
    };
  }, [trend, table.record, colors, axis]);

  const extentOption = useMemo((): EChartsCoreOption => {
    const split = extent.labels.indexOf(`${VIIRS_FIRST_YEAR}-01`);
    return {
      aria: { enabled: true },
      grid: { left: 56, right: 16, top: 24, bottom: 32 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: extent.labels, ...axis, splitLine: { show: false } },
      yAxis: { type: "value", minInterval: 1, ...axis },
      series: [
        {
          name: "Squares with detections",
          type: "line",
          data: extent.squares,
          symbol: "none",
          lineStyle: { color: colors.accent, width: 1.5 },
          itemStyle: { color: colors.accent },
          markLine:
            split > 0
              ? {
                  symbol: "none",
                  silent: true,
                  lineStyle: { color: colors.muted, type: "dashed" },
                  label: { formatter: "Newer satellite", color: colors.muted },
                  data: [{ xAxis: split }],
                }
              : undefined,
        },
      ],
    };
  }, [extent, colors, axis]);

  const span = `${table.firstYear} to ${table.lastYear}`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="trend-heading" className="chart-card">
        <h3 id="trend-heading" className="font-semibold">
          Trend in hotspot detections
        </h3>
        <p className="mt-1 text-sm" aria-live="polite">
          {describeTrend(table)}
        </p>
        <EChart
          option={trendOption}
          label={`Bar chart of yearly fire detections, ${span}, with a dashed trend line`}
          className="mt-2 h-64 w-full"
        />
        {table.record === "corrected" && table.firstYear < VIIRS_FIRST_YEAR && (
          <p className="text-xs text-muted">Lighter bars: estimated years before {VIIRS_FIRST_YEAR}.</p>
        )}
      </section>

      <section aria-labelledby="extent-heading" className="chart-card">
        <h3 id="extent-heading" className="font-semibold">
          Grid-cell detection extent
        </h3>
        <p className="mt-1 text-sm text-muted">
          Each map square with at least one filtered detection counts once. Peaks show months when detections were
          geographically widespread, not burned area or fire intensity.
        </p>
        <EChart
          option={extentOption}
          label={`Line chart of map squares with at least one filtered detection per month, ${span}`}
          className="mt-2 h-64 w-full"
        />
        {caution && <p className="mt-1 text-xs text-accent">{caution}</p>}
      </section>
    </div>
  );
}
