"use client";

// Download buttons for the selection: calendar CSV, grid-square CSV and the
// calendar as a PNG image. The file contents come from lib/export.ts; this
// component only turns them into files.

import { useState } from "react";
import type { CalendarTable } from "@/lib/calendar";
import { calendarCsv, calendarSvg, exportFileName, gridCsv } from "@/lib/export";
import type { CellRow, CurrentYear } from "@/lib/types";

/** Saves text or a blob as a file in the browser. */
export function saveFile(content: Blob | string, fileName: string, type = "text/csv;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Draws an SVG string onto a canvas at twice its size and returns a PNG. */
function svgToPng(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png");
    };
    img.onerror = () => reject(new Error("image failed"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export function ExportPanel({
  table,
  rows,
  areaName,
  max,
  current,
}: {
  table: CalendarTable;
  rows: readonly CellRow[];
  areaName: string;
  max?: number;
  current?: CurrentYear;
}) {
  const [error, setError] = useState<string | null>(null);
  const name = (kind: string, ext: string) => exportFileName(kind, areaName, table.record, table.firstYear, table.lastYear, ext);
  const button =
    "rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-foreground";

  return (
    <div className="mt-3" aria-label="Download this selection">
      <p className="text-xs text-muted">Download this selection ({areaName}, {table.firstYear}–{table.lastYear}, {table.record} record):</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => saveFile(calendarCsv(table, current), name("fire-calendar", "csv"))}>
          Calendar CSV
        </button>
        <button
          type="button"
          className={button}
          onClick={() => saveFile(gridCsv(rows, table.firstYear, table.lastYear, current), name("grid-squares", "csv"))}
        >
          Grid squares CSV
        </button>
        <button
          type="button"
          className={button}
          onClick={() => {
            setError(null);
            const svg = calendarSvg(table, { title: `Fire calendar: ${areaName}`, max, current });
            svgToPng(svg)
              .then((png) => saveFile(png, name("fire-calendar", "png")))
              .catch(() => {
                // Fall back to the SVG itself when the browser cannot draw it.
                saveFile(svg, name("fire-calendar", "svg"), "image/svg+xml");
                setError("PNG could not be made in this browser; saved as SVG instead.");
              });
          }}
        >
          Calendar image (PNG)
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Grid squares CSV lists monthly counts per 0.25° square, not single detections.
      </p>
      {error && <p role="status" className="mt-1 text-xs text-accent">{error}</p>}
    </div>
  );
}
