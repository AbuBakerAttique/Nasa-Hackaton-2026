// Downloads: the calendar and the grid squares as CSV, the calendar as an SVG
// image. Plain functions that return text, so every exported value is tested.
// Components only turn the text into a file.

import { isCompleteYear, isEstimated, isObserved, rowValue, tableYears, yearTotals, type CalendarTable } from "./calendar";
import { MONTH_NAMES, heatColour } from "./format";
import { COL, type CellRow, type CurrentYear } from "./types";

type Cell = string | number | null | undefined;

/** One CSV field: quoted when it holds a comma, quote or line break. */
function field(value: Cell): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(Math.round(value * 1000) / 1000) : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Rows to CSV text, with Windows line ends so spreadsheet programs open it cleanly. */
export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return rows.map((row) => row.map(field).join(",")).join("\r\n") + "\r\n";
}

/** "estimated", "provisional", "part year" or "" for one year of a table. */
function yearStatus(table: CalendarTable, year: number, current?: CurrentYear): string {
  const notes: string[] = [];
  if (table.record === "corrected" && isEstimated(year)) notes.push("estimated from MODIS");
  if (!isCompleteYear(table, year)) notes.push(`part year, data to ${current?.lastDate ?? "the last complete month"}`);
  if (current?.year === year) notes.push(`provisional from ${current.provisionalFrom}`);
  return notes.join("; ");
}

/**
 * The calendar as CSV: one line per year, one column per month, then the year
 * total and a status. Months without complete data yet are left empty, not 0.
 */
export function calendarCsv(table: CalendarTable, current?: CurrentYear): string {
  const unit = table.measure === "count" ? "detections" : "frp_mw";
  const totals = yearTotals(table);
  const header = ["year", ...MONTH_NAMES.map((m) => m.toLowerCase()), `year_total_${unit}`, "record", "status"];
  const lines = tableYears(table).map((year, y) => [
    year,
    ...table.values[y].map((value, m) => (isObserved(table, year, m + 1) ? value : null)),
    totals[y],
    table.record,
    yearStatus(table, year, current),
  ]);
  return toCsv([header, ...lines]);
}

/**
 * Monthly values per 0.25° grid square in the chosen years: the closest the
 * app's data comes to a list of hotspots (it stores counts per square, not
 * single detections).
 */
export function gridCsv(rows: readonly CellRow[], firstYear: number, lastYear: number, current?: CurrentYear): string {
  const header = [
    "lat_centre", "lon_centre", "year", "month",
    "modis_detections", "viirs_detections", "corrected_detections",
    "modis_frp_mw", "viirs_frp_mw", "corrected_frp_mw", "status",
  ];
  const lines = rows
    .filter((r) => r[COL.year] >= firstYear && r[COL.year] <= lastYear)
    .map((r) => {
      const year = r[COL.year];
      const provisional = current?.year === year && r[COL.month] >= Number(current.provisionalFrom.slice(5, 7));
      return [
        r[0], r[1], year, r[COL.month],
        r[COL.modisRaw], r[COL.viirsRaw], rowValue(r, "corrected", "count"),
        r[COL.modisFrp], r[COL.viirsFrp], rowValue(r, "corrected", "frp"),
        isEstimated(year) ? "estimated from MODIS" : provisional ? "provisional" : "",
      ];
    })
    .sort((a, b) => (a[2] as number) - (b[2] as number) || (a[3] as number) - (b[3] as number) || (a[0] as number) - (b[0] as number) || (a[1] as number) - (b[1] as number));
  return toCsv([header, ...lines]);
}

/** "fire-calendar_all-europe_corrected_2020-2026.csv" */
export function exportFileName(kind: string, area: string, record: string, firstYear: number, lastYear: number, ext: string): string {
  const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const years = firstYear === lastYear ? `${firstYear}` : `${firstYear}-${lastYear}`;
  return `${[kind, slug(area), record, years].filter(Boolean).join("_")}.${ext}`;
}

const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** Short cell text: 15200 -> "15k", as in the on-screen calendar. */
function short(value: number): string {
  const v = Math.round(value);
  return v >= 10000 ? `${Math.round(v / 1000)}k` : String(v);
}

/**
 * The calendar as a standalone SVG image, with title, colours and source line,
 * so it can be saved or turned into a PNG.
 */
export function calendarSvg(table: CalendarTable, options: { title: string; max?: number; current?: CurrentYear }): string {
  const years = tableYears(table);
  const totals = yearTotals(table);
  const max = options.max ?? Math.max(0, ...table.values.flat());
  const cw = 52, ch = 24, left = 56, top = 70, totalW = 90;
  const width = left + cw * 12 + totalW + 16;
  const height = top + ch * years.length + 70;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">`);
  out.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  out.push(`<text x="16" y="28" font-size="18" font-weight="bold" fill="#1d302e">${escapeXml(options.title)}</text>`);
  out.push(`<text x="16" y="48" font-size="12" fill="#60716d">${escapeXml(`${table.record} record, ${table.measure === "count" ? "hotspot detections" : "FRP (MW)"} per month, ${table.firstYear}–${table.lastYear}`)}</text>`);
  MONTH_NAMES.forEach((m, i) => out.push(`<text x="${left + cw * i + cw / 2}" y="${top - 6}" font-size="11" text-anchor="middle" fill="#60716d">${m}</text>`));
  out.push(`<text x="${left + cw * 12 + totalW - 4}" y="${top - 6}" font-size="11" text-anchor="end" fill="#60716d">Year total</text>`);
  years.forEach((year, y) => {
    const yy = top + ch * y;
    const mark = (table.record === "corrected" && isEstimated(year)) || !isCompleteYear(table, year) || options.current?.year === year ? "*" : "";
    out.push(`<text x="${left - 8}" y="${yy + 16}" font-size="11" text-anchor="end" fill="#1d302e">${year}${mark}</text>`);
    table.values[y].forEach((value, m) => {
      const x = left + cw * m;
      if (!isObserved(table, year, m + 1)) {
        out.push(`<rect x="${x + 1}" y="${yy + 1}" width="${cw - 2}" height="${ch - 2}" fill="#f1f3f1"/><text x="${x + cw / 2}" y="${yy + 16}" font-size="11" text-anchor="middle" fill="#9aa59f">–</text>`);
        return;
      }
      const c = heatColour(value, max);
      out.push(`<rect x="${x + 1}" y="${yy + 1}" width="${cw - 2}" height="${ch - 2}" fill="${c?.background ?? "#f6f7f5"}"/>`);
      out.push(`<text x="${x + cw / 2}" y="${yy + 16}" font-size="10" text-anchor="middle" fill="${c?.color ?? "#9aa59f"}">${short(value)}</text>`);
    });
    out.push(`<text x="${left + cw * 12 + totalW - 4}" y="${yy + 16}" font-size="11" text-anchor="end" font-weight="bold" fill="#1d302e">${Math.round(totals[y]).toLocaleString("en")}</text>`);
  });
  const notes = ["Source: NASA FIRMS (MODIS, VIIRS S-NPP), harmonized by FireChronos."];
  if (table.record === "corrected" && table.firstYear < 2012) notes.push("* before 2012: estimated from MODIS.");
  if (options.current && years.includes(options.current.year)) {
    notes.push(`* ${options.current.year}: data to ${options.current.lastDate}; provisional from ${options.current.provisionalFrom}; – not complete yet.`);
  }
  notes.forEach((n, i) => out.push(`<text x="16" y="${top + ch * years.length + 24 + i * 16}" font-size="11" fill="#60716d">${escapeXml(n)}</text>`));
  out.push(`</svg>`);
  return out.join("");
}
