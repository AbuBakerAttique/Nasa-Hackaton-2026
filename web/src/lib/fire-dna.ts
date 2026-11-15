import { rowValue, type RecordKind } from "./calendar";
import { COL, type CellRow } from "./types";

export interface FireDna {
  total: number;
  peakMonth: number | null;
  monthTotals: number[];
  topThreeMonths: number[];
  topThreeShare: number | null;
  activeYears: number;
  totalYears: number;
  annualVariability: number | null;
}

export interface SensorComparison {
  monthsCompared: number;
  modisTotal: number;
  viirsTotal: number;
  scaledModisTotal: number;
  meanAbsoluteError: number | null;
  meanAbsolutePercentError: number | null;
  signedBiasPercent: number | null;
}

/** A transparent seasonal fingerprint computed from harmonized monthly grid counts. */
export function fireDna(
  rows: readonly CellRow[],
  firstYear: number,
  lastYear: number,
  record: RecordKind = "corrected",
): FireDna {
  const monthTotals = Array<number>(12).fill(0);
  const yearly = Array<number>(Math.max(0, lastYear - firstYear + 1)).fill(0);
  for (const row of rows) {
    const year = row[COL.year];
    const month = row[COL.month];
    if (year < firstYear || year > lastYear || month < 1 || month > 12) continue;
    const count = rowValue(row, record, "count");
    monthTotals[month - 1] += count;
    yearly[year - firstYear] += count;
  }
  const total = monthTotals.reduce((a, b) => a + b, 0);
  const topThreeMonths = monthTotals
    .map((value, index) => ({ value, month: index + 1 }))
    .sort((a, b) => b.value - a.value || a.month - b.month)
    .slice(0, 3)
    .map((item) => item.month)
    .sort((a, b) => a - b);
  const mean = yearly.length ? yearly.reduce((a, b) => a + b, 0) / yearly.length : 0;
  const variance = yearly.length ? yearly.reduce((sum, value) => sum + (value - mean) ** 2, 0) / yearly.length : 0;
  return {
    total,
    peakMonth: total > 0 ? monthTotals.indexOf(Math.max(...monthTotals)) + 1 : null,
    monthTotals,
    topThreeMonths,
    topThreeShare: total > 0 ? topThreeMonths.reduce((sum, month) => sum + monthTotals[month - 1], 0) / total : null,
    activeYears: yearly.filter((value) => value > 0).length,
    totalYears: yearly.length,
    annualVariability: mean > 0 ? Math.sqrt(variance) / mean : null,
  };
}

/** Compare month-level detection totals on the sensor-overlap period. */
export function compareSensors(
  rows: readonly CellRow[],
  ratio: number,
  firstYear = 2012,
  lastYear = 2025,
): SensorComparison {
  const monthly = new Map<string, { modis: number; viirs: number }>();
  // The app ships complete country/year downloads for these years. Seed all
  // calendar months so an absent sparse cell row contributes zero detections
  // rather than silently disappearing from the diagnostic denominator.
  for (let year = firstYear; year <= lastYear; year++) {
    for (let month = 1; month <= 12; month++) monthly.set(`${year}-${month}`, { modis: 0, viirs: 0 });
  }
  for (const row of rows) {
    const year = row[COL.year];
    if (year < firstYear || year > lastYear) continue;
    const key = `${year}-${row[COL.month]}`;
    const value = monthly.get(key) ?? { modis: 0, viirs: 0 };
    value.modis += row[COL.modisRaw];
    value.viirs += row[COL.viirsRaw];
    monthly.set(key, value);
  }
  const pairs = [...monthly.values()];
  const absoluteErrors = pairs.map(({ modis, viirs }) => Math.abs(modis * ratio - viirs));
  const percentErrors = pairs.filter(({ viirs }) => viirs > 0).map(({ modis, viirs }) => Math.abs(modis * ratio - viirs) / viirs);
  const viirsTotal = pairs.reduce((sum, pair) => sum + pair.viirs, 0);
  const bias = pairs.reduce((sum, pair) => sum + pair.modis * ratio - pair.viirs, 0);
  return {
    monthsCompared: pairs.length,
    modisTotal: pairs.reduce((sum, pair) => sum + pair.modis, 0),
    viirsTotal,
    scaledModisTotal: pairs.reduce((sum, pair) => sum + pair.modis * ratio, 0),
    meanAbsoluteError: pairs.length ? absoluteErrors.reduce((a, b) => a + b, 0) / pairs.length : null,
    meanAbsolutePercentError: percentErrors.length ? percentErrors.reduce((a, b) => a + b, 0) / percentErrors.length : null,
    signedBiasPercent: viirsTotal > 0 ? 100 * bias / viirsTotal : null,
  };
}
