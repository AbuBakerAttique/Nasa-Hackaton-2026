"use client";
import { useEffect, useRef, useState } from "react";

import { currentLocation, locationErrorMessage, parseCoordinates } from "@/lib/location";
import styles from "./LocationSearch.module.css";

type Place = { name: string; latitude: number; longitude: number; country?: string; admin1?: string };
export type MapLocation = { lat: number; lon: number; label: string };

/**
 * Search bar that floats on the map: suggests places while typing, accepts
 * "lat, lon", and can centre on the device location.
 */
export function LocationSearch({ onSelect, onClear }: {
  onSelect: (point: MapLocation) => void;
  /** Called by the × button: clears the search and the chosen place. */
  onClear?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);

  // Suggest places shortly after typing stops. Coordinates need no lookup.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2 || parseCoordinates(text)) return;
    const timer = setTimeout(() => {
      request.current?.abort();
      const controller = new AbortController(); request.current = controller;
      setBusy(true);
      fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=5&language=en&format=json`, {signal: controller.signal})
        .then(response => { if (!response.ok) throw new Error("Place search is unavailable. Try coordinates, e.g. 52.52, 13.40."); return response.json(); })
        .then(data => {
          if (controller.signal.aborted || !mounted.current) return;
          const results: Place[] = Array.isArray(data.results) ? data.results.filter((p: Place) => typeof p.name === "string" && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) : [];
          setPlaces(results); setActive(results.length ? 0 : -1); setOpen(true);
          setMessage(results.length ? "" : "No place found. Try a nearby town or coordinates.");
        })
        .catch(error => { if (!controller.signal.aborted && mounted.current) setMessage(error instanceof Error ? error.message : "Could not search. Please try again."); })
        .finally(() => { if (!controller.signal.aborted && mounted.current) setBusy(false); });
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  function choose(place: Place) {
    onSelect({lat: place.latitude, lon: place.longitude, label: [place.name, place.country].filter(Boolean).join(", ")});
    setQuery(place.name); setPlaces([]); setOpen(false); setMessage("");
  }

  function submit() {
    const point = parseCoordinates(query);
    if (point) { onSelect({...point, label: `${point.lat.toFixed(2)}°, ${point.lon.toFixed(2)}°`}); setOpen(false); setMessage(""); return; }
    if (places.length) { choose(places[Math.max(active, 0)]); return; }
    if (query.trim().length < 2) setMessage("Type a city or town (2+ letters), or coordinates like 52.52, 13.40.");
  }

  async function locate() {
    if (locating) return;
    if (!window.isSecureContext) { setMessage("Location needs a secure (HTTPS) connection. Search for your town instead."); return; }
    if (!navigator.geolocation) { setMessage("Location is unavailable in this browser. Search for your town instead."); return; }
    setLocating(true); setOpen(false);
    setMessage("Finding your location… If your browser asks, choose Allow.");
    try {
      const position = await currentLocation(navigator.geolocation);
      if (!mounted.current) return;
      const {latitude, longitude, accuracy} = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Invalid location");
      onSelect({lat: latitude, lon: longitude, label: "Your current location"});
      setMessage(`Location found (about ${Math.round(accuracy)} m accuracy).`);
    } catch (error) {
      if (mounted.current) setMessage(locationErrorMessage(error as {code?: number}));
    } finally { if (mounted.current) setLocating(false); }
  }

  const showList = open && places.length > 0;
  return (
    <div className={styles.search}>
      <form role="search" className={styles.bar} onSubmit={event => { event.preventDefault(); submit(); }}>
        <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input
          value={query}
          onChange={event => { setQuery(event.target.value); setMessage(""); if (event.target.value.trim().length < 2) { request.current?.abort(); setBusy(false); setPlaces([]); setOpen(false); } }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { if (mounted.current) setOpen(false); }, 150)}
          onKeyDown={event => {
            if (event.key === "ArrowDown" && places.length) { event.preventDefault(); setOpen(true); setActive(i => (i + 1) % places.length); }
            else if (event.key === "ArrowUp" && places.length) { event.preventDefault(); setActive(i => (i - 1 + places.length) % places.length); }
            else if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Search a place or 52.52, 13.40"
          aria-label="Search a city, town or coordinates"
          role="combobox"
          aria-expanded={showList}
          aria-controls="map-place-results"
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `map-place-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {busy && <span className={styles.spinner} aria-hidden="true" />}
        {query && !busy && <button type="button" className={styles.clear} aria-label="Clear search and show all of Europe" title="Clear search" onClick={() => { request.current?.abort(); setBusy(false); setQuery(""); setPlaces([]); setMessage(""); onClear?.(); }}>×</button>}
        <button type="button" className={styles.locate} disabled={locating} aria-busy={locating} onClick={() => void locate()} aria-label="Use my current location" title="Use my current location (asked only when you press this)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
        </button>
      </form>
      {showList && (
        <ul id="map-place-results" role="listbox" aria-label="Place suggestions" className={styles.results}>
          {places.map((place, i) => (
            <li key={`${place.latitude},${place.longitude}`} id={`map-place-${i}`} role="option" aria-selected={i === active}
              onMouseDown={event => { event.preventDefault(); choose(place); }} onMouseEnter={() => setActive(i)}>
              <strong>{place.name}</strong><small>{[place.admin1, place.country].filter(Boolean).join(", ")}</small>
            </li>
          ))}
          <li role="presentation" className={styles.credit}>Places: Open-Meteo / GeoNames · fire data cover 16 European countries</li>
        </ul>
      )}
      {message && <p role="status" className={styles.message}>{message}</p>}
    </div>
  );
}
