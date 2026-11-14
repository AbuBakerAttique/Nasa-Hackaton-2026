// Step 5 check: the Germany calendar shows the same numbers as the prototype
// calendar on the project board. Renders the real component to HTML and
// compares every cell's text.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CalendarGrid } from "@/components/CalendarGrid";
import { buildTable } from "@/lib/calendar";
import { parseCells } from "@/lib/data";

const file = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const rows = parseCells(JSON.parse(readFileSync(file("../../public/data/cells/Germany.json"), "utf8")), "Germany.json");
const protoText = readFileSync(file("../../../assets/proto/Germany.js"), "utf8");
const proto = JSON.parse(protoText.slice(protoText.indexOf("=") + 1).trim().replace(/;$/, "")) as {
  cal: { harm: number[][] };
};

/** The prototype's own cell text (index.html, function fmt). */
const protoCell = (v: number) => (v ? (v >= 10000 ? `${Math.round(v / 1000)}k` : String(v)) : "");

/** Text of every month cell, row by row, from rendered HTML. */
function cellTexts(html: string): string[][] {
  return [...html.matchAll(/<tr[^>]*><th scope="row"[^>]*>\d{4}(?:<span[^>]*>[^<]*<\/span>)?<\/th>(.*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<td title="[^"]*"[^>]*>(.*?)<\/td>/g)].map((cell) => cell[1]),
  );
}

describe("CalendarGrid for Germany, corrected record", () => {
  const table = buildTable(rows, { record: "corrected", measure: "count", firstYear: 2001, lastYear: 2025 });
  const html = renderToStaticMarkup(<CalendarGrid table={table} areaName="Germany" />);
  const ours = cellTexts(html);

  it("has 25 years of 12 months", () => {
    expect(ours).toHaveLength(25);
    expect(ours.every((r) => r.length === 12)).toBe(true);
  });

  it("shows the prototype's number in every cell", () => {
    // The prototype rounded in Python, which rounds x.5 to the nearest even
    // number. Our cells round x.5 up. Allow that difference only.
    const mismatches: string[] = [];
    ours.forEach((months, y) =>
      months.forEach((text, m) => {
        const expected = protoCell(proto.cal.harm[y][m]);
        if (text === expected) return;
        const exact = table.values[y][m];
        const halfway = Math.abs((exact % 1) - 0.5) < 1e-6;
        if (!halfway) mismatches.push(`${2001 + y}-${m + 1}: ours "${text}", prototype "${expected}"`);
      }),
    );
    expect(mismatches).toEqual([]);
  });

  it("labels the table for screen readers", () => {
    expect(html).toContain("Fire detections per month in Germany, 2001 to 2025, corrected record");
  });

  it("marks the 11 years before 2012 as estimated, and draws the line at 2012", () => {
    expect(html.match(/data-estimated="true"/g)).toHaveLength(11 * 12);
    expect(html.match(/data-split="true"/g)).toHaveLength(1);
    expect(html).toMatch(/data-split="true"[^>]*><th scope="row"[^>]*>2012</);
  });
});

describe("CalendarGrid, raw record and a short range", () => {
  it("marks nothing as estimated in the raw record", () => {
    const table = buildTable(rows, { record: "raw", measure: "count", firstYear: 2001, lastYear: 2025 });
    const html = renderToStaticMarkup(<CalendarGrid table={table} areaName="Germany" />);
    expect(html).not.toContain("data-estimated");
    expect(html.match(/data-split="true"/g)).toHaveLength(1);
  });

  it("shows only the chosen years, without a line when 2012 is the first row", () => {
    const table = buildTable(rows, { record: "corrected", measure: "count", firstYear: 2012, lastYear: 2015 });
    const html = renderToStaticMarkup(<CalendarGrid table={table} areaName="Germany" />);
    expect(cellTexts(html)).toHaveLength(4);
    expect(html).not.toContain("data-split");
    expect(html).not.toContain("data-estimated");
  });
});
