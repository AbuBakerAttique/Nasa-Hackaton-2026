// Fetching historical weather: one day at one point per request, cached by
// model, point and day. Failed or cancelled requests are not cached, so they
// can be tried again. Validation lives in weather.ts.

import { WeatherError, buildWeatherUrl, parseWeather, weatherKey, type WeatherDay, type WeatherQuery } from "./weather";

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<Pick<Response, "ok" | "status" | "json">>;

/** A cache of days that loaded, shared by every caller. */
export class WeatherCache {
  private readonly days = new Map<string, WeatherDay>();
  /** Requests on their way, so two callers asking for the same day share one request. */
  private readonly pending = new Map<string, Promise<WeatherDay>>();

  constructor(private readonly fetchImpl: Fetch = (url, init) => fetch(url, init)) {}

  /** Number of days held, for tests. */
  get size(): number {
    return this.days.size;
  }

  /**
   * Loads one day. Resolves from the cache when possible. Rejects with a
   * WeatherError written for the user, or with the AbortError when cancelled.
   */
  async load(query: WeatherQuery, signal?: AbortSignal): Promise<WeatherDay> {
    const key = weatherKey(query);
    const cached = this.days.get(key);
    if (cached) return cached;

    let request = this.pending.get(key);
    if (!request) {
      // The shared request is not tied to one caller's signal; each caller
      // can still stop waiting for it (below).
      request = this.request(query).then(
        (day) => {
          this.days.set(key, day);
          this.pending.delete(key);
          return day;
        },
        (error: unknown) => {
          this.pending.delete(key);
          throw error;
        },
      );
      this.pending.set(key, request);
    }
    return signal ? abortable(request, signal) : request;
  }

  private async request(query: WeatherQuery): Promise<WeatherDay> {
    let response: Awaited<ReturnType<Fetch>>;
    try {
      response = await this.fetchImpl(buildWeatherUrl(query));
    } catch {
      throw new WeatherError("Could not reach the weather service. Check the connection and try again.");
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new WeatherError(`The weather service sent an unreadable answer (status ${response.status}).`);
    }
    if (!response.ok) {
      const reason =
        typeof body === "object" && body !== null && typeof (body as { reason?: unknown }).reason === "string"
          ? `: ${(body as { reason: string }).reason}`
          : ` (status ${response.status})`;
      throw new WeatherError(
        response.status === 429
          ? "The weather service has had too many requests. Wait a minute and try again."
          : `The weather service could not answer${reason}`,
      );
    }
    return parseWeather(body, query);
  }
}

/** Rejects as soon as the signal aborts, without cancelling the shared request. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

/** The cache the app uses. */
export const weatherCache = new WeatherCache();

/** The state a component sees for the current selection. */
export type WeatherState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; day: WeatherDay }
  | { status: "error"; message: string };

/** A settled result, stored with the key it was loaded for. */
export interface StoredWeather {
  key: string;
  state: Extract<WeatherState, { status: "ready" | "error" }>;
}

/**
 * What to show for the current key. A stored result for another key is stale:
 * it belongs to an earlier choice, so the current one is still loading.
 */
export function currentWeather(stored: StoredWeather | null, key: string | null): WeatherState {
  if (!key) return { status: "idle" };
  if (!stored || stored.key !== key) return { status: "loading" };
  return stored.state;
}
