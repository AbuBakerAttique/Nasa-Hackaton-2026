"use client";

// Map with one coloured square per 0.25° cell, the outline of a chosen
// region, and drawing tools for a new region. Only draws what lib/ calculated.
// MapLibre needs a browser with WebGL, so it is loaded when the component
// appears, and the page still works if it cannot start.

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { TerraDraw } from "terra-draw";
import { snapToGrid, type Bounds, type SquareValue } from "@/lib/map";
import type { LonLat } from "@/lib/region";
import { observationGeoJSON, type Observation } from "@/lib/observations";

/** OpenFreeMap: free vector tiles, no key or account needed. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
/** Copied there by scripts/copy-map-worker.mjs. */
const WORKER_URL = "/vendor/maplibre-gl-worker.mjs";

// The same pale-yellow-to-deep-red ramp as the calendar (lib/format.ts heatColour).
const FILL_COLOUR = [
  "interpolate",
  ["linear"],
  ["get", "t"],
  0, "hsl(34, 85%, 57%)",
  0.5, "hsl(23, 90%, 59%)",
  1, "hsl(8, 90%, 30%)",
] as const;

function hotspotDots(squares: readonly SquareValue[], max: number, scale: "sqrt" | "linear" = "sqrt") {
  return {
    type: "FeatureCollection" as const,
    features: squares.map(cell => {
      const fraction = max > 0 ? Math.min(cell.value / max, 1) : 0;
      return { type: "Feature" as const, properties: { lat: cell.lat, lon: cell.lon, value: cell.value, t: scale === "sqrt" ? Math.sqrt(fraction) : fraction },
        geometry: { type: "Point" as const, coordinates: [snapToGrid(cell.lon), snapToGrid(cell.lat)] } };
    }),
  };
}

export type DrawMode = "rectangle" | "polygon";

/** Where weather is sampled, and the direction the wind travels TO, in degrees. */
export interface WeatherMarker {
  lat: number;
  lon: number;
  /** null: no wind direction for this hour, so only the point is drawn. */
  towards: number | null;
  /** Text for screen readers and the tooltip. */
  label: string;
}

/**
 * The weather sampling point, with an arrow when there is a direction. The
 * arrow is drawn pointing north and rotated by the "towards" angle, so it
 * points where the wind travels, not where it comes from.
 */
function weatherMarkerElement(marker: WeatherMarker): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", marker.label);
  el.title = marker.label;
  el.dataset.towards = marker.towards === null ? "" : String(Math.round(marker.towards));
  const arrow =
    marker.towards === null
      ? ""
      : '<line x1="24" y1="24" x2="24" y2="5" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M24 1 L31 12 L17 12 Z" fill="#0f172a"/>';
  el.innerHTML =
    '<svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">' +
    arrow +
    '<circle cx="24" cy="24" r="6" fill="#ffffff" stroke="#0f172a" stroke-width="3"/></svg>';
  return el;
}

function outlineGeoJSON(ring: readonly LonLat[] | null) {
  return {
    type: "FeatureCollection" as const,
    features: ring
      ? [{ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [ring.map((p) => [...p])] } }]
      : [],
  };
}

