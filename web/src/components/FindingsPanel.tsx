// Plain-language statements about the calendar, and the picked month against
// its median and average. Only shows what lib/findings.ts wrote.

import type { MonthPick } from "@/components/CalendarGrid";
import type { CalendarTable } from "@/lib/calendar";
import { describeMonth, describeTable } from "@/lib/findings";

export function FindingsPanel({ table, month }: { table: CalendarTable; month: MonthPick | null }) {
  const f = describeTable(table);
  const m = month ? describeMonth(table, month.year, month.month) : null;
  const items = [
    ["Main season", f.season],
    ["Worst year", f.worst],
    ["Latest year", f.latest],
  ].filter((item): item is [string, string] => item[1] !== null);

  return (
    <div className="grid gap-4 md:grid-cols-2" aria-live="polite">
      <section aria-labelledby="findings-heading" className="insight-card">
        <p className="eyebrow mb-2">REGIONAL BRIEFING</p>
        <h3 id="findings-heading" className="font-semibold">
          What the record tells us
        </h3>
        {items.length > 0 && (
          <ul className="mt-2 space-y-1.5 text-sm">
            {items.map(([label, text]) => (
              <li key={label}>
                <span className="font-medium">{label}:</span> {text}
              </li>
            ))}
          </ul>
        )}
        {f.caution && (
          <p className="mt-3 rounded-md border border-accent px-3 py-2 text-sm text-accent">{f.caution}</p>
        )}
      </section>

      <section aria-labelledby="month-heading" className="insight-card month-insight">
        <p className="eyebrow mb-2">MONTH IN FOCUS</p>
        <h3 id="month-heading" className="font-semibold">
          {m ? m.headline : "Compare a month"}
        </h3>
        {m ? (
          <div className="mt-2 space-y-1.5 text-sm">
            <p>{m.rank}</p>
            <p>{m.typical}</p>
            {table.record === "raw" && (
              <p className="text-accent">
                In the raw record this comparison is unfair, because the two satellites measure differently.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Click any month in the calendar to compare it with the same month in every other year: how it ranks, and
            how far it is from a typical month.
          </p>
        )}
      </section>
    </div>
  );
}
