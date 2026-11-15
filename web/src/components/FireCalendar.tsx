"use client";

// Country menu, region, record switch, date range, the burning calendar and the map.

import { useMemo, useRef, useState } from "react";
import { LocationSearch, type MapLocation } from "./LocationSearch";
import workspace from "./ExplorerWorkspace.module.css";
import { CalendarGrid, type MonthPick } from "@/components/CalendarGrid";
import { FindingsPanel } from "@/components/FindingsPanel";
import { FireMap, type DrawMode } from "@/components/FireMap";
import { FireSciencePanel } from "@/components/FireSciencePanel";
import { HowCalculatedPanel } from "@/components/HowCalculatedPanel";
import { RegionPanel } from "@/components/RegionPanel";
import { TrendsPanel } from "@/components/TrendsPanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { useCells } from "@/hooks/useCells";
import { useHistoricalWeather } from "@/hooks/useHistoricalWeather";
import harmonizationReport from "../../public/data/report.json";
import { buildTable, rowValue, type RecordKind } from "@/lib/calendar";
import type { ExplorerSelection } from "@/lib/explorer-selection";
import { monthName } from "@/lib/format";
import { allCellBounds, squareValues, viewBounds } from "@/lib/map";
import { burnFrequency, describeFrequency, extentByMonth, extentCaution } from "@/lib/trends";
import { countriesInRegion, regionBounds, regionLabel, rowsInRegion, type LonLat, type Region } from "@/lib/region";
import { countriesForStudyArea, studyAreaIsAvailable, studyAreaYears, STUDY_AREAS } from "@/lib/study-areas";
import { COL, VIIRS_FIRST_YEAR, type DataIndex } from "@/lib/types";

const DEFAULT_COUNTRY = "Germany";
const DEFAULT_STUDY_AREA = STUDY_AREAS[0];

const EXPLAIN: Record<RecordKind, string> = {
  corrected: `Corrected record: before ${VIIRS_FIRST_YEAR}, MODIS counts are scaled by one Europe-wide overlap ratio; from ${VIIRS_FIRST_YEAR}, values are observed VIIRS S-NPP counts. Earlier values are aggregate estimates and cannot add cells MODIS missed.`,
  raw: `Raw record: MODIS Terra/Aqua detections through ${VIIRS_FIRST_YEAR - 1}, then VIIRS S-NPP detections from ${VIIRS_FIRST_YEAR}. The count shift reflects different sensors and detection characteristics; it is not by itself evidence that fire occurrence changed.`,
};

const RECORDS: { id: RecordKind; label: string }[] = [
  { id: "corrected", label: "Corrected" },
  { id: "raw", label: "Raw" },
];

const fieldClass = "mt-1 rounded-md border border-line bg-background px-3 py-2";

