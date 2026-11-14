import { ROW_LENGTH, type CellRow } from "./types";

/** An error whose message is written for the person using the app. */
export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataError";
  }
}

/**
 * Checks that a parsed JSON value has the shape of a country file and returns
 * it as typed rows. Throws a DataError that names the first bad row.
 */
export function parseCells(value: unknown, file: string): CellRow[] {
  if (!Array.isArray(value)) {
    throw new DataError(`The data file "${file}" is not a list of rows.`);
  }
  for (let i = 0; i < value.length; i++) {
    const row: unknown = value[i];
    if (
      !Array.isArray(row) ||
      row.length !== ROW_LENGTH ||
      !row.every((v) => typeof v === "number" && Number.isFinite(v))
    ) {
      throw new DataError(
        `The data file "${file}" has an unexpected format in row ${i + 1}. ` +
          `Each row must hold ${ROW_LENGTH} numbers.`,
      );
    }
  }
  return value as CellRow[];
}

// Country files do not change while the app is open, so each is fetched once.
const cache = new Map<string, CellRow[]>();

/**
 * Loads one country file from public/data/cells/.
 * Rejects with a DataError when the file is missing, unreadable or malformed.
 */
export async function loadCountryCells(
  file: string,
  signal?: AbortSignal,
): Promise<CellRow[]> {
  const cached = cache.get(file);
  if (cached) return cached;

  let response: Response;
  try {
    response = await fetch(`/data/cells/${encodeURIComponent(file)}`, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new DataError(
      `Could not reach the data file "${file}". Check the connection and try again.`,
    );
  }

  if (response.status === 404) {
    throw new DataError(`The data file "${file}" was not found.`);
  }
  if (!response.ok) {
    throw new DataError(
      `Could not load the data file "${file}" (the server answered ${response.status}).`,
    );
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new DataError(`The data file "${file}" is not valid JSON.`);
  }

  const rows = parseCells(value, file);
  cache.set(file, rows);
  return rows;
}
