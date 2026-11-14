import { describe, expect, it } from "vitest";
import { mannKendall, mean, median, normalCdf, sum } from "./stats";

describe("sum, mean, median", () => {
  it("handle empty lists", () => {
    expect(sum([])).toBe(0);
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
  });

  it("take the middle value for an odd count, without changing the input", () => {
    const values = [9, 1, 5];
    expect(median(values)).toBe(5);
    expect(values).toEqual([9, 1, 5]);
  });

  it("average the two middle values for an even count", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("compute the mean", () => {
    expect(mean([1, 2, 3, 6])).toBe(3);
  });
});

describe("normalCdf", () => {
  // Reference values from scipy.stats.norm.cdf.
  it("matches known values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normalCdf(-1.96)).toBeCloseTo(1 - 0.9750021, 6);
  });
});

describe("mannKendall", () => {
  it("needs at least 3 values", () => {
    expect(mannKendall([])).toBeNull();
    expect(mannKendall([1, 2])).toBeNull();
  });

  // Worked by hand: S = 10, Var(S) = 5·4·15/18, z = 9/√Var. p from scipy.
  it("finds a steady rise", () => {
    const r = mannKendall([1, 2, 3, 4, 5])!;
    expect(r.s).toBe(10);
    expect(r.variance).toBeCloseTo(50 / 3, 10);
    expect(r.z).toBeCloseTo(9 / Math.sqrt(50 / 3), 10);
    expect(r.p).toBeCloseTo(0.0274863, 6);
    expect(r.tau).toBe(1);
    expect(r.slope).toBe(1);
    expect(r.intercept).toBe(1);
    expect(r.direction).toBe("rising");
  });

  it("finds a steady fall", () => {
    const r = mannKendall([5, 4, 3, 2, 1])!;
    expect(r.s).toBe(-10);
    expect(r.slope).toBe(-1);
    expect(r.direction).toBe("falling");
  });

  // One tie group of 2 lowers the variance from 66/18 to 48/18. p from scipy.
  it("corrects the variance for ties", () => {
    const r = mannKendall([1, 1, 2])!;
    expect(r.s).toBe(2);
    expect(r.variance).toBeCloseTo(48 / 18, 10);
    expect(r.p).toBeCloseTo(0.5402914, 6);
    expect(r.direction).toBe("none");
  });

  it("reports no trend for constant values", () => {
    const r = mannKendall([4, 4, 4, 4])!;
    expect(r.s).toBe(0);
    expect(r.variance).toBe(0);
    expect(r.p).toBe(1);
    expect(r.slope).toBe(0);
    expect(r.direction).toBe("none");
  });

  it("is not fooled by one extreme value", () => {
    // Sen's slope is a median, so the 1000 barely moves it.
    const r = mannKendall([10, 11, 12, 1000, 14, 15])!;
    expect(r.slope).toBe(1);
  });
});
