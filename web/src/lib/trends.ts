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

/** One sentence about the trend, with the raw-record warning where it matters. */
export function describeTrend(table: CalendarTable): string {
  const { test } = trendOf(table);
  if (!test) return "Choose at least 3 years to test for a trend.";
  const unit = UNIT[table.measure];
  const per = `${formatTotal(Math.abs(test.slope))} ${unit} per year`;
  const sentence =
    test.direction === "none"
      ? `No clear trend from ${table.firstYear} to ${table.lastYear} (${formatP(test.p)}). Ups and downs of this size happen by chance.`
      : `Fire activity is ${test.direction} by about ${per} from ${table.firstYear} to ${table.lastYear}. This is unlikely to be chance (${formatP(test.p)}).`;
  if (table.record === "raw" && table.firstYear < VIIRS_FIRST_YEAR && table.lastYear >= VIIRS_FIRST_YEAR) {
    return `${sentence} Careful: the raw record jumps in ${VIIRS_FIRST_YEAR} because the newer satellite sees more fires, which looks like a rise. Use the corrected record for trends.`;
  }
  return sentence;
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
 * How many of the chosen years each square had any fire. A square that burns
 * every year is a fire hotspot; one that burned once had a single event.
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
 * The warning for extent and frequency. The correction scales up the older
 * satellite's counts, but cannot add fire in squares where it saw none, so
 * before 2012 fewer squares burn than the newer satellite would have shown.
 */
export function extentCaution(firstYear: number): string | null {
  if (firstYear >= VIIRS_FIRST_YEAR) return null;
  return `Before ${VIIRS_FIRST_YEAR}, fewer squares show fire in both records: the older satellite missed small fires, and the correction raises its counts but cannot add squares where it saw nothing. Compare years from ${VIIRS_FIRST_YEAR} on.`;
}

/** One sentence on how often squares burn: "Half of the 660 squares …". */
export function describeFrequency(frequency: readonly SquareValue[], years: number): string {
  if (!frequency.length) return "No square had fire in the chosen years.";
  const mid = Math.floor(median(frequency.map((s) => s.value)) ?? 0);
  const every = frequency.filter((s) => s.value === years).length;
  const half = `Half of the ${formatTotal(frequency.length)} squares with fire burned in at least ${mid} of the ${years} years`;
  return every > 0 ? `${half}; ${formatTotal(every)} burned every year.` : `${half}.`;
}
