import { describe, expect, it } from "vitest";
import { formatCell, formatTotal, heatColour, monthName } from "./format";

describe("formatCell", () => {
  it("shows whole numbers, thousands as k from 10,000, and nothing for 0", () => {
    expect(formatCell(0)).toBe("");
    expect(formatCell(0.4)).toBe("");
    expect(formatCell(12.6)).toBe("13");
    expect(formatCell(9999)).toBe("9999");
    expect(formatCell(9999.6)).toBe("10k");
    expect(formatCell(12_499)).toBe("12k");
    expect(formatCell(12_500)).toBe("13k");
  });
});

describe("formatTotal", () => {
  it("rounds and adds thousands separators", () => {
    expect(formatTotal(1234567.4)).toBe("1,234,567");
  });
});

describe("heatColour", () => {
  it("is null for no fire", () => {
    expect(heatColour(0, 100)).toBeNull();
    expect(heatColour(5, 0)).toBeNull();
  });

  it("goes from pale to dark, with white text on dark cells", () => {
    expect(heatColour(100, 100)).toEqual({ background: "hsl(8.0 90% 30.0%)", color: "#ffffff" });
    expect(heatColour(1, 100)!.color).toBe("#3a1500");
  });
});

describe("monthName", () => {
  it("counts months from 1", () => {
    expect(monthName(1)).toBe("Jan");
    expect(monthName(12, true)).toBe("December");
    expect(() => monthName(0)).toThrow(RangeError);
  });
});
