// The burning calendar: one row per year, one column per month, coloured by
// fire activity. Only draws what lib/calendar.ts calculated.

import { isCompleteYear, isEstimated, isObserved, tableYears, yearTotals, type CalendarTable } from "@/lib/calendar";
import { MONTH_NAMES, formatCell, formatTotal, heatColour, monthName } from "@/lib/format";
import { VIIRS_FIRST_YEAR, type CurrentYear } from "@/lib/types";

const UNIT = { count: "detections", frp: "MW of heat output" } as const;

/** A month in the calendar. */
export interface MonthPick {
  year: number;
  month: number;
}

export function CalendarGrid({
  table,
  areaName,
  max,
  selected,
  onSelect,
  current,
}: {
  table: CalendarTable;
  /** Name of the area, for the caption and cell descriptions. */
  areaName: string;
  /** Value that gets the darkest colour. Defaults to the largest cell. */
  max?: number;
  /** The month shown on the map, outlined in the calendar. */
  selected?: MonthPick | null;
  /** Makes each month a button. Without it the calendar is a plain table. */
  onSelect?: (pick: MonthPick) => void;
  /** Coverage of the current, unfinished year: marks provisional and not-yet-complete months. */
  current?: CurrentYear;
}) {
  // Near-real-time months of the current year: provisional, NASA reprocesses them later.
  const provisionalMonth = current ? Number(current.provisionalFrom.slice(5, 7)) : 13;
  const isProvisional = (year: number, month: number) => current?.year === year && month >= provisionalMonth;
  const years = tableYears(table);
  const totals = yearTotals(table);
  const top = max ?? Math.max(0, ...table.values.flat());
  const unit = UNIT[table.measure];
  const record = table.record === "raw" ? "raw record" : "corrected record";

  return (
    <div className="calendar-scroll overflow-x-auto" tabIndex={0} role="region" aria-label="Monthly fire calendar; scroll horizontally on small screens">
      <table className="heatmap-table w-full min-w-[40rem] text-xs tabular-nums sm:text-sm">
        <caption className="sr-only">
          Fire {unit} per month in {areaName}, {table.firstYear} to {table.lastYear}, {record}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-12 py-1 text-left font-medium text-muted">
              <span className="sr-only">Year</span>
            </th>
            {MONTH_NAMES.map((m) => (
              <th key={m} scope="col" className="py-1 font-medium text-muted">
                {m}
              </th>
            ))}
            <th scope="col" className="py-1 pl-2 text-right font-medium text-muted">
              Year total
            </th>
          </tr>
        </thead>
        <tbody>
          {table.values.map((months, y) => {
            const year = years[y];
            // In the corrected record, years before VIIRS are estimates.
            const estimated = table.record === "corrected" && isEstimated(year);
            // The line where the newer satellite starts.
            const split = year === VIIRS_FIRST_YEAR && y > 0;
            return (
              <tr key={year} data-split={split || undefined} className={split ? "border-t-2 border-accent" : undefined}>
                <th scope="row" className="py-px pr-2 text-left font-medium">
                  {year}
                  {estimated && <span className="sr-only"> (estimated)</span>}
                </th>
                {months.map((value, m) => {
                  const observed = isObserved(table, year, m + 1);
                  const provisional = observed && isProvisional(year, m + 1);
                  const colour = observed ? heatColour(value, top) : null;
                  const note = estimated ? " (estimated)" : provisional ? " (provisional)" : "";
                  const description = observed
                    ? `${monthName(m + 1, true)} ${year}: ${formatTotal(value)} ${unit}${note}`
                    : `${monthName(m + 1, true)} ${year}: not complete yet${current ? `, data to ${current.lastDate}` : ""}`;
                  const isSelected = selected?.year === year && selected.month === m + 1;
                  return (
                    <td
                      key={m}
                      title={description}
                      data-estimated={estimated || undefined}
                      data-provisional={provisional || undefined}
                      data-unobserved={!observed || undefined}
                      data-selected={isSelected || undefined}
                      className={
                        "h-7 border border-background p-0 text-center" +
                        (isSelected
                          ? " outline-2 -outline-offset-2 outline-foreground"
                          : estimated || provisional
                            ? " outline-1 -outline-offset-2 outline-dashed outline-muted"
                            : !observed
                              ? " text-muted"
                              : "")
                      }
                      style={colour ?? undefined}
                    >
                      {!observed ? (
                        <span aria-label={description}>–</span>
                      ) : onSelect ? (
                        <button
                          type="button"
                          aria-label={description}
                          aria-pressed={isSelected}
                          onClick={() => onSelect({ year, month: m + 1 })}
                          className="h-full w-full cursor-pointer px-0.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
                        >
                          {formatCell(value)}
                        </button>
                      ) : (
                        formatCell(value)
                      )}
                    </td>
                  );
                })}
                <td className="pl-2 text-right font-semibold" title={isCompleteYear(table, year) ? undefined : `Part year${current ? `, data to ${current.lastDate}` : ""}`}>
                  {formatTotal(totals[y])}
                  {!isCompleteYear(table, year) && <span aria-hidden="true">*</span>}
                  {!isCompleteYear(table, year) && <span className="sr-only"> (part year)</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
