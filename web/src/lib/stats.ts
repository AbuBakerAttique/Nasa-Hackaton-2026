// General number helpers with no knowledge of fire data.
// Everything here is a plain function, so it can be unit tested without React.

/** Sum of a list. 0 for an empty list. */
export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Arithmetic mean. null for an empty list. */
export function mean(values: readonly number[]): number | null {
  return values.length ? sum(values) / values.length : null;
}

/**
 * Median: the middle value after sorting. For an even count it is the average
 * of the two middle values. null for an empty list.
 */
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Standard normal cumulative distribution, Φ(z).
 * Uses the Abramowitz and Stegun approximation 7.1.26 of erf, accurate to
 * about 1e-7, which is far more than a p-value on screen needs.
 */
export function normalCdf(z: number): number {
  // The approximation is off by 1e-9 at 0; return the exact value there.
  if (z === 0) return 0.5;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Result of the Mann-Kendall trend test. */
export interface TrendTest {
  /** Number of values tested. */
  n: number;
  /** Mann-Kendall S: pairs going up minus pairs going down. */
  s: number;
  /** Variance of S, corrected for ties. */
  variance: number;
  /** Normal score of S, with continuity correction. */
  z: number;
  /** Two-sided p-value: the chance of a trend this strong if there were none. */
  p: number;
  /** Kendall's tau, from -1 (always falling) to 1 (always rising). */
  tau: number;
  /** Sen's slope: the median change per step (per year for yearly totals). */
  slope: number;
  /** Intercept of the Sen line at step 0, so value ≈ intercept + slope × i. */
  intercept: number;
  /** "rising" or "falling" when p < alpha, otherwise "none". */
  direction: "rising" | "falling" | "none";
}

/**
 * Mann-Kendall trend test with Sen's slope, for values at equal steps
 * (for example one total per year).
 *
 * It asks whether the values tend to go up or down over time, without
 * assuming a straight line or normally distributed data. That suits fire
 * counts, where one extreme year would distort an ordinary regression.
 *
 * Returns null for fewer than 3 values, where no trend can be tested.
 */
export function mannKendall(values: readonly number[], alpha = 0.05): TrendTest | null {
  const n = values.length;
  if (n < 3) return null;

  let s = 0;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = values[j] - values[i];
      s += Math.sign(d);
      slopes.push(d / (j - i));
    }
  }

  // Tie correction: each group of t equal values lowers the variance.
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let ties = 0;
  for (const t of counts.values()) ties += t * (t - 1) * (2 * t + 5);
  const variance = (n * (n - 1) * (2 * n + 5) - ties) / 18;

  let z = 0;
  if (variance > 0) {
    if (s > 0) z = (s - 1) / Math.sqrt(variance);
    else if (s < 0) z = (s + 1) / Math.sqrt(variance);
  }
  const p = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));

  const slope = median(slopes) ?? 0;
  const steps = values.map((_, i) => i);
  const intercept = (median(values) ?? 0) - slope * (median(steps) ?? 0);

  const direction = p < alpha && s !== 0 ? (s > 0 ? "rising" : "falling") : "none";
  return { n, s, variance, z, p, tau: s / ((n * (n - 1)) / 2), slope, intercept, direction };
}
