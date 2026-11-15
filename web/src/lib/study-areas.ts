import type { CountryEntry, DataIndex } from "./types";

export interface StudyArea {
  id: string;
  name: string;
  region: string;
  targetYears: string;
  /** Countries that make up this study area in the current archive. */
  countryIds: readonly string[];
  note: string;
}

/** The currently supported study area. The deployed archive is Europe-only. */
export const STUDY_AREAS: readonly StudyArea[] = [
  {
    id: "southern-europe",
    name: "Europe",
    region: "Europe",
    targetYears: "2020–2026",
    countryIds: [
      "Austria", "Bulgaria", "Croatia", "Czech_Republic", "France", "Germany", "Greece", "Hungary",
      "Italy", "Poland", "Portugal", "Romania", "Spain", "Sweden", "Turkey", "Ukraine",
    ],
    note: "All 16 European country archives currently included in the app are available.",
  },
];

export function countriesForStudyArea(area: StudyArea, index: DataIndex): CountryEntry[] {
  return area.countryIds
    .map((id) => index.countries.find((country) => country.id === id))
    .filter((country): country is CountryEntry => country !== undefined);
}

export function studyAreaIsAvailable(area: StudyArea, index: DataIndex): boolean {
  return area.countryIds.length > 0 && countriesForStudyArea(area, index).length === area.countryIds.length;
}

export function studyAreaYears(area: StudyArea): [number, number] {
  const years = area.targetYears.split("–").map(Number);
  if (years.length !== 2 || !years.every(Number.isInteger)) throw new Error(`Invalid year range for ${area.id}.`);
  return [years[0], years[1]];
}
