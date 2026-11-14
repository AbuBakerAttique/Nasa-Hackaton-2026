"use client";

import { useEffect, useState } from "react";
import { DataError, loadCountryCells } from "@/lib/data";
import type { CellRow } from "@/lib/types";

export type CountryData =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; rows: CellRow[] }
  | { status: "error"; message: string };

type Settled = Extract<CountryData, { status: "ready" | "error" }>;

/**
 * Loads the rows of one country file and reports loading and error states.
 * Pass null while no country is chosen.
 */
export function useCountryData(file: string | null): CountryData {
  // The result is stored together with the file it belongs to. While the two
  // differ, a new file is on its way and the old result must not be shown.
  const [result, setResult] = useState<{ file: string; data: Settled } | null>(null);

  useEffect(() => {
    if (!file) return;
    const controller = new AbortController();

    loadCountryCells(file, controller.signal).then(
      (rows) => {
        if (controller.signal.aborted) return;
        setResult({ file, data: { status: "ready", rows } });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof DataError
            ? error.message
            : `Something went wrong while loading "${file}".`;
        setResult({ file, data: { status: "error", message } });
      },
    );

    // Choosing another country cancels the download that is still running.
    return () => controller.abort();
  }, [file]);

  if (!file) return { status: "idle" };
  if (!result || result.file !== file) return { status: "loading" };
  return result.data;
}
