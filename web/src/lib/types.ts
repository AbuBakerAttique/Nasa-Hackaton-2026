// The data contract between the Python pipeline and the web app.
// If pipeline/02_harmonize.py changes the row format, change it here and in
// scripts/copy-data.mjs (ROW_LENGTH) at the same time.

/**
 * One 0.25° map square in one month.
 *
 * Counts are numbers of fire detections. FRP is fire radiative power, the heat
 * output of all detections added up, in megawatts.
 */
export type CellRow = readonly [
  /** Latitude of the square's centre. */
  lat: number,
  /** Longitude of the square's centre. */
  lon: number,
  year: number,
  /** 1 = January, 12 = December. */
  month: number,
  /** Detections from the older sensor, MODIS, after filtering. */
  modisRaw: number,
  /** Detections from the newer sensor, VIIRS. 0 before 2012 means "no data", not "no fire". */
  viirsRaw: number,
  /** The corrected value. From 2012 it equals viirsRaw. Before 2012 it is an estimate. */
  harmonized: number,
  modisFrp: number,
  viirsFrp: number,
  /** Experimental, see report.json. */
  harmonizedFrp: number,
];

/** Number of values in one row. */
export const ROW_LENGTH = 10;

/** Position of each value in a row, for code that reads rows by index. */
export const COL = {
  lat: 0,
  lon: 1,
  year: 2,
  month: 3,
  modisRaw: 4,
  viirsRaw: 5,
  harmonized: 6,
  modisFrp: 7,
  viirsFrp: 8,
  harmonizedFrp: 9,
} as const;

/** First year with VIIRS data. Earlier harmonized values are estimates. */
export const VIIRS_FIRST_YEAR = 2012;

/** One country in public/data/index.json. */
export interface CountryEntry {
  /** File name without ".json", for example "Czech_Republic". Used in links. */
  id: string;
  /** Name to show, for example "Czech Republic". */
  name: string;
  /** File name inside public/data/cells/. */
  file: string;
  /** Number of rows in the file. */
  rows: number;
}

/** public/data/index.json, written by scripts/copy-data.mjs. */
export interface DataIndex {
  firstYear: number;
  lastYear: number;
  countries: CountryEntry[];
}
