// How numbers and colours are shown. Plain functions, so the calendar's text
// and colours can be checked against the prototype in a unit test.

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const MONTH_NAMES_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Name of a month, 1 = January. */
export function monthName(month: number, long = false): string {
  const names = long ? MONTH_NAMES_LONG : MONTH_NAMES;
  const name = names[month - 1];
  if (!name) throw new RangeError(`Month ${month} does not exist.`);
  return name;
}

/**
 * Short text for one calendar cell: a whole number, or thousands as "12k"
 * from 10,000 up so the cell stays narrow. Empty when it rounds to 0.
 */
export function formatCell(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return "";
  return rounded >= 10000 ? `${Math.round(rounded / 1000)}k` : String(rounded);
}

/** A whole number with thousands separators, for totals: 12,345. */
export function formatTotal(value: number): string {
  return Math.round(value).toLocaleString("en");
}

/**
 * Heat colour for a cell, from pale yellow (little fire) to deep red (most).
 * The square root spreads out the many small values, so a single extreme
 * month does not turn every other cell pale. Returns null for no fire.
 */
export function heatColour(value: number, max: number): { background: string; color: string } | null {
  if (Math.round(value) === 0 || max <= 0) return null;
  const t = Math.sqrt(Math.min(value, max) / max);
  return {
    background: `hsl(${(38 - 30 * t).toFixed(1)} 90% ${(88 - 58 * t).toFixed(1)}%)`,
    color: t > 0.5 ? "#ffffff" : "#3a1500",
  };
}
