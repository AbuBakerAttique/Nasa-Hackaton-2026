// Step 9 check: the statements match hand calculations for two regions,
// Germany and the Brandenburg box. The expected numbers were worked out in
// Python straight from the data files, independently of lib/:
//
//   Germany      season Apr, Jul, Aug 45.6% | worst 2025: 3,935, 1.99× median 1,982 | 2025 +98.5%
//                Jul 2018: 882, above all 24, median 295, mean 332.3, +165.5% vs mean
//   Brandenburg  season Apr, Jul, Aug 47.8% | worst 2025: 890, 2.41× median 370 | 2025 +140.5%
//                Aug 2022: 57, above 10 of 24, median 62.0, mean 70.8, -19.4% vs mean

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTable, type RecordKind } from "./calendar";
import { parseCells } from "./data";
import { describeChange, describeMonth, describeTable, joinNames } from "./findings";
import { rowsInRegion } from "./region";
import type { CellRow } from "./types";

const load = (name: string) =>
  parseCells(
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../public/data/cells/${name}.json`, import.meta.url)), "utf8")),
    name,
  );

const table = (rows: CellRow[], record: RecordKind = "corrected", firstYear = 2001, lastYear = 2025) =>
  buildTable(rows, { record, measure: "count", firstYear, lastYear });

describe("wording helpers", () => {
  it("joins names", () => {
    expect(joinNames(["April"])).toBe("April");
    expect(joinNames(["April", "July"])).toBe("April and July");
    expect(joinNames(["April", "July", "August"])).toBe("April, July and August");
  });

  it("describes a change", () => {
    expect(describeChange(0.985)).toBe("99% above");
    expect(describeChange(-0.194)).toBe("19% below");
    expect(describeChange(0.04)).toBe("about the same as");
  });
});

describe("Germany, corrected record, 2001 to 2025", () => {
  const t = table(load("Germany"));
  const f = describeTable(t);

  it("names the main season", () => {
    expect(f.season).toBe("April, July and August hold 46% of all detections from 2001 to 2025.");
  });

  it("names the worst year, which is also the latest", () => {
    expect(f.worst).toBe("2025, with 2.0 times a typical year: 3,935 detections against a median of 1,982.");
    expect(f.latest).toBe("2025: 3,935 detections, 99% above a typical year. It is the worst year in the range.");
    expect(f.caution).toBeNull();
  });

  it("compares July 2018 with the other Julys", () => {
    expect(describeMonth(t, 2018, 7)).toEqual({
      headline: "July 2018: 882 detections.",
      rank: "The highest July on record: more than all 24 other July months.",
      typical: "A typical July (the median) has 295. The average July has 332, so this July is 165% above the average.",
    });
  });
});

describe("Brandenburg box, corrected record, 2001 to 2025", () => {
  const rows = rowsInRegion([...load("Germany"), ...load("Poland")], {
    kind: "box",
    south: 51.35,
    north: 53.56,
    west: 11.26,
    east: 14.77,
  });
  const t = table(rows);
  const f = describeTable(t);

  it("names the main season, the worst year and the latest year", () => {
    expect(f.season).toBe("April, July and August hold 48% of all detections from 2001 to 2025.");
    expect(f.worst).toBe("2025, with 2.4 times a typical year: 890 detections against a median of 370.");
    expect(f.latest).toBe("2025: 890 detections, 141% above a typical year. It is the worst year in the range.");
  });

  it("compares August 2022, a month below its typical value", () => {
    expect(describeMonth(t, 2022, 8)).toEqual({
      headline: "August 2022: 57 detections.",
      rank: "More than 10 of the 24 other August months.",
      typical: "A typical August (the median) has 62. The average August has 71, so this August is 19% below the average.",
    });
  });
});

describe("special cases", () => {
  const germany = load("Germany");

  it("warns on the raw record", () => {
    expect(describeTable(table(germany, "raw")).caution).toMatch(/^These statements use the raw record/);
  });

  it("marks estimated years in the corrected record", () => {
    expect(describeMonth(table(germany), 2003, 8).headline).toMatch(/\(estimated\)\.$/);
    expect(describeMonth(table(germany, "raw"), 2003, 8).headline).not.toMatch(/estimated/);
  });

  it("does not compare years in a range shorter than 3 years", () => {
    const f = describeTable(table(germany, "corrected", 2020, 2021));
    expect(f.season).toMatch(/from 2020 to 2021\.$/);
    expect(f.worst).toBeNull();
    expect(f.latest).toBeNull();
    expect(f.caution).toBe("Choose at least 3 years to compare years with each other.");
  });

  it("says so when there is no fire", () => {
    const f = describeTable(table([], "corrected", 2001, 2025));
    expect(f.season).toBeNull();
    expect(f.caution).toBe("No fire detections in this area from 2001 to 2025.");
  });

  it("finds the lowest month and handles a single year", () => {
    const t = table(germany, "corrected", 2001, 2025);
    const lowest = t.values.map((r) => r[0]).indexOf(Math.min(...t.values.map((r) => r[0])));
    expect(describeMonth(t, 2001 + lowest, 1).rank).toMatch(/^The lowest January on record/);
    expect(describeMonth(table(germany, "corrected", 2020, 2020), 2020, 1).rank).toBe(
      "There is no other January in the chosen years to compare with.",
    );
  });
});
