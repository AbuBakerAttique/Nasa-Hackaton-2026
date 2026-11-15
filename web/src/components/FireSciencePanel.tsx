"use client";

import { useMemo } from "react";
import { compareSensors, fireDna } from "@/lib/fire-dna";
import type { RecordKind } from "@/lib/calendar";
import { monthName } from "@/lib/format";
import type { CellRow } from "@/lib/types";

const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(0)}%`;
const count = (value: number | null) => value === null ? "—" : Math.round(value).toLocaleString();

export function FireSciencePanel({
  rows,
  firstYear,
  lastYear,
  ratio,
  record,
}: {
  rows: readonly CellRow[];
  firstYear: number;
  lastYear: number;
  ratio: number;
  record: RecordKind;
}) {
  const dna = useMemo(() => fireDna(rows, firstYear, lastYear, record), [rows, firstYear, lastYear, record]);
  const comparison = useMemo(() => compareSensors(rows, ratio), [rows, ratio]);
  const topMonth = Math.max(1, ...dna.monthTotals);

  return (
    <section className="mt-8" aria-labelledby="science-heading">
      <div className="section-heading mb-4">
        <div><p className="eyebrow">04 / TEST THE PATTERN</p><h2 id="science-heading">FireDNA & sensor evidence</h2></div>
        <span className="source-chip source-chip-muted">Computed from this area</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="chart-card" aria-labelledby="dna-heading">
          <p className="eyebrow mb-2">SEASONAL FINGERPRINT</p>
          <h3 id="dna-heading" className="font-semibold">FireDNA: when detections cluster</h3>
          <p className="mt-1 text-sm text-muted">A compact description of the {record} record’s monthly detection pattern for the selected years; it is not a fire-cause classifier.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="metric-tile"><span>Peak month</span><strong>{dna.peakMonth ? monthName(dna.peakMonth) : "No detections"}</strong></div>
            <div className="metric-tile"><span>Top 3 months</span><strong>{percent(dna.topThreeShare)}</strong></div>
            <div className="metric-tile"><span>Active years</span><strong>{dna.activeYears} / {dna.totalYears}</strong></div>
            <div className="metric-tile"><span>Year variability</span><strong>{dna.annualVariability === null ? "—" : `${(dna.annualVariability * 100).toFixed(0)}%`}</strong></div>
          </div>
          <div className="dna-months mt-5" role="img" aria-label={`Monthly profile of ${record} fire detections`}>
            {dna.monthTotals.map((value, i) => (
              <div className="dna-month" key={i} title={`${monthName(i + 1)}: ${Math.round(value).toLocaleString()} detections`}>
                <div className="dna-bar-track"><span style={{ height: `${Math.max(value > 0 ? 3 : 0, (value / topMonth) * 100)}%` }} /></div>
                <small>{monthName(i + 1, true)}</small>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Annual variability is standard deviation ÷ mean. The profile follows the selected {record} record and its sensor coverage.</p>
        </section>

        <section className="chart-card" aria-labelledby="comparison-heading">
          <p className="eyebrow mb-2">SENSOR COMPARISON LAB</p>
          <h3 id="comparison-heading" className="font-semibold">Same months, three views</h3>
          <p className="mt-1 text-sm text-muted">Separate sensor diagnostic · overlap period 2012–2025 · {comparison.monthsCompared} calendar area-months</p>
          <div className="mt-5 overflow-x-auto">
            <table className="comparison-table w-full text-sm">
              <thead><tr><th scope="col">Measure</th><th scope="col">Detections</th></tr></thead>
              <tbody>
                <tr><th scope="row">MODIS observed</th><td>{count(comparison.modisTotal)}</td></tr>
                <tr><th scope="row">VIIRS observed</th><td>{count(comparison.viirsTotal)}</td></tr>
                <tr><th scope="row">MODIS × {ratio.toFixed(3)} ratio</th><td>{count(comparison.scaledModisTotal)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="metric-tile"><span>Mean abs. error / month</span><strong>{count(comparison.meanAbsoluteError)}</strong></div>
            <div className="metric-tile"><span>Mean abs. % error*</span><strong>{percent(comparison.meanAbsolutePercentError)}</strong></div>
            <div className="metric-tile"><span>Signed bias</span><strong>{comparison.signedBiasPercent === null ? "—" : `${comparison.signedBiasPercent >= 0 ? "+" : ""}${comparison.signedBiasPercent.toFixed(1)}%`}</strong></div>
          </div>
          <p className="mt-3 text-xs text-muted">The ratio was learned on the Europe-wide 2012–2021 overlap. This selected-area summary is descriptive, not an independent validation score. *Months with zero VIIRS detections are omitted from percentage error.</p>
        </section>
      </div>
      <p className="mt-3 text-xs text-muted">These are satellite hotspot detections, not counts of independent fires, burned area, ignition causes or future-fire predictions. A zero count means no filtered hotspot records in that period; it does not confirm no fire occurred.</p>
    </section>
  );
}
