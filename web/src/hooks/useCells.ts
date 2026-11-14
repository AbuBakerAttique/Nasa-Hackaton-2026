"use client";

import { useEffect, useState } from "react";
import { DataError, loadCountryCells } from "@/lib/data";
import type { CellRow } from "@/lib/types";

export type CellData =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; rows: CellRow[] }
  | { status: "error"; message: string };

type Settled = Extract<CellData, { status: "ready" | "error" }>;

/**
 * Loads the rows of one or more country files and joins them, with loading
 * and error states. One file for a country, several for a region that
 * crosses a border. Pass an empty list while nothing is chosen.
 */
export function useCells(files: readonly string[]): CellData {
  // One string as the effect's key, so a new array with the same files
  // does not start a new download.
  const key = files.join("|");

  // The result is stored together with the files it belongs to. While the
  // two differ, new files are on their way and the old result must not show.
  const [result, setResult] = useState<{ key: string; data: Settled } | null>(null);

  useEffect(() => {
    if (!key) return;
    const list = key.split("|");
    const controller = new AbortController();

    Promise.all(list.map((file) => loadCountryCells(file, controller.signal))).then(
      (parts) => {
        if (controller.signal.aborted) return;
        setResult({ key, data: { status: "ready", rows: parts.length === 1 ? parts[0] : parts.flat() } });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof DataError ? error.message : `Something went wrong while loading ${list.join(", ")}.`;
        setResult({ key, data: { status: "error", message } });
      },
    );

    // A new choice cancels the downloads that are still running.
    return () => controller.abort();
  }, [key]);

  if (!key) return { status: "idle" };
  if (!result || result.key !== key) return { status: "loading" };
  return result.data;
}
