// Fire calendar calculations: turn country rows into a year-by-month table and
// read statements from it. Plain functions only, no React, so every number on
// screen can be unit tested. Months are 1 to 12 everywhere, as in the data.

import { mannKendall, mean, median, sum, type TrendTest } from "./stats";
import { COL, VIIRS_FIRST_YEAR, type CellRow } from "./types";

/**
 * Which record to read.
 * - "raw": the older sensor (MODIS) until 2011, the newer one (VIIRS) from 2012.
 *   Totals jump at 2012 because the sensors differ, not because fire changed.
 * - "corrected": the harmonized record, on the VIIRS scale for all years.
 */
export type RecordKind = "raw" | "corrected";

/** What to count: detections, or heat output (FRP, in megawatts). */
export type Measure = "count" | "frp";

export interface TableOptions {
  record: RecordKind;
  measure: Measure;
  /** First year to include. */
  firstYear: number;
  /** Last year to include. */
  lastYear: number;
}

/** A year-by-month table. values[y][m] is year firstYear + y, month m + 1. */
export interface CalendarTable {
  record: RecordKind;
  measure: Measure;
  firstYear: number;
  lastYear: number;
  /** One row per year, each with 12 month values. */
  values: number[][];
}

/** The value of one row in the chosen record and measure. */
export function rowValue(row: CellRow, record: RecordKind, measure: Measure): number {
  if (record === "corrected") {
    return measure === "count" ? row[COL.harmonized] : row[COL.harmonizedFrp];
  }
  const viirs = row[COL.year] >= VIIRS_FIRST_YEAR;
  if (measure === "count") return viirs ? row[COL.viirsRaw] : row[COL.modisRaw];
  return viirs ? row[COL.viirsFrp] : row[COL.modisFrp];
}

/** True when the corrected value for this year is an estimate, not a measurement. */
export function isEstimated(year: number): boolean {
  return year < VIIRS_FIRST_YEAR;
}

/**
 * Adds up all map squares into one value per year and month. Years in the
 * range without any rows get zeros. Rows outside the range are ignored.
 */
export function buildTable(rows: readonly CellRow[], options: TableOptions): CalendarTable {
  const { record, measure, firstYear, lastYear } = options;
  if (!Number.isInteger(firstYear) || !Number.isInteger(lastYear) || firstYear > lastYear) {
    throw new RangeError(`Invalid year range ${firstYear} to ${lastYear}.`);
  }
  const values = Array.from({ length: lastYear - firstYear + 1 }, () => new Array<number>(12).fill(0));
  for (const row of rows) {
    const year = row[COL.year];
    const month = row[COL.month];
    if (year < firstYear || year > lastYear || month < 1 || month > 12) continue;
    values[year - firstYear][month - 1] += rowValue(row, record, measure);
  }
  return { record, measure, firstYear, lastYear, values };
}

/** The years in the table, in order. */
export function tableYears(table: CalendarTable): number[] {
  return table.values.map((_, i) => table.firstYear + i);
}

/** One value from the table. Throws for a year or month outside it. */
export function cellOf(table: CalendarTable, year: number, month: number): number {
  const row = table.values[year - table.firstYear];
  if (!row || month < 1 || month > 12) {
    throw new RangeError(`${year}-${month} is outside the table.`);
  }
  return row[month - 1];
}

/** Total per year, in year order. */
export function yearTotals(table: CalendarTable): number[] {
  return table.values.map((row) => sum(row));
}

/** Total per calendar month over all years, January first. */
export function monthTotals(table: CalendarTable): number[] {
  return Array.from({ length: 12 }, (_, m) => sum(table.values.map((row) => row[m])));
}

/** The value of one calendar month in every year, in year order. */
export function monthSeries(table: CalendarTable, month: number): number[] {
  if (month < 1 || month > 12) throw new RangeError(`Month ${month} does not exist.`);
  return table.values.map((row) => row[month - 1]);
}

/** Grand total of the table. */
export function tableTotal(table: CalendarTable): number {
  return sum(yearTotals(table));
}

export interface MonthRank {
  year: number;
  month: number;
  value: number;
  /** How many of the other years had a lower value in this month. */
  below: number;
  /** How many other years there are to compare with. */
  others: number;
  /** Median of this month over all years, the "typical" month. */
  median: number;
  /** Average of this month over all years. */
  mean: number;
}

/** How one month compares with the same month in every other year. */
export function rankMonth(table: CalendarTable, year: number, month: number): MonthRank {
  const value = cellOf(table, year, month);
  const series = monthSeries(table, month);
  const others = series.filter((_, i) => i !== year - table.firstYear);
  return {
    year,
    month,
    value,
    below: others.filter((v) => v < value).length,
    others: others.length,
    median: median(series) ?? 0,
    mean: mean(series) ?? 0,
  };
}

export interface MainSeason {
  /** The busiest months, in calendar order. */
  months: number[];
  /** Share of the table total that falls in these months, 0 to 1. */
  share: number;
}

/**
 * The busiest months of the year over the whole table. Ties go to the earlier
 * month. null when the table holds no fire at all.
 */
export function mainSeason(table: CalendarTable, size = 3): MainSeason | null {
  const totals = monthTotals(table);
  const total = sum(totals);
  if (total <= 0) return null;
  const top = totals
    .map((value, i) => ({ value, month: i + 1 }))
    .sort((a, b) => b.value - a.value || a.month - b.month)
    .slice(0, size);
  return {
    months: top.map((t) => t.month).sort((a, b) => a - b),
    share: sum(top.map((t) => t.value)) / total,
  };
}

/** Median of the year totals: what a typical year looks like. */
export function typicalYear(table: CalendarTable): number {
  return median(yearTotals(table)) ?? 0;
}

export interface WorstYear {
  year: number;
  total: number;
  /** Total divided by the typical year. null when the typical year is 0. */
  timesTypical: number | null;
}

/** The year with the highest total. Ties go to the earlier year. null without fire. */
export function worstYear(table: CalendarTable): WorstYear | null {
  const totals = yearTotals(table);
  let best = 0;
  for (let i = 1; i < totals.length; i++) if (totals[i] > totals[best]) best = i;
  if (totals[best] <= 0) return null;
  const typical = typicalYear(table);
  return {
    year: table.firstYear + best,
    total: totals[best],
    timesTypical: typical > 0 ? totals[best] / typical : null,
  };
}

export interface YearComparison {
  year: number;
  total: number;
  typical: number;
  /** Difference from the typical year as a fraction, 0.25 = 25% above. null when typical is 0. */
  change: number | null;
}

/** One year's total against the typical year. */
export function compareYear(table: CalendarTable, year: number): YearComparison {
  const total = yearTotals(table)[year - table.firstYear];
  if (total === undefined) throw new RangeError(`${year} is outside the table.`);
  const typical = typicalYear(table);
  return { year, total, typical, change: typical > 0 ? total / typical - 1 : null };
}

/**
 * Mann-Kendall trend test on the yearly totals. The slope is per year.
 * Only fair on the corrected record: on the raw one the 2012 sensor change
 * looks like a rise in fire.
 */
export function yearTrend(table: CalendarTable, alpha = 0.05): TrendTest | null {
  return mannKendall(yearTotals(table), alpha);
}
