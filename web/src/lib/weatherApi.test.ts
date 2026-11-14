import { describe, expect, it, vi } from "vitest";
import { WeatherError } from "./weather";
import { WeatherCache, currentWeather, type StoredWeather } from "./weatherApi";
import { sampleAnswer } from "./weather.fixture";

const query = { lat: 52.5, lon: 13.4, date: "2018-07-25" };

/** A fetch that answers like Open-Meteo, for the date in the URL. */
function fakeFetch(status = 200, body?: unknown) {
  return vi.fn(async (url: string) => {
    const date = new URL(url).searchParams.get("start_date")!;
    return { ok: status >= 200 && status < 300, status, json: async () => body ?? sampleAnswer(date) };
  });
}

/** A promise that the test resolves later. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("WeatherCache", () => {
  it("fetches each day once and then answers from the cache", async () => {
    const fetchImpl = fakeFetch();
    const cache = new WeatherCache(fetchImpl);
    const a = await cache.load(query);
    const b = await cache.load({ ...query, lat: 52.501 }); // rounds to the same key
    expect(b).toBe(a);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await cache.load({ ...query, date: "2018-07-26" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });

  it("shares one request between callers asking for the same day at once", async () => {
    const fetchImpl = fakeFetch();
    const cache = new WeatherCache(fetchImpl);
    const [a, b] = await Promise.all([cache.load(query), cache.load(query)]);
    expect(a).toBe(b);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("explains API failures and does not cache them", async () => {
    const failing = new WeatherCache(fakeFetch(400, { error: true, reason: "Invalid date" }));
    await expect(failing.load(query)).rejects.toThrow("The weather service could not answer: Invalid date");
    expect(failing.size).toBe(0);

    await expect(new WeatherCache(fakeFetch(429, {})).load(query)).rejects.toThrow("too many requests");

    const offline = new WeatherCache(vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(offline.load(query)).rejects.toBeInstanceOf(WeatherError);
  });

  it("can try again after a failure", async () => {
    let calls = 0;
    const cache = new WeatherCache(async (url: string) => {
      calls += 1;
      if (calls === 1) throw new TypeError("Failed to fetch");
      return { ok: true, status: 200, json: async () => sampleAnswer(new URL(url).searchParams.get("start_date")!) };
    });
    await expect(cache.load(query)).rejects.toThrow("Could not reach the weather service");
    await expect(cache.load(query)).resolves.toBeDefined();
  });

  it("lets a caller stop waiting, while the day still lands in the cache", async () => {
    const gate = deferred<void>();
    const cache = new WeatherCache(async (url: string) => {
      await gate.promise;
      return { ok: true, status: 200, json: async () => sampleAnswer(new URL(url).searchParams.get("start_date")!) };
    });
    const controller = new AbortController();
    const waiting = cache.load(query, controller.signal);
    controller.abort();
    await expect(waiting).rejects.toBeDefined();
    gate.resolve();
    await expect(cache.load(query)).resolves.toBeDefined();
    expect(cache.size).toBe(1);
  });
});

describe("stale responses", () => {
  const ready = (key: string): StoredWeather => ({
    key,
    state: { status: "ready", day: { query, grid: { lat: 0, lon: 0, elevation: null }, hours: [] } },
  });

  it("never shows a result that belongs to an earlier choice", () => {
    // Day A was requested, then the user chose day B before A arrived.
    expect(currentWeather(ready("era5|52.5|13.4|2018-07-25"), "era5|52.5|13.4|2018-07-26")).toEqual({
      status: "loading",
    });
    expect(currentWeather(ready("era5|52.5|13.4|2018-07-26"), "era5|52.5|13.4|2018-07-26").status).toBe("ready");
    expect(currentWeather(null, "era5|52.5|13.4|2018-07-26")).toEqual({ status: "loading" });
    expect(currentWeather(ready("x"), null)).toEqual({ status: "idle" });
  });

  it("a slow earlier request finishing last does not replace the newer one", async () => {
    // The hook stores each result with its key and shows only the current key.
    const slow = deferred<void>();
    const cache = new WeatherCache(async (url: string) => {
      const date = new URL(url).searchParams.get("start_date")!;
      if (date === "2018-07-25") await slow.promise;
      return { ok: true, status: 200, json: async () => sampleAnswer(date) };
    });
    let stored: StoredWeather | null = null;
    const run = (date: string) => {
      const key = `era5|52.5|13.4|${date}`;
      return cache.load({ ...query, date }).then((day) => {
        stored = { key, state: { status: "ready", day } };
      });
    };
    const first = run("2018-07-25");
    await run("2018-07-26");
    const currentKey = "era5|52.5|13.4|2018-07-26";
    slow.resolve();
    await first; // the old answer arrives last …
    // … and is stored under its own key, so it is not shown for the new choice.
    expect(currentWeather(stored, currentKey)).toEqual({ status: "loading" });
  });
});
