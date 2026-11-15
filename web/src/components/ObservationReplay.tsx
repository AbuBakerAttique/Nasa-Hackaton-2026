'use client';

import { useEffect, useMemo, useState } from 'react';
import rawCase from '../../public/case-studies/brandenburg-2022.json';
import { FireMap } from './FireMap';
import { WeatherPanel } from './WeatherPanel';
import { useHistoricalWeather } from '@/hooks/useHistoricalWeather';
import { parseObservationCase, observationFrames, observationStatistics, precedingDates, precedingHours, weatherHistorySummary, weatherSelection, type Observation } from '@/lib/observations';
import { weatherCache } from '@/lib/weatherApi';
import { formatMeasure, type WeatherDay } from '@/lib/weather';

const example = parseObservationCase(rawCase);
const frames = observationFrames(example.observations);
const caseStats = observationStatistics(example.observations);
const noop = () => {};
const buttonClass = 'rounded-md border border-line px-3 py-2 text-sm hover:border-foreground disabled:opacity-40';
const utc = (timestamp: string) => timestamp.replace('T',' ').replace(':00Z',' UTC');
const hotspotType = (type: number) => ({
  0: 'Presumed vegetation fire',
  1: 'Active volcano',
  2: 'Other static land source',
  3: 'Offshore detection',
}[type] ?? 'Unknown type');

function BeforeDetection({ observation }: { observation: Observation }) {
  const [enabled,setEnabled] = useState(false);
  const [result,setResult] = useState<{days?:WeatherDay[];error?:string}>({});
  useEffect(()=>{
    if (!enabled) return;
    const controller = new AbortController();
    Promise.all(precedingDates(observation).map(date=>weatherCache.load({lat:observation.lat,lon:observation.lon,date},controller.signal)))
      .then(days=>{if (!controller.signal.aborted) setResult({days});})
      .catch((e:unknown)=>{if (!controller.signal.aborted) setResult({error:e instanceof Error?e.message:'Could not load weather history.'});});
    return ()=>controller.abort();
  },[enabled,observation]);
  const summary = result.days ? weatherHistorySummary(precedingHours(result.days,observation)) : null;
  return <section className="insight-card mt-4" aria-labelledby="before-detection-heading">
    <p className="eyebrow mb-2">BEFORE DETECTION</p><h3 id="before-detection-heading">The preceding 72 weather hours</h3>
    <p className="mt-2 text-sm text-muted">Conditions for the 72 hours ending at the matched UTC hour. These describe weather, not the cause of ignition or a prediction.</p>
    {!enabled && <button type="button" className={`${buttonClass} mt-3`} onClick={()=>setEnabled(true)}>Load preceding weather</button>}
    <div aria-live="polite">
      {enabled && !summary && !result.error && <p className="mt-3 text-sm">Loading up to four days of ERA5 estimates…</p>}
      {result.error && <p role="alert" className="mt-3 text-sm text-accent">{result.error} <button className="underline" onClick={()=>{setResult({});setEnabled(false);}}>Reset</button></p>}
      {summary && <><dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[['Rainfall',formatMeasure(summary.rainfall,'mm')],['Lowest humidity',formatMeasure(summary.minHumidity,'%')],['Highest temperature',formatMeasure(summary.maxTemperature,'°C')],['Strongest hourly wind',formatMeasure(summary.maxWind,'km/h')]].map(([label,value])=><div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd></div>)}
      </dl><p className="mt-3 text-xs text-muted">{summary.hours}/72 hourly records. Any incomplete variable is shown as “no value”; missing rainfall is never counted as zero. Source: Open-Meteo / ERA5.</p></>}
    </div>
  </section>;
}

