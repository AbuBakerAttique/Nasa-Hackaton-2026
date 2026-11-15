import type { FeatureCollection, Point } from 'geojson';
import type { Bounds } from './map';
import type { WeatherDay, WeatherHour } from './weather';

export interface Observation {
  id: string;
  lat: number;
  lon: number;
  timestamp: string;
  sensor: 'MODIS' | 'VIIRS S-NPP';
  satellite: string;
  confidence: string;
  frp: number;
  type: 0 | 1 | 2 | 3;
  daynight: "D" | "N";
}
export interface ObservationCase {
  title: string;
  bounds: Bounds;
  start: string;
  end: string;
  description: string;
  sources: { file: string; sha256: string; url: string }[];
  observations: Observation[];
}

export function parseObservationCase(value: unknown): ObservationCase {
  const c = value as ObservationCase;
  if (!c || typeof c.title !== 'string' || typeof c.description !== 'string' || !Array.isArray(c.bounds)
    || c.bounds.length !== 4 || !c.bounds.every(Number.isFinite) || !Array.isArray(c.observations) || !c.observations.length) {
    throw new Error('Invalid observation case.');
  }
  const ids = new Set<string>();
  for (const o of c.observations) {
    if (!o || typeof o.id !== 'string' || ids.has(o.id) || !Number.isFinite(o.lat) || Math.abs(o.lat) > 90
      || !Number.isFinite(o.lon) || Math.abs(o.lon) > 180 || !Number.isFinite(o.frp) || o.frp < 0
      || !['MODIS', 'VIIRS S-NPP'].includes(o.sensor) || typeof o.confidence !== 'string'
      || ![0, 1, 2, 3].includes(o.type) || !['D', 'N'].includes(o.daynight)
      || typeof o.timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/.test(o.timestamp)
      || !Number.isFinite(Date.parse(o.timestamp)) || new Date(o.timestamp).toISOString().slice(0,19) + 'Z' !== o.timestamp) {
      throw new Error('Invalid satellite observation.');
    }
    ids.add(o.id);
  }
  return { ...c, observations: [...c.observations].sort((a,b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)) };
}

/** Actual acquisition times only: no inferred movement between passes. */
export function observationFrames(observations: readonly Observation[]) {
  return [...new Set(observations.map(o => o.timestamp))].sort().map(timestamp => ({
    timestamp, observations: observations.filter(o => o.timestamp === timestamp),
  }));
}

/** Descriptive aggregates for exactly the timestamped observations in a case. */
export function observationStatistics(observations: readonly Observation[]) {
  const typeCounts = new Map<number, number>();
  let day = 0;
  let night = 0;
  let frpTotal = 0;
  for (const observation of observations) {
    typeCounts.set(observation.type, (typeCounts.get(observation.type) ?? 0) + 1);
    if (observation.daynight === 'D') day += 1;
    else night += 1;
    frpTotal += observation.frp;
  }
  return {
    detections: observations.length,
    day,
    night,
    frpTotal,
    meanFrp: observations.length ? frpTotal / observations.length : null,
    typeCounts: [...typeCounts.entries()].sort(([a], [b]) => a - b),
  };
}
export function weatherSelection(o: Observation) {
  return { point: { lat: o.lat, lon: o.lon }, date: o.timestamp.slice(0,10), hour: Number(o.timestamp.slice(11,13)) };
}
export function observationGeoJSON(observations: readonly Observation[], selectedId: string | null): FeatureCollection<Point> {
  return {type:'FeatureCollection', features:observations.map(o => ({type:'Feature', id:o.id,
    geometry:{type:'Point',coordinates:[o.lon,o.lat]}, properties:{id:o.id,sensor:o.sensor,selected:o.id===selectedId}}))};
}

/** 72 weather records ending at the matched hour, never after the observation. */
export function precedingHours(days: readonly WeatherDay[], observation: Observation): WeatherHour[] {
  const end = Date.parse(observation.timestamp.slice(0,13) + ':00:00Z');
  const start = end - 72 * 3600000;
  const byTime = new Map<number, WeatherHour>();
  for (const day of days) for (const hour of day.hours) {
    const time = Date.parse(`${day.query.date}T${String(hour.hour).padStart(2,'0')}:00:00Z`);
    if (time > start && time <= end) byTime.set(time,hour);
  }
  return [...byTime.entries()].sort(([a],[b])=>a-b).map(([,h])=>h);
}
export function precedingDates(o: Observation): string[] {
  const end = Date.parse(o.timestamp.slice(0,13) + ':00:00Z');
  return [...new Set(Array.from({length:72},(_,i)=>new Date(end-i*3600000).toISOString().slice(0,10)))].sort();
}
export function weatherHistorySummary(hours: readonly WeatherHour[]) {
  const complete = (key: 'precipitation'|'humidity'|'temperature'|'windSpeed') => hours.length === 72 && hours.every(h=>h[key]!==null);
  return { hours:hours.length,
    rainfall:complete('precipitation') ? hours.reduce((sum,h)=>sum+h.precipitation!,0):null,
    minHumidity:complete('humidity') ? Math.min(...hours.map(h=>h.humidity!)):null,
    maxTemperature:complete('temperature') ? Math.max(...hours.map(h=>h.temperature!)):null,
    maxWind:complete('windSpeed') ? Math.max(...hours.map(h=>h.windSpeed!)):null };
}
