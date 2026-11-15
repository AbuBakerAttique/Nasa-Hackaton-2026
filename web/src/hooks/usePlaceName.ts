"use client";

import { useEffect, useMemo, useState } from "react";
import { describeNearest, loadPlaces, nearestPlaces, type Place } from "@/lib/places";

export type PlaceName = { status: "idle" | "loading" | "error" } | { status: "ready"; text: string | null };

/**
 * The name of the place nearest to a point, such as a clicked map square.
 * The town list is downloaded the first time a point is given. After that the
 * lookup is instant and synchronous, so a new point never shows an old name.
 */
export function usePlaceName(point: { lat: number; lon: number } | null): PlaceName {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [failed, setFailed] = useState(false);
  const wanted = point !== null;

  useEffect(() => {
    if (!wanted || places) return;
    let active = true;
    loadPlaces().then(
      (list) => active && setPlaces(list),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [wanted, places]);

  const lat = point?.lat;
  const lon = point?.lon;
  return useMemo((): PlaceName => {
    if (lat === undefined || lon === undefined) return { status: "idle" };
    if (places) return { status: "ready", text: describeNearest(nearestPlaces(places, lat, lon)) };
    return { status: failed ? "error" : "loading" };
  }, [places, failed, lat, lon]);
}
