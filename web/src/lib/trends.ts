// Trend, extent and frequency: how fire changes over the years, how many
// squares burn each month, and how often each square burned.
// Plain functions, no React and no chart library.

import { rowValue, tableYears, yearTotals, yearTrend, type CalendarTable, type Measure, type RecordKind } from "./calendar";
import { formatTotal } from "./format";
import type { SquareValue } from "./map";
import { median } from "./stats";
import type { TrendTest } from "./stats";
import { COL, VIIRS_FIRST_YEAR, type CellRow } from "./types";

const UNIT = { count: "detections", frp: "MW of heat output" } as const;

export interface YearTrend {
  years: number[];
  totals: number[];
  /** Sen's line at each year: intercept + slope × index. null with fewer than 3 years. */
  line: number[] | null;
  test: TrendTest | null;
}

/** Yearly totals with the Mann-Kendall test and Sen's trend line. */
export function trendOf(table: CalendarTable): YearTrend {
  const totals = yearTotals(table);
  const test = yearTrend(table);
  return {
    years: tableYears(table),
    totals,
    line: test ? totals.map((_, i) => test.intercept + test.slope * i) : null,
    test,
  };
}

/** "p = 0.003", "p < 0.001". */
export function formatP(p: number): string {
  return p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`;
}

/** One sentence about the hotspot-detection trend, with the raw-record warning. */
export function describeTrend(table: CalendarTable): string {
  const { test } = trendOf(table);
  if (!test) return "Choose at least 3 years to test for a trend.";
  const unit = UNIT[table.measure];
  const per = `${formatTotal(Math.abs(test.slope))} ${unit} per year`;
  const sentence =
    test.direction === "none"
      ? `No statistically clear monotonic trend in hotspot detections from ${table.firstYear} to ${table.lastYear} (Mann–Kendall ${formatP(test.p)}).`
      : `The selected record shows a ${test.direction} monotonic trend in hotspot detections of about ${per} from ${table.firstYear} to ${table.lastYear} (Mann–Kendall ${formatP(test.p)}).`;
  const caution = "This test does not adjust for serial correlation or repeated selection of date ranges.";
  if (table.record === "raw" && table.firstYear < VIIRS_FIRST_YEAR && table.lastYear >= VIIRS_FIRST_YEAR) {
    return `${sentence} The raw record switches from MODIS to VIIRS in ${VIIRS_FIRST_YEAR}; that sensor change can look like a change in detections. ${caution}`;
  }
  return `${sentence} ${caution}`;
}

export interface ExtentSeries {
  /** "2001-01" … one label per month in the range. */
  labels: string[];
  /** Number of squares with fire in each month. */
  squares: number[];
}

export interface ExtentOptions {
  record: RecordKind;
  measure: Measure;
  firstYear: number;
  lastYear: number;
}

/** How many map squares had fire in each month: how widespread the fire was. */
export function extentByMonth(rows: readonly CellRow[], options: ExtentOptions): ExtentSeries {
  const { record, measure, firstYear, lastYear } = options;
  const months = (lastYear - firstYear + 1) * 12;
  const squares = new Array<number>(months).fill(0);
  for (const row of rows) {
    const year = row[COL.year];
    if (year < firstYear || year > lastYear) continue;
    if (rowValue(row, record, measure) > 0) squares[(year - firstYear) * 12 + row[COL.month] - 1] += 1;
  }
  const labels = squares.map((_, i) => {
    const year = firstYear + Math.floor(i / 12);
    return `${year}-${String((i % 12) + 1).padStart(2, "0")}`;
  });
  return { labels, squares };
}

/**
 * How many chosen years each square had at least one filtered detection.
 */
export function burnFrequency(rows: readonly CellRow[], options: ExtentOptions): SquareValue[] {
  const { record, measure, firstYear, lastYear } = options;
  const years = new Map<string, { lat: number; lon: number; years: Set<number> }>();
  for (const row of rows) {
    const year = row[COL.year];
    if (year < firstYear || year > lastYear || rowValue(row, record, measure) <= 0) continue;
    const key = `${row[COL.lat]},${row[COL.lon]}`;
    let square = years.get(key);
    if (!square) {
      square = { lat: row[COL.lat], lon: row[COL.lon], years: new Set() };
      years.set(key, square);
    }
    square.years.add(year);
  }
  return [...years.values()].map((s) => ({ lat: s.lat, lon: s.lon, value: s.years.size }));
}

/**
 * The warning for extent and frequency. Count scaling cannot create detections
 * in squares that the older sensor never observed as fire.
 */
export function extentCaution(firstYear: number): string | null {
  if (firstYear >= VIIRS_FIRST_YEAR) return null;
  return `Before ${VIIRS_FIRST_YEAR}, fewer grid squares have a retained detection: the correction raises MODIS counts but cannot add cells MODIS did not detect. Treat pre-${VIIRS_FIRST_YEAR} spatial extent as incomplete; compare extent from ${VIIRS_FIRST_YEAR} onward.`;
}

/** One sentence on how often grid squares had a filtered hotspot detection. */
export function describeFrequency(frequency: readonly SquareValue[], years: number): string {
  if (!frequency.length) return "No square had a filtered hotspot detection in the chosen years.";
  const mid = Math.floor(median(frequency.map((s) => s.value)) ?? 0);
  const every = frequency.filter((s) => s.value === years).length;
  const half = `Half of the ${formatTotal(frequency.length)} squares with detections had at least one in ${mid} of the ${years} years`;
  return every > 0 ? `${half}; ${formatTotal(every)} had a detection in every year.` : `${half}.`;
}
