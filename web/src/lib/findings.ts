// Statements for fire services and forest managers, written from a calendar
// table. Plain functions that return sentences, so the wording can be tested.

import {
  compareYear,
  isEstimated,
  mainSeason,
  rankMonth,
  tableTotal,
  typicalYear,
  worstYear,
  type CalendarTable,
} from "./calendar";
import { formatTotal, monthName } from "./format";
import { VIIRS_FIRST_YEAR } from "./types";

const UNIT = { count: "detections", frp: "MW of heat output" } as const;

/** Fewer years than this give no meaningful "typical year". */
export const MIN_YEARS_TO_COMPARE = 3;

/** "April", "April and July", "April, July and August". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** A change as words: "99% above", "19% below", "about the same as". */
export function describeChange(change: number): string {
  const pct = Math.round(Math.abs(change) * 100);
  if (pct < 5) return "about the same as";
  return `${pct}% ${change > 0 ? "above" : "below"}`;
}

export interface TableFindings {
  /** Which months hold most of the fire. null without fire. */
  season: string | null;
  /** The year with the most fire. null without fire or with too few years. */
  worst: string | null;
  /** The last year in the range against a typical year. null when not comparable. */
  latest: string | null;
  /** Something the reader must know before trusting the statements. */
  caution: string | null;
}

/** The headline statements for a whole table. */
export function describeTable(table: CalendarTable): TableFindings {
  const unit = UNIT[table.measure];
  const years = table.lastYear - table.firstYear + 1;
  const span = years === 1 ? `${table.firstYear}` : `${table.firstYear} to ${table.lastYear}`;

  if (tableTotal(table) <= 0) {
    return { season: null, worst: null, latest: null, caution: `No retained hotspot ${unit} in this area from ${span}; this does not prove that no fire occurred.` };
  }

  const s = mainSeason(table)!;
  const season = `${joinNames(s.months.map((m) => monthName(m, true)))} hold ${Math.round(s.share * 100)}% of all ${unit} from ${span}.`;

  const caution =
    table.record === "raw"
      ? `These statements use the raw timeline, which switches from MODIS to VIIRS in ${VIIRS_FIRST_YEAR}. The sensors have different detection characteristics, so that transition can distort a time comparison.`
      : null;

  if (years < MIN_YEARS_TO_COMPARE) {
    return {
      season,
      worst: null,
      latest: null,
      caution: caution ?? `Choose at least ${MIN_YEARS_TO_COMPARE} years to compare years with each other.`,
    };
  }

  const typical = typicalYear(table);
  const w = worstYear(table)!;
  const estimated = (year: number) => (table.record === "corrected" && isEstimated(year) ? " (estimated)" : "");
  const worst =
    w.timesTypical === null
      ? `${w.year}${estimated(w.year)}, with ${formatTotal(w.total)} ${unit}. A typical year has none.`
      : `${w.year}${estimated(w.year)}, with ${w.timesTypical.toFixed(1)} times a typical year: ${formatTotal(w.total)} ${unit} against a median of ${formatTotal(typical)}.`;

  const c = compareYear(table, table.lastYear);
  const latest =
    c.change === null
      ? null
      : `${c.year}: ${formatTotal(c.total)} ${unit}, ${describeChange(c.change)} a typical year${c.year === w.year ? ". It is the worst year in the range" : ""}.`;

  return { season, worst, latest, caution };
}

export interface MonthFindings {
  /** "July 2018: 882 detections." */
  headline: string;
  /** Where it ranks among the same month in the other years. */
  rank: string;
  /** Against the median and the average of that month. */
  typical: string;
}

/** Statements about one month against the same month in every other year. */
export function describeMonth(table: CalendarTable, year: number, month: number): MonthFindings {
  const unit = UNIT[table.measure];
  const name = monthName(month, true);
  const r = rankMonth(table, year, month);
  const estimated = table.record === "corrected" && isEstimated(year) ? " (estimated)" : "";

  const headline = `${name} ${year}: ${formatTotal(r.value)} ${unit}${estimated}.`;

  let rank: string;
  if (r.others === 0) rank = `There is no other ${name} in the chosen years to compare with.`;
  else if (r.below === r.others) rank = `The highest ${name} on record: more than all ${r.others} other ${name} months.`;
  else if (r.below === 0 && r.value < Math.min(...otherValues(table, year, month)))
    rank = `The lowest ${name} on record: less than all ${r.others} other ${name} months.`;
  else rank = `More than ${r.below} of the ${r.others} other ${name} months.`;

  const vsMean = r.mean > 0 ? `, so this ${name} is ${describeChange(r.value / r.mean - 1)} the average` : "";
  const typical = `A typical ${name} (the median) has ${formatTotal(r.median)}. The average ${name} has ${formatTotal(r.mean)}${vsMean}.`;

  return { headline, rank, typical };
}

function otherValues(table: CalendarTable, year: number, month: number): number[] {
  return table.values.filter((_, i) => i !== year - table.firstYear).map((row) => row[month - 1]);
}
