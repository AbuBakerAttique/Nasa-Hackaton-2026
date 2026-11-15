"use client";
import { useEffect, useRef, useState } from "react";

import { currentLocation, locationErrorMessage } from "@/lib/location";

type Place = { name: string; latitude: number; longitude: number; country?: string; admin1?: string };
export type MapLocation = { lat: number; lon: number; label: string };
export function LocationSearch({ onSelect }: { onSelect: (point: MapLocation) => void }) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const request = useRef<AbortController | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, []);
  async function search() {
    if (query.trim().length < 2) { setMessage("Enter a city or town name, using at least 2 letters."); return; }
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setMessage(""); setPlaces([]);
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5&language=en&format=json`, {signal: controller.signal});
      if (!response.ok) throw new Error("Place search is unavailable. Try coordinates instead.");
      const data = await response.json();
      const results: Place[] = Array.isArray(data.results) ? data.results.filter((p: Place) => typeof p.name === "string" && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) : [];
      if (!controller.signal.aborted && active.current) { setPlaces(results); if (!results.length) setMessage("No place found. Try a nearby town or enter coordinates."); }
    } catch (error) { if (!controller.signal.aborted && active.current) setMessage(error instanceof Error ? error.message : "Could not search. Please try again."); }
    finally { if (!controller.signal.aborted && active.current) setBusy(false); }
  }
  async function locate() {
    if (locating) return;
    if (!window.isSecureContext) { setMessage("Location requires a secure connection. Open the HTTPS version of this site, or search for your town."); return; }
    if (!navigator.geolocation) { setMessage("Location is unavailable in this browser. Open this page in Chrome, Safari, Firefox or Edge, or search for your town."); return; }
    setLocating(true);
    setMessage("Finding your location… If your browser asks, choose Allow. This may take up to 25 seconds.");
    try {
      const position = await currentLocation(navigator.geolocation);
      if (!active.current) return;
      const {latitude, longitude, accuracy} = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Invalid location");
      setLat(latitude.toFixed(5)); setLon(longitude.toFixed(5)); setPlaces([]);
      onSelect({lat: latitude, lon: longitude, label: "Your current location"});
      setMessage(`Location found (approximately ${Math.round(accuracy)} m accuracy). The map is centred on your location.`);
    } catch (error) {
      if (active.current) setMessage(locationErrorMessage(error as {code?:number}));
    } finally { if (active.current) setLocating(false); }
  }
  return <section className="location-search" aria-labelledby="location-search-title">
    <h3 id="location-search-title">Find a place</h3>
    <form onSubmit={event => { event.preventDefault(); void search(); }}>
      <label htmlFor="place-search">City or town</label>
      <div className="place-search-row"><input id="place-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. Berlin" autoComplete="off"/><button type="submit" disabled={busy}>{busy ? "Searching…" : "Search"}</button></div>
    </form>
    {places.length > 0 && <ul className="place-results" aria-label="Place search results">{places.map((place, i) => <li key={i}><button type="button" onClick={() => { onSelect({lat: place.latitude, lon: place.longitude, label: [place.name, place.country].filter(Boolean).join(", ")}); setPlaces([]); setMessage(`Showing ${place.name}.`); }}>{place.name}<small>{[place.admin1, place.country].filter(Boolean).join(", ")}</small></button></li>)}</ul>}
    <button type="button" className="locate-button" disabled={locating} aria-busy={locating} onClick={() => void locate()}>{locating ? "Finding your location…" : "Use my current location"}</button>
    <details><summary>Enter latitude and longitude</summary><form onSubmit={event => { event.preventDefault(); const latitude = Number(lat), longitude = Number(lon); if (!lat.trim() || !lon.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) { setMessage("Enter a latitude from −90 to 90 and longitude from −180 to 180."); return; } onSelect({lat:latitude, lon:longitude, label:"Entered coordinates"}); setMessage("Showing your coordinates."); }}>
      <label htmlFor="location-latitude">Latitude (north / south)</label><input id="location-latitude" value={lat} onChange={e=>setLat(e.target.value)} inputMode="decimal" placeholder="52.52"/>
      <label htmlFor="location-longitude">Longitude (east / west)</label><input id="location-longitude" value={lon} onChange={e=>setLon(e.target.value)} inputMode="decimal" placeholder="13.40"/>
      <button type="submit">Show this location</button>
    </form></details>
    <p role="status">{message}</p>
    <p>Fire data cover 16 European countries. Place search uses Open-Meteo / GeoNames. Your location is requested only when you press the location button.</p>
  </section>;
}
