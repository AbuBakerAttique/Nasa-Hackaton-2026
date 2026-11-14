import { describe, expect, it } from "vitest";
import { DataError, parseCells } from "./data";

const good = [52.12, 13.38, 2015, 8, 1, 3, 3, 10.5, 30.2, 30.2];

describe("parseCells", () => {
  it("accepts a list of 10-number rows", () => {
    expect(parseCells([good, good], "Test.json")).toHaveLength(2);
    expect(parseCells([], "Test.json")).toEqual([]);
  });

  it("rejects a file that is not a list", () => {
    expect(() => parseCells({ rows: [] }, "Test.json")).toThrow(DataError);
    expect(() => parseCells({ rows: [] }, "Test.json")).toThrow('The data file "Test.json" is not a list of rows.');
  });

  it("names the first bad row, counting from 1", () => {
    const message =
      'The data file "Test.json" has an unexpected format in row 2. Each row must hold 10 numbers.';
    expect(() => parseCells([good, good.slice(0, 9)], "Test.json")).toThrow(message);
    expect(() => parseCells([good, [...good.slice(0, 9), "3"]], "Test.json")).toThrow(message);
    expect(() => parseCells([good, [...good.slice(0, 9), null]], "Test.json")).toThrow(message);
    expect(() => parseCells([good, "row"], "Test.json")).toThrow(message);
  });
});