export function FireCalendar({ index, view = "explore", initialSelection }: { index: DataIndex; view?: "explore" | "statistics"; initialSelection?: ExplorerSelection }) {
  const [countryId, setCountryId] = useState(
    initialSelection?.countryId ?? (index.countries.some((c) => c.id === DEFAULT_COUNTRY) ? DEFAULT_COUNTRY : (index.countries[0]?.id ?? "")),
  );
  const optionsRef = useRef<HTMLDetailsElement>(null);
  const [location, setLocation] = useState<(MapLocation & { period: string }) | null>(null);
  const [selectedCell, setSelectedCell] = useState<{lat: number; lon: number} | null>(null);
  const [record, setRecord] = useState<RecordKind>(initialSelection?.record ?? "corrected");
  const [firstYear, setFirstYear] = useState(initialSelection?.firstYear ?? Math.max(index.firstYear, studyAreaYears(DEFAULT_STUDY_AREA)[0]));
  const [lastYear, setLastYear] = useState(initialSelection?.lastYear ?? Math.min(index.lastYear, studyAreaYears(DEFAULT_STUDY_AREA)[1]));
  const [picked, setPicked] = useState<MonthPick | null>(initialSelection?.picked ?? null);
  const [region, setRegion] = useState<Region | null>(initialSelection?.region ?? null);
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  /** What the map colours: fire in the chosen period, or how many years each square burned. */
  const [mapView, setMapView] = useState<"amount" | "frequency">("amount");
  const [studyAreaId, setStudyAreaId] = useState<string | null>(initialSelection ? initialSelection.studyAreaId : "southern-europe");
  const studyArea = STUDY_AREAS.find((area) => area.id === studyAreaId) ?? null;

  const country = index.countries.find((c) => c.id === countryId);
  // A region loads every country it touches; otherwise the chosen country.
  const sources = useMemo(
    () => (region ? countriesInRegion(index.countries, region) : studyArea ? countriesForStudyArea(studyArea, index) : country ? [country] : []),
    [region, studyArea, country, index],
  );
  const data = useCells(sources.map((c) => c.file));
  const loaded = data.status === "ready" ? data.rows : null;
  const rows = useMemo(() => (loaded && region ? rowsInRegion(loaded, region) : loaded), [loaded, region]);
  const areaName = region ? regionLabel(region) : (studyArea?.name ?? country?.name ?? "");
  const sourceNames = sources.map((c) => c.name).join(", ");
  const selectedDataSummary = useMemo(() => {
    if (!rows) return null;
    return rows.reduce((summary, row) => {
      if (row[COL.year] < firstYear || row[COL.year] > lastYear) return summary;
      if (row[COL.year] < VIIRS_FIRST_YEAR) {
        summary.modisPreViirs += row[COL.modisRaw];
        summary.modisFrpPreViirs += row[COL.modisFrp];
      } else {
        summary.viirsSince2012 += row[COL.viirsRaw];
        summary.viirsFrpSince2012 += row[COL.viirsFrp];
      }
      summary.correctedCount += row[COL.harmonized];
      summary.correctedFrp += row[COL.harmonizedFrp];
      return summary;
    }, { modisPreViirs: 0, viirsSince2012: 0, correctedCount: 0, modisFrpPreViirs: 0, viirsFrpSince2012: 0, correctedFrp: 0 });
  }, [rows, firstYear, lastYear]);

  // Both records are built so they share one colour scale: switching then
  // shows the real difference instead of two tables each scaled to itself.
  const tables = useMemo(() => {
    if (!rows) return null;
    const range = { measure: "count" as const, firstYear, lastYear };
    return {
      corrected: buildTable(rows, { record: "corrected", ...range }),
      raw: buildTable(rows, { record: "raw", ...range }),
    };
  }, [rows, firstYear, lastYear]);
  const max = tables ? Math.max(0, ...tables.corrected.values.flat(), ...tables.raw.values.flat()) : 0;

  // A picked month outside the chosen years no longer applies.
  const month = picked && picked.year >= firstYear && picked.year <= lastYear ? picked : null;

  const cellInfo = useMemo(() => {
    if (!selectedCell || !rows) return null;
    const matches = rows.filter(row => row[COL.lat] === selectedCell.lat && row[COL.lon] === selectedCell.lon &&
      (month ? row[COL.year] === month.year && row[COL.month] === month.month : row[COL.year] >= firstYear && row[COL.year] <= lastYear));
    if (!matches.length) return null;
    return matches.reduce((total, row) => ({
      count: total.count + rowValue(row, record, "count"), frp: total.frp + rowValue(row, record, "frp"),
      modis: total.modis + row[COL.modisRaw], viirs: total.viirs + row[COL.viirsRaw],
      estimated: total.estimated || (record === "corrected" && row[COL.year] < VIIRS_FIRST_YEAR && row[COL.modisRaw] > 0),
    }), { count: 0, frp: 0, modis: 0, viirs: 0, estimated: false });
  }, [selectedCell, rows, month, firstYear, lastYear, record]);

  // Use the most active fire grid cell in the selected month as the automatic
  // weather sampling point. Users can move it to another point on the map.
  const suggestedWeatherPoint = useMemo(() => {
    if (selectedCell && cellInfo) return selectedCell;
    if (!rows || !month) return null;
    const cells = squareValues(rows, { record, measure: "count", firstYear, lastYear, month });
    const hottest = cells.reduce<(typeof cells)[number] | null>(
      (best, cell) => (!best || cell.value > best.value ? cell : best),
      null,
    );
    return hottest ? { lat: hottest.lat, lon: hottest.lon } : null;
  }, [rows, record, firstYear, lastYear, month, selectedCell, cellInfo]);

  // Historical weather context. Separate from the fire data: it never changes it.
  const weather = useHistoricalWeather(month, index.firstYear, index.lastYear, suggestedWeatherPoint);
  // Choosing a weather point and drawing a region both use map clicks, so
  // only one of them is on at a time.
  const chooseDrawMode = (mode: DrawMode | null) => {
    setDrawMode(mode);
    if (mode) weather.setPicking(false);
  };


  // The map uses the same idea: both records on one colour scale.
  const squares = useMemo(() => {
    if (!rows) return null;
    const options = { measure: "count" as const, firstYear, lastYear, month };
    return {
      corrected: squareValues(rows, { record: "corrected", ...options }),
      raw: squareValues(rows, { record: "raw", ...options }),
    };
  }, [rows, firstYear, lastYear, month]);
  const squareMax = squares ? Math.max(0, ...[...squares.corrected, ...squares.raw].map((s) => s.value)) : 0;

  const extent = useMemo(
    () => (rows ? extentByMonth(rows, { record, measure: "count", firstYear, lastYear }) : null),
    [rows, record, firstYear, lastYear],
  );
  const frequency = useMemo(
    () => (rows ? burnFrequency(rows, { record, measure: "count", firstYear, lastYear }) : null),
    [rows, record, firstYear, lastYear],
  );
  const yearCount = lastYear - firstYear + 1;
  const locationPeriod = `${firstYear}/${lastYear}/${month?.year ?? "all"}/${month?.month ?? "all"}/${record}`;
  const bounds = useMemo(() => {
    if (location && location.period === locationPeriod) {
      const mapLatitude = Math.max(-84.5, Math.min(84.5, location.lat));
      return [Math.max(-180,location.lon-.5), mapLatitude-.5, Math.min(180,location.lon+.5), mapLatitude+.5] as [number,number,number,number];
    }
    const active = squares?.[record] ?? [];
    if (active.length) {
      const extent = active.reduce((box, cell) => ({
        west: Math.min(box.west, cell.lon), east: Math.max(box.east, cell.lon),
        south: Math.min(box.south, cell.lat), north: Math.max(box.north, cell.lat),
      }), { west: Infinity, east: -Infinity, south: Infinity, north: -Infinity });
      return [extent.west - 0.125, extent.south - 0.125, extent.east + 0.125, extent.north + 0.125] as [number, number, number, number];
    }
    if (region) return regionBounds(region);
    return rows ? (studyArea ? allCellBounds(rows) : viewBounds(rows)) : null;
  }, [region, rows, studyArea, squares, record, location, locationPeriod]);
  const outline = useMemo((): LonLat[] | null => {
    if (!region) return null;
    if (region.kind === "polygon") return region.ring;
    const { south: s, north: n, west: w, east: e } = region;
    return [[w, s], [e, s], [e, n], [w, n], [w, s]];
  }, [region]);

  const mapPeriod =
    mapView === "frequency"
      ? `years with fire, ${firstYear} to ${lastYear}`
      : month
        ? `${monthName(month.month, true)} ${month.year}`
        : firstYear === lastYear
          ? `${firstYear}`
          : `${firstYear} to ${lastYear}, all months added up`;

  const years = Array.from({ length: index.lastYear - index.firstYear + 1 }, (_, i) => index.firstYear + i);

  const selectionQuery = new URLSearchParams({selection: JSON.stringify({countryId,studyAreaId,firstYear,lastYear,record,picked:month,region})}).toString();
  const filters = (        <div className={workspace.topFilters} aria-label="Explorer filters">
          <div className={workspace.topArea}>            <label className={workspace.areaLabel} htmlFor="map-area">Study area</label>
            <select id="map-area" className={workspace.areaSelect} value={studyArea ? "europe" : countryId} onChange={event => {
              setRegion(null); setDrawMode(null); setLocation(null);
              if (event.target.value === "europe") setStudyAreaId(DEFAULT_STUDY_AREA.id);
              else { setStudyAreaId(null); setCountryId(event.target.value); }
            }}><option value="europe">All Europe · 16 countries</option>{index.countries.map(country=><option key={country.id} value={country.id}>{country.name}</option>)}</select>
</div>
        <div>
          <label htmlFor="first-year" className="block text-sm font-medium">
            From
          </label>
          <select
            id="first-year"
            value={firstYear}
            onChange={(event) => setFirstYear(Number(event.target.value))}
            className={fieldClass}
          >
            {years
              .filter((y) => y <= lastYear)
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label htmlFor="last-year" className="block text-sm font-medium">
            To
          </label>
          <select
            id="last-year"
            value={lastYear}
            onChange={(event) => setLastYear(Number(event.target.value))}
            className={fieldClass}
          >
            {years
              .filter((y) => y >= firstYear)
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </div>

        <div role="group" aria-labelledby="record-label">
          <span id="record-label" className="block text-sm font-medium">
            Record
          </span>
          <div className="mt-1 inline-flex rounded-md border border-line p-0.5">
            {RECORDS.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={record === r.id}
                onClick={() => setRecord(r.id)}
                className={
                  "rounded px-3 py-1.5 text-sm " +
                  (record === r.id ? "bg-accent font-medium text-background" : "text-muted hover:text-foreground")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        </div>
);

  return (
    <section id="explorer" className="explorer" aria-labelledby="calendar-heading">
      <div className="section-heading">
        <div><p className="eyebrow">01 / EXPLORE THE RECORD</p><h2 id="calendar-heading">{view === "statistics" ? "Statistics & methodology" : "Fire activity explorer"}</h2></div>
        <a className={workspace.pageLink} href={view === "statistics" ? `/?${selectionQuery}` : `/statistics?${selectionQuery}`}>{view === "statistics" ? "← Back to map & calendar" : "View statistics →"}</a>
      </div>

      {view === "explore" && <div id="spatial-view" className={workspace.workspace}>
        <div className={workspace.header}>
          <div><p className="eyebrow">FIRECHRONOS / SPATIAL EXPLORER</p><h2>Europe, in focus.</h2><p>Discover when and where satellite hotspots were observed.</p></div>
          <span className={workspace.live}><span /> NASA FIRMS archive</span>
        </div>
        {filters}
        <div className={workspace.topOptions}>            <details ref={optionsRef} className={workspace.filterDrawer} onKeyDown={event => { if (event.key === "Escape" && optionsRef.current) optionsRef.current.open = false; }}><summary>Search & map options</summary>
            <div className={workspace.optionsPopover}>
              <div className={workspace.optionsHeading}><h3>Explore your area</h3><button type="button" aria-label="Close search and map options" onClick={()=>{if(optionsRef.current) optionsRef.current.open=false;}}>×</button></div>
              <div className={workspace.optionsGrid}><div className={workspace.searchSection}>
            <LocationSearch onSelect={point => {
              setLocation({...point, period: locationPeriod}); setSelectedCell(null); setDrawMode(null);
              if (optionsRef.current) optionsRef.current.open = false;
              setRegion({kind:"box", south: Math.max(-90,point.lat-.5), north:Math.min(90,point.lat+.5), west:Math.max(-180,point.lon-.5), east:Math.min(180,point.lon+.5)});
            }} />
            {location && <div className={workspace.locationNote}><strong>{location.label}</strong><p>{location.lat.toFixed(4)}°, {location.lon.toFixed(4)}°</p><p>{sources.length === 0 ? "This location is outside the available fire archive. No fire assessment is available here." : "Showing the surrounding area. No dot means no retained detection in the selected period; it does not confirm there was no fire."}</p><button type="button" onClick={()=>{setLocation(null);setRegion(null);setStudyAreaId(DEFAULT_STUDY_AREA.id);}}>Back to Europe</button></div>}
              </div><div className={workspace.displaySection}><h3>Map display</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-labelledby="map-view-label" className="flex items-center gap-2">
            <span id="map-view-label" className="text-sm font-medium">
              Colour dots by
            </span>
            <div className="inline-flex rounded-md border border-line p-0.5">
              {(
                [
                  ["amount", "Fire amount"],
                  ["frequency", "Years with detections"],
                ] as const
              ).map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mapView === id}
                  onClick={() => setMapView(id)}
                  className={
                    "rounded px-3 py-1 text-sm " +
                    (mapView === id ? "bg-accent font-medium text-background" : "text-muted hover:text-foreground")
                  }
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">
          {mapView === "frequency"
            ? `${frequency ? describeFrequency(frequency, yearCount) : ""} Darkest: at least one detection in all ${yearCount} years. Palest: in a single year.`
            : `Each dot represents the centre of a 0.25° grid cell, coloured by its filtered hotspot detections in the ${record} record.`}
        </p>
        {mapView === "frequency" && extentCaution(firstYear) && (
          <p className="mt-1 text-xs text-accent">{extentCaution(firstYear)}</p>
        )}
        <details className={workspace.advanced}><summary>Draw a custom area</summary>
          <RegionPanel
            drawMode={drawMode}
            onDrawMode={chooseDrawMode}
            hasRegion={region !== null}
            onRegion={setRegion}
            onClear={() => {
              setRegion(null);
              setDrawMode(null);
            }}
          />
        </details>
        <div className="map-period-controls mt-4" aria-label="Map period filters">
          <div><label htmlFor="map-year">Year</label><select id="map-year" value={month?.year ?? (firstYear === lastYear ? firstYear : firstYear === index.firstYear && lastYear === index.lastYear ? "all" : "range")} onChange={event => {
            const value = event.target.value;
            setPicked(null); setMapView("amount");
            if (value === "all") { setFirstYear(index.firstYear); setLastYear(index.lastYear); }
            else { setFirstYear(Number(value)); setLastYear(Number(value)); }
          }}><option value="all">All archive years</option>{firstYear !== lastYear && (firstYear !== index.firstYear || lastYear !== index.lastYear) && <option value="range" disabled>{firstYear}–{lastYear}</option>}{years.map(year => <option key={year} value={year}>{year}</option>)}</select></div>
          <div><label htmlFor="map-month">Month</label><select id="map-month" value={month?.month ?? "all"} onChange={event => {
            setMapView("amount");
            if (event.target.value === "all") setPicked(null);
            else setPicked({year: month?.year ?? lastYear, month: Number(event.target.value)});
          }}><option value="all">All months</option>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{monthName(i+1)}</option>)}</select></div>
          <p aria-live="polite">{month ? `${monthName(month.month)} ${month.year}` : `${firstYear}–${lastYear}`} · {squares?.[record].length.toLocaleString() ?? "…"} cells with detections{rows && squares?.[record].length === 0 ? " · No retained detections in this selection." : ""}</p>
        </div>
              </div></div>
              <p className={workspace.optionsFootnote}>Select a calendar tile to update the map. Dots represent aggregated satellite detections.</p>
            </div></details></div>
        <div className={workspace.body}>
          <aside className={workspace.sidebar} aria-label="Explore map controls">
            <div className={workspace.calendarIntro}><p className="eyebrow">SELECT A MONTH → SEE IT ON THE MAP</p><h3>Your fire calendar</h3><p>Each coloured tile opens that month’s satellite record.</p></div>
      <div className={workspace.calendarPanel} aria-live="polite" aria-busy={data.status === "loading"}>
        <div className="panel-heading"><div><p className="eyebrow">THE BURNING CALENDAR</p><h3>Fire detections per month</h3></div><span className="text-xs text-muted">{firstYear} — {lastYear}</span></div>
        <div className="calendar-key"><span>Less</span><span className="heat-ramp" /><span>More detections</span>{record === "corrected" && firstYear < VIIRS_FIRST_YEAR && <><span className="estimate-key" /><span>Estimated before 2012</span></>}<span className="ml-auto">Select a month to explore it</span></div>
        {data.status === "loading" && <p className="text-muted">Loading {sourceNames}…</p>}
        {data.status === "error" && (
          <p role="alert" className="rounded-md border border-accent px-3 py-2 text-accent">
            {data.message}
          </p>
        )}
        {tables && (
          <CalendarGrid
            table={tables[record]}
            areaName={areaName}
            max={max}
            selected={month}
            onSelect={(pick) =>
              setPicked(month && month.year === pick.year && month.month === pick.month ? null : pick)
            }
          />
        )}
      </div>


          </aside>
          <div className={workspace.mapColumn}>
            <div className={workspace.mapHeading}><span>{areaName}</span><span>{month ? `${monthName(month.month)} ${month.year}` : `${firstYear}–${lastYear}`}</span></div>
        <div className={workspace.mapFrame}>
          <FireMap
            animateEntry
            darkMode
            onCellSelect={(lat, lon) => {
              setSelectedCell({lat, lon}); weather.setPoint({lat, lon}); weather.setPicking(false);
            }}
            squares={(mapView === "frequency" ? frequency : squares?.[record]) ?? []}
            max={mapView === "frequency" ? yearCount : squareMax}
            scale={mapView === "frequency" ? "linear" : "sqrt"}
            bounds={bounds}
            label={`Map of fire detections in ${areaName}, ${mapPeriod}`}
            outline={outline}
            drawMode={drawMode}
            onDrawn={(ring) => {
              setRegion({ kind: "polygon", ring });
              setDrawMode(null);
            }}
            weatherPick={weather.picking}
            onWeatherPick={(lat, lon) => {
              weather.setPoint({ lat, lon });
              weather.setPicking(false);
            }}
            weatherMarker={location ? {lat: location.lat, lon: location.lon, towards: null, label: location.label} : weather.marker}
          />
            {selectedCell && cellInfo && <section className={`${workspace.cellInfo} ${workspace.cellDialog}`} role="dialog" aria-modal="false" aria-labelledby="cell-dialog-title" onKeyDown={event => { if (event.key === "Escape") setSelectedCell(null); }}>
                <div className={workspace.cellTitle}><h3 id="cell-dialog-title">Selected hotspot grid cell</h3><button type="button" autoFocus onClick={() => setSelectedCell(null)} aria-label="Close grid cell information">×</button></div>
                <p>{selectedCell.lat.toFixed(3)}° latitude · {selectedCell.lon.toFixed(3)}° longitude · {month ? `${monthName(month.month)} ${month.year}` : `${firstYear}–${lastYear}`}</p>
                <dl className={workspace.cellMetrics}>
                  <div><dt>{record === "corrected" ? "Corrected" : "Raw"} detections</dt><dd>{cellInfo.count.toLocaleString(undefined,{maximumFractionDigits:1})}{cellInfo.estimated ? " (estimated)" : ""}</dd></div>
                  <div><dt>NASA hotspot type</dt><dd>0 · Presumed vegetation fire</dd></div>
                  <div><dt>Observed MODIS</dt><dd>{cellInfo.modis.toLocaleString()} detections</dd></div>
                  <div><dt>Observed VIIRS S-NPP</dt><dd>{(month?.year ?? lastYear) < VIIRS_FIRST_YEAR ? "Not available before 2012" : `${cellInfo.viirs.toLocaleString()} detections`}</dd></div>
                  <div><dt>Summed pixel FRP · {record}</dt><dd>{cellInfo.frp.toLocaleString(undefined,{maximumFractionDigits:1})} MW</dd></div>
                  <div><dt>Day / night</dt><dd>Not retained in monthly archive</dd></div>
                </dl>
                <div className={workspace.causeNote}><h4>Why did this happen?</h4><p>The cause is unknown from these satellite records. NASA classifies this hotspot as a presumed vegetation fire. That classification does not tell us whether lightning, an accidental ignition, deliberate burning, or another cause started it. Confirming a cause requires local incident reports or other evidence.</p><p>Wind can influence the movement of an existing fire, and dry conditions can help vegetation burn. Weather context alone cannot confirm the cause of this detection.</p></div>
                <p>0.25° grid cell. Repeated detections are retained. FRP sums are experimental and do not measure total fire energy. Sensor counts are separate observations for the selected period.</p>
                <details className={workspace.dialogWeather} open>
                  <summary>Weather at this location</summary>
                  {!month && <p>Select a month in the calendar for its wind summary, or choose a day below for detailed weather.</p>}
                  <WeatherPanel weather={weather} month={month} onPickingChange={() => {}} allowPointPicking={false} />
                </details>
            </section>}
        </div>
            <p className={workspace.cellHint}>Click a fire dot to inspect its grid-cell details. Dots show aggregated grid centres, not exact fire locations.</p>
            <div className={workspace.legend}><span className="heat-ramp" /><span>Fewer detections</span><span>More detections</span><span className={workspace.resolution}>0.25° spatial grid</span></div>
          </div>
        </div>
      </div>
      }
      {view === "statistics" && <>
        {filters}
        {data.status === "loading" && <p role="status" className="mt-5">Loading statistics for {areaName}…</p>}
        {data.status === "error" && <p role="alert" className="mt-5">{data.message}</p>}
      <div className="europe-scope mt-5">
        <span className="europe-scope-mark" aria-hidden="true">EU</span>
        <div><p className="eyebrow">EUROPE ARCHIVE</p><p className="mt-1 text-sm text-muted">NASA FIRMS observations across 16 European countries · {index.firstYear}–{index.lastYear}</p></div>

      </div>


      <p className="mt-4 text-sm">
        <span className="font-medium">Area:</span> {areaName}
        {region && (
          <span className="text-muted">
            {" "}
            · data from {sourceNames || "no country"}
            {rows && ` · ${new Set(rows.map((r) => `${r[0]},${r[1]}`)).size} map squares with fire`}
          </span>
        )}
      </p>
      <p className="mt-1 max-w-3xl text-sm text-muted" aria-live="polite">
        {EXPLAIN[record]} Darker dots represent more hotspot detections.
      </p>
      <HowCalculatedPanel
        countRatio={harmonizationReport.regional_ratio_all_cells}
        frpRatio={harmonizationReport.intensity.frp_ratio}
        trainYears={harmonizationReport.train_years}
        testYears={harmonizationReport.test_years}
        inputFiles={harmonizationReport.input_provenance.csv_files}
        firstYear={firstYear}
        lastYear={lastYear}
        summary={selectedDataSummary}
      />
      {region && sources.length === 0 && (
        <p role="alert" className="mt-2 text-sm text-accent">
          This area lies outside the {index.countries.length} countries we have data for.
        </p>
      )}
      {studyArea && !studyAreaIsAvailable(studyArea, index) && (
        <p role="status" className="mt-3 rounded-md border border-accent px-3 py-2 text-sm text-accent">
          {studyArea.note} Its map and FireDNA stay unavailable until filtered NASA FIRMS archives are added; no missing region is shown as zero fire.
        </p>
      )}


      {tables && (
        <div className="mt-6">
          <FindingsPanel table={tables[record]} month={month} />
        </div>
      )}

      {tables && extent && (
        <div id="trends" className="mt-8 scroll-mt-6">
          <div className="section-heading mb-4"><div><p className="eyebrow">02 / UNDERSTAND THE PATTERNS</p><h2>Beyond the hotspots</h2></div></div>
          <TrendsPanel table={tables[record]} extent={extent} />
        </div>
      )}

      {rows && studyAreaIsAvailable(studyArea ?? STUDY_AREAS[0], index) && (
        <FireSciencePanel rows={rows} firstYear={firstYear} lastYear={lastYear} ratio={harmonizationReport.regional_ratio_all_cells} record={record} />
      )}
      </>}
    </section>
  );
}
