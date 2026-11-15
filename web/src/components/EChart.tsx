"use client";

// A chart drawn with Apache ECharts. Only the parts we use are loaded, and
// only in the browser. Pass an option object built with chartColors(), so the
// chart matches light and dark mode.

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { EChartsCoreOption, EChartsType } from "echarts/core";

export interface ChartColors {
  text: string;
  muted: string;
  line: string;
  accent: string;
  /** For estimated years: the accent, lighter. */
  estimate: string;
  trend: string;
}

// Same values as the colour tokens in app/globals.css.
const LIGHT: ChartColors = {
  text: "#1d302e",
  muted: "#60716d",
  line: "#dce3dd",
  accent: "#a74619",
  estimate: "#e8b48a",
  trend: "#287c70",
};
const DARK: ChartColors = {
  text: "#e4ede7",
  muted: "#a4b7ac",
  line: "#32463e",
  accent: "#efa16c",
  estimate: "#7a5333",
  trend: "#7aa2ff",
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Chart colours for the current light or dark mode, updated when it changes. */
export function useChartColors(): ChartColors {
  const dark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
  return dark ? DARK : LIGHT;
}

export function EChart({ option, label, className }: { option: EChartsCoreOption; label: string; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef(option);

  // Create the chart once, and resize it with its box.
  useEffect(() => {
    let cancelled = false;
    let chart: EChartsType | null = null;
    let observer: ResizeObserver | null = null;

    Promise.all([import("echarts/core"), import("echarts/charts"), import("echarts/components"), import("echarts/renderers")])
      .then(([core, charts, components, renderers]) => {
        if (cancelled || !container.current) return;
        core.use([
          charts.BarChart,
          charts.LineChart,
          components.GridComponent,
          components.TooltipComponent,
          components.MarkLineComponent,
          components.AriaComponent,
          renderers.CanvasRenderer,
        ]);
        chart = core.init(container.current);
        chart.setOption(optionRef.current);
        chartRef.current = chart;
        observer = new ResizeObserver(() => chart?.resize());
        observer.observe(container.current);
      })
      .catch(() => {
        if (container.current) container.current.textContent = "The chart could not be loaded.";
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      chartRef.current = null;
      chart?.dispose();
    };
  }, []);

  // Draw new data. notMerge replaces the old option, so removed parts disappear.
  useEffect(() => {
    optionRef.current = option;
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  // Saves the chart as it is drawn now, at double resolution, on a white background.
  const download = () => {
    const url = chartRef.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "chart"}.png`;
    a.click();
  };

  return (
    <div>
      <div ref={container} role="img" aria-label={label} className={className ?? "h-64 w-full"} />
      <button type="button" onClick={download} className="mt-1 text-xs text-muted underline hover:text-foreground">
        Download chart (PNG)
      </button>
    </div>
  );
}