function ActiveReplay() {
  const [frameIndex,setFrameIndex] = useState(0);
  const frame = frames[frameIndex];
  const [selectedId,setSelectedId] = useState(frame.observations[0].id);
  const selected = frame.observations.find(o=>o.id===selectedId) ?? frame.observations[0];
  const weather = useHistoricalWeather(null,2022,2022);
  const [weatherLinked,setWeatherLinked] = useState(false);
  // Called by explicit user actions only: the observation minute is retained,
  // while weather is sampled at the start of its enclosing UTC hour.
  function selectObservation(o:Observation) {
    setSelectedId(o.id);
    const selection = weatherSelection(o);
    weather.setPoint(selection.point); weather.setDate(selection.date); weather.setHour(selection.hour);
    setWeatherLinked(true);
  }
  function moveFrame(index:number) {
    setFrameIndex(index);
    selectObservation(frames[index].observations[0]);
  }
  const points = useMemo(()=>frame.observations,[frame]);
  const frameStats = useMemo(()=>{
    const meanFrp=points.reduce((sum,o)=>sum+o.frp,0)/Math.max(points.length,1);
    const typeCounts=new Map<number,number>();
    for(const o of points) typeCounts.set(o.type,(typeCounts.get(o.type)??0)+1);
    return {day:points.filter(o=>o.daynight==='D').length,night:points.filter(o=>o.daynight==='N').length,meanFrp,typeCounts:[...typeCounts.entries()].sort(([a],[b])=>a-b)};
  },[points]);
  return <div className="mt-5">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={buttonClass} disabled={frameIndex===0} onClick={()=>moveFrame(frameIndex-1)}>← Previous pass</button>
      <button type="button" className={buttonClass} disabled={frameIndex===frames.length-1} onClick={()=>moveFrame(frameIndex+1)}>Next pass →</button>
      <span className="text-sm text-muted">Acquisition {frameIndex+1} of {frames.length} · {utc(frame.timestamp)}</span>
    </div>
    <label htmlFor="observation-frame" className="mt-4 block text-sm font-medium">Replay actual acquisition times</label>
    <input id="observation-frame" type="range" min={0} max={frames.length-1} value={frameIndex} aria-valuetext={utc(frame.timestamp)} onChange={e=>moveFrame(Number(e.target.value))} className="mt-2 w-full accent-[var(--accent)]" />
    <p className="my-3 text-xs text-muted">Orange: MODIS · teal: VIIRS · outlined: selected. Only the current acquisition is shown. Gaps between satellite passes are not filled or simulated.</p>
    <section className="insight-card mb-4" aria-label="Selected satellite acquisition statistics">
      <p className="eyebrow mb-2">ACQUISITION STATISTICS · {points.length} DETECTIONS</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><dt className="text-xs text-muted">Day / night flags</dt><dd className="font-medium">{frameStats.day} day · {frameStats.night} night</dd></div>
        <div><dt className="text-xs text-muted">Mean pixel FRP</dt><dd className="font-medium">{frameStats.meanFrp.toFixed(1)} MW</dd></div>
        <div className="col-span-2"><dt className="text-xs text-muted">NASA hotspot type</dt><dd className="font-medium">{frameStats.typeCounts.map(([type,n])=>`${n} ${hotspotType(type).toLowerCase()} (type ${type})`).join(' · ')}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-muted">FRP is the mean per detected pixel for this acquisition, not burned area or the total energy of a fire. Type is NASA’s inferred hotspot class, not a verified cause.</p>
    </section>
    <FireMap squares={[]} max={1} bounds={example.bounds} label="Timestamped satellite observations in Brandenburg" outline={null} drawMode={null} onDrawn={noop}
      observations={points} selectedObservationId={selected.id} onObservationSelect={id=>{const o=points.find(o=>o.id===id);if(o)selectObservation(o);}}
      weatherMarker={weatherLinked?weather.marker:null} />
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="insight-card"><p className="eyebrow mb-2">SATELLITE OBSERVATION</p>
        <label htmlFor="observation-select" className="block text-sm font-medium">Select a detected hotspot</label>
        <select id="observation-select" value={selected.id} onChange={e=>selectObservation(points.find(o=>o.id===e.target.value)!)} className="mt-2 w-full rounded-md border border-line bg-background p-2 text-sm">
          {points.map((o,i)=><option key={o.id} value={o.id}>{i+1}. {o.sensor} · {o.lat.toFixed(3)}°, {o.lon.toFixed(3)}°</option>)}
        </select>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt>Acquired</dt><dd>{utc(selected.timestamp)}</dd><dt>Sensor</dt><dd>{selected.sensor} · satellite {selected.satellite}</dd><dt>Confidence</dt><dd>{selected.sensor==='MODIS'?`${selected.confidence}/100`:selected.confidence==='h'?'High':'Nominal'}</dd><dt>Type</dt><dd>{selected.type} · {hotspotType(selected.type)}</dd><dt>Day/night</dt><dd>{selected.daynight==='D'?'Daytime':'Nighttime'} ({selected.daynight})</dd><dt>FRP</dt><dd>{selected.frp.toFixed(1)} MW (detected-pixel FRP)</dd></dl>
        <button type="button" className={`${buttonClass} mt-4`} onClick={()=>selectObservation(selected)}>Show weather for this detection</button>
      </div>
      <div className="insight-card"><p className="eyebrow mb-2">WHAT THIS REPLAY SHOWS</p><p className="text-sm leading-relaxed">{example.description}</p><p className="mt-3 text-sm text-muted">A hotspot marks a satellite pixel containing a thermal detection. Repeated detections may belong to the same fire. The timestamp is the overpass time, not ignition time.</p>
        <p className="mt-3 text-sm text-muted">Weather is initially matched to {selected.timestamp.slice(11,13)}:00 UTC; the satellite observed at {selected.timestamp.slice(11,16)} UTC. No causal attribution or spread forecast is made.</p>
      </div>
    </div>
    {weatherLinked && <><WeatherPanel weather={weather} month={null} onPickingChange={noop} allowPointPicking={false}/><BeforeDetection key={selected.id} observation={selected}/></>}
  </div>;
}