export function FireMap({
  squares,
  max,
  bounds,
  label,
  outline,
  drawMode,
  onDrawn,
  scale = "sqrt",
  weatherPick = false,
  onWeatherPick,
  weatherMarker = null,
  observations = [],
  selectedObservationId = null,
  onObservationSelect,
  darkMode = false,
  onCellSelect,
  animateEntry = false,
}: {
  animateEntry?: boolean;
  darkMode?: boolean;
  onCellSelect?: (lat: number, lon: number) => void;
  squares: readonly SquareValue[];
  /** Value that gets the darkest colour. */
  max: number;
  /** Area to show. The map moves there when it changes. */
  bounds: Bounds | null;
  /** What the map shows, for screen readers. */
  label: string;
  /** Outline of the chosen region, as a closed ring. */
  outline: readonly LonLat[] | null;
  /** The shape being drawn, or null when not drawing. */
  drawMode: DrawMode | null;
  /** Called with the finished shape's ring. */
  onDrawn: (ring: LonLat[]) => void;
  /** Colour scale for the squares, see squaresGeoJSON. */
  scale?: "sqrt" | "linear";
  /** While true, a click on the map chooses the weather sampling point. */
  weatherPick?: boolean;
  onWeatherPick?: (lat: number, lon: number) => void;
  /** The weather sampling point and wind arrow, or null. */
  weatherMarker?: WeatherMarker | null;
  observations?: readonly Observation[];
  selectedObservationId?: string | null;
  onObservationSelect?: (id: string) => void;
}) {
  const entryAnimated = useRef(false);
  const initialEntry = useRef(animateEntry);
  const initialDarkMode = useRef(darkMode);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const onDrawnRef = useRef(onDrawn);
  const onPickRef = useRef(onWeatherPick);
  const pickRef = useRef(weatherPick);
  const markerClassRef = useRef<typeof Marker | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const cellClick = useRef(onCellSelect);
  useEffect(() => { cellClick.current = onCellSelect; }, [onCellSelect]);
  const observationClick = useRef(onObservationSelect);
  const drawing = useRef(drawMode);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [globe, setGlobe] = useState(false);
  useEffect(() => {
    observationClick.current = onObservationSelect;
    drawing.current = drawMode;
  }, [onObservationSelect, drawMode]);

  // The drawing callback can change on every render; the map listener reads the latest.
  useEffect(() => {
    onDrawnRef.current = onDrawn;
    onPickRef.current = onWeatherPick;
    pickRef.current = weatherPick;
  }, [onDrawn, onWeatherPick, weatherPick]);

  // Create the map and the drawing tool once.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let draw: TerraDraw | null = null;

    Promise.all([import("maplibre-gl"), import("terra-draw"), import("terra-draw-maplibre-gl-adapter")])
      .then(([{ Map, Marker: MarkerClass, setWorkerUrl }, td, { TerraDrawMapLibreGLAdapter }]) => {
        if (cancelled || !container.current) return;
        setWorkerUrl(new URL(WORKER_URL, window.location.href).href);
        map = new Map({
          container: container.current,
          style: STYLE_URL,
          center: [0, 18],
          zoom: initialEntry.current ? 0.8 : 3,
          dragRotate: true,
          pitchWithRotate: true,
          attributionControl: { compact: true },
        });
        map.touchZoomRotate.enableRotation();
        markerClassRef.current = MarkerClass;
        // A click chooses the weather point only while that mode is on, so it
        // never clashes with drawing a region.
        map.on("click", (event) => {
          if (pickRef.current) onPickRef.current?.(event.lngLat.lat, event.lngLat.lng);
        });
        map.on("load", () => {
          if (!map || cancelled) return;
          if (initialDarkMode.current) {
            for (const layer of map.getStyle().layers ?? []) {
              if (layer.type === "background") map.setPaintProperty(layer.id, "background-color", "#091725");
              else if (layer.type === "fill") map.setPaintProperty(layer.id, "fill-color", layer.id.includes("water") ? "#102b3c" : "#142737");
              else if (layer.type === "line") map.setPaintProperty(layer.id, "line-color", "#314858");
              else if (layer.type === "symbol" && layer.layout?.["text-field"]) {
                map.setPaintProperty(layer.id, "text-color", "#abc4d7");
                map.setPaintProperty(layer.id, "text-halo-color", "#102132");
              }
            }
          }
          map.addSource("squares", { type: "geojson", data: hotspotDots([], 1) });
          map.addLayer({
            id: "squares",
            type: "circle",
            source: "squares",
            paint: {
              "circle-color": FILL_COLOUR as unknown as string,
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.5, 5, 2.5, 9, 4.5],
              "circle-opacity": 0.8,
              "circle-stroke-color": "rgba(90, 40, 10, 0.45)",
              "circle-stroke-width": 0.4,
            },
          });
          map.on("click", "squares", event => {
            if (pickRef.current || drawing.current) return;
            const properties = event.features?.[0]?.properties;
            if (typeof properties?.lat === "number" && typeof properties.lon === "number") cellClick.current?.(properties.lat, properties.lon);
          });
          map.on("mouseenter", "squares", () => { if (map && !pickRef.current && !drawing.current) map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "squares", () => { if (map) map.getCanvas().style.cursor = pickRef.current ? "crosshair" : ""; });
          map.addSource("region", { type: "geojson", data: outlineGeoJSON(null) });
          map.addSource("observations", { type: "geojson", data: observationGeoJSON([], null) });
          map.addLayer({
            id: "observations", type: "circle", source: "observations",
            paint: {
              "circle-radius": ["case", ["get", "selected"], 9, 6],
              "circle-color": ["match", ["get", "sensor"], "MODIS", "#c65b22", "#167e79"],
              "circle-stroke-color": ["case", ["get", "selected"], "#142b29", "#ffffff"],
              "circle-stroke-width": ["case", ["get", "selected"], 3, 1],
            },
          });
          map.on("click", "observations", (event) => {
            if (pickRef.current || drawing.current) return;
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === "string") observationClick.current?.(id);
          });
          map.addLayer({
            id: "region",
            type: "line",
            source: "region",
            paint: { "line-color": "#1d4ed8", "line-width": 2, "line-dasharray": [3, 2] },
          });

          draw = new td.TerraDraw({
            adapter: new TerraDrawMapLibreGLAdapter({ map }),
            modes: [
              new td.TerraDrawRectangleMode({
                styles: { fillColor: "#1d4ed8", fillOpacity: 0.1, outlineColor: "#1d4ed8", outlineWidth: 2 },
              }),
              new td.TerraDrawPolygonMode({
                styles: { fillColor: "#1d4ed8", fillOpacity: 0.1, outlineColor: "#1d4ed8", outlineWidth: 2 },
              }),
            ],
          });
          draw.start();
          draw.on("finish", (id) => {
            const feature = draw?.getSnapshotFeature(id);
            draw?.clear();
            if (feature?.geometry.type === "Polygon") {
              onDrawnRef.current(feature.geometry.coordinates[0].map(([lon, lat]) => [lon, lat] as LonLat));
            }
          });
          drawRef.current = draw;
          mapRef.current = map;
          setReady(true);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      drawRef.current = null;
      mapRef.current = null;
      try {
        draw?.stop();
      } catch {
        // The map may already be gone.
      }
      map?.remove();
    };
  }, []);

  // Globe view gives a full-world overview; users can rotate it with a drag.
  // Returning to the flat map restores the currently selected area.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (globe) {
      map.setProjection({ type: "globe" });
      map.jumpTo({ center: [0, 18], zoom: 0.8, pitch: 0, bearing: 0 });
    } else {
      map.setProjection({ type: "mercator" });
    }
  }, [ready, globe]);

  // Redraw the squares when the data changes.
  useEffect(() => {
    if (!ready) return;
    mapRef.current?.getSource<GeoJSONSource>("squares")?.setData(hotspotDots(squares, max, scale));
  }, [ready, squares, max, scale]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current?.getSource<GeoJSONSource>("observations")?.setData(observationGeoJSON(observations, selectedObservationId));
  }, [ready, observations, selectedObservationId]);

  // Show the chosen region's outline.
  useEffect(() => {
    if (!ready) return;
    mapRef.current?.getSource<GeoJSONSource>("region")?.setData(outlineGeoJSON(outline));
  }, [ready, outline]);

  // Move to the area when it changes, for example a new country.
  useEffect(() => {
    if (!ready || !bounds || globe) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : initialEntry.current && !entryAnimated.current ? 1800 : 850;
    entryAnimated.current = true;
    mapRef.current?.fitBounds(bounds, { padding: 48, maxZoom: 9, duration });
  }, [ready, bounds, globe]);

  // Crosshair cursor while choosing the weather point.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = weatherPick ? "crosshair" : "";
  }, [ready, weatherPick]);

  // Draw the weather point and arrow. Recreated on change: cheap for one marker.
  useEffect(() => {
    const map = mapRef.current;
    const MarkerClass = markerClassRef.current;
    if (!ready || !map || !MarkerClass) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (!weatherMarker) return;
    markerRef.current = new MarkerClass({
      element: weatherMarkerElement(weatherMarker),
      rotation: weatherMarker.towards ?? 0,
      rotationAlignment: "map",
    })
      .setLngLat([weatherMarker.lon, weatherMarker.lat])
      .addTo(map);
  }, [ready, weatherMarker]);

  // Switch the drawing tool on or off.
  useEffect(() => {
    const draw = drawRef.current;
    if (!ready || !draw) return;
    draw.clear();
    draw.setMode(drawMode ?? "static");
  }, [ready, drawMode]);

  if (failed) {
    return (
      <p role="alert" className="rounded-md border border-accent px-3 py-2 text-sm text-accent">
        The map could not start in this browser. It needs WebGL. The calendar above still works, and a region can be
        typed as a box.
      </p>
    );
  }

  return (
    <div className="relative">
      <div
        ref={container}
        role="region"
        aria-label={label}
        className="h-80 w-full overflow-hidden rounded-md border border-line sm:h-[28rem]"
      />
      <div className="absolute left-3 top-3 z-10 flex gap-1 rounded-lg border border-line bg-background/95 p-1 shadow-sm" role="group" aria-label="Map view">
        <button type="button" aria-pressed={!globe} onClick={() => setGlobe(false)} className={`rounded px-3 py-1.5 text-xs font-medium ${!globe ? "bg-accent text-background" : "hover:bg-muted/20"}`}>2D map</button>
        <button type="button" aria-pressed={globe} onClick={() => setGlobe(true)} className={`rounded px-3 py-1.5 text-xs font-medium ${globe ? "bg-accent text-background" : "hover:bg-muted/20"}`}>Rotatable globe</button>
      </div>
      {globe && <p className="pointer-events-none absolute bottom-3 left-3 z-10 rounded bg-background/90 px-2 py-1 text-xs text-muted">Drag to rotate · Wheel or pinch to zoom</p>}
    </div>
  );
}
