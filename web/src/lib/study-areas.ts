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

/** Six named case studies from the FireChronos project brief. */
export const STUDY_AREAS: readonly StudyArea[] = [
  { id: "amazon", name: "Brazilian Amazon", region: "South America", targetYears: "2018–2025", countryIds: [], note: "Brazil archive is not in the current app dataset." },
  { id: "california", name: "California", region: "North America", targetYears: "2020–2025", countryIds: [], note: "California subset is not in the current app dataset." },
  { id: "southeast-australia", name: "Southeast Australia", region: "Oceania", targetYears: "2020–2025", countryIds: [], note: "Australia archive is not in the current app dataset." },
  { id: "central-africa", name: "Central African savannas", region: "Africa", targetYears: "2020–2025", countryIds: [], note: "Central Africa archive is not in the current app dataset." },
  { id: "indonesia", name: "Sumatra & Kalimantan", region: "Southeast Asia", targetYears: "2020–2025", countryIds: [], note: "Indonesia archive is not in the current app dataset." },
  {
    id: "southern-europe",
    name: "Europe",
    region: "Europe",
    targetYears: "2020–2025",
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