export function ObservationReplay() {
  const [opened,setOpened]=useState(false);
  return <section id="observation-replay" className="spatial-card mt-8" aria-labelledby="replay-heading">
    <div className="section-heading"><div><p className="eyebrow">05 / CONNECT HOTSPOTS AND WEATHER</p><h2 id="replay-heading">Explore a detected fire</h2></div><span className="source-chip">Historical observation replay</span></div>
    <p className="mt-3 text-sm text-muted">{example.title} · {example.observations.length} filtered detections · {frames.length} acquisition times. Select a hotspot to inspect its weather context.</p>
    <section className="insight-card mt-4" aria-label="Statistics for the Brandenburg case study">
      <p className="eyebrow mb-3">CASE STUDY STATISTICS · {example.start} TO {example.end}</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="metric-tile"><dt className="text-xs text-muted">Detections</dt><dd className="text-sm font-semibold">{caseStats.detections.toLocaleString()}</dd></div>
        <div className="metric-tile"><dt className="text-xs text-muted">Day / night</dt><dd className="text-sm font-semibold">{caseStats.day} day · {caseStats.night} night</dd></div>
        <div className="metric-tile"><dt className="text-xs text-muted">Mean pixel FRP</dt><dd className="text-sm font-semibold">{caseStats.meanFrp?.toFixed(1) ?? '—'} MW</dd></div>
        <div className="metric-tile"><dt className="text-xs text-muted">Summed pixel FRP</dt><dd className="text-sm font-semibold">{caseStats.frpTotal.toFixed(1)} MW</dd></div>
        <div className="metric-tile"><dt className="text-xs text-muted">NASA type</dt><dd className="text-sm font-semibold">{caseStats.typeCounts.map(([type,n])=>`${hotspotType(type)} · ${n}`).join(', ')}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-muted">Aggregates cover these {caseStats.detections} timestamped records only. This replay filters to type 0 (presumed vegetation fire), so other types are excluded. FRP is detected-pixel fire radiative power; its sum is not total fire energy or burned area.</p>
    </section>
    {!opened?<button type="button" className={`${buttonClass} mt-4`} onClick={()=>setOpened(true)}>Open observation replay</button>:<ActiveReplay/>}
    <details className="mt-4 text-xs text-muted"><summary>Source files and selection</summary><p className="mt-2">Fixed bounds: {example.bounds.join(', ')} (west, south, east, north). {example.start} through {example.end}. Presumed vegetation fires only; MODIS confidence ≥30; VIIRS nominal/high.</p>
      {example.sources.map(s=><p key={s.file} className="mt-2 break-all"><a href={s.url} target="_blank" rel="noreferrer" className="underline">NASA FIRMS: {s.file}</a><br/>SHA-256: {s.sha256}</p>)}
    </details>
  </section>;
}
