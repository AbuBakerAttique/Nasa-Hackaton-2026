"use client";

// Country menu, region, record switch, date range, the burning calendar and the map.

import { useMemo, useState } from "react";
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
import { buildTable, type RecordKind } from "@/lib/calendar";
import { monthName } from "@/lib/format";
import { allCellBounds, squareValues, viewBounds } from "@/lib/map";
import { burnFrequency, describeFrequency, extentByMonth, extentCaution } from "@/lib/trends";
import { countriesInRegion, regionBounds, regionLabel, rowsInRegion, type LonLat, type Region } from "@/lib/region";
import { countriesForStudyArea, studyAreaIsAvailable, studyAreaYears, STUDY_AREAS } from "@/lib/study-areas";
import { COL, VIIRS_FIRST_YEAR, type DataIndex } from "@/lib/types";

/** Shown first, as in the prototype on the project board. */
const DEFAULT_COUNTRY = "Germany";
const DEFAULT_STUDY_AREA = STUDY_AREAS.find((area) => area.id === "southern-europe")!;

const EXPLAIN: Record<RecordKind, string> = {
  corrected: `Corrected record: before ${VIIRS_FIRST_YEAR}, MODIS counts are scaled by one Europe-wide overlap ratio; from ${VIIRS_FIRST_YEAR}, values are observed VIIRS S-NPP counts. Earlier values are aggregate estimates and cannot add cells MODIS missed.`,
  raw: `Raw record: MODIS Terra/Aqua detections through ${VIIRS_FIRST_YEAR - 1}, then VIIRS S-NPP detections from ${VIIRS_FIRST_YEAR}. The count shift reflects different sensors and detection characteristics; it is not by itself evidence that fire occurrence changed.`,
};

const RECORDS: { id: RecordKind; label: string }[] = [
  { id: "corrected", label: "Corrected" },
  { id: "raw", label: "Raw" },
];

const fieldClass = "mt-1 rounded-md border border-line bg-background px-3 py-2";

export function FireCalendar({ index }: { index: DataIndex }) {
  const [countryId, setCountryId] = useState(
    index.countries.some((c) => c.id === DEFAULT_COUNTRY) ? DEFAULT_COUNTRY : (index.countries[0]?.id ?? ""),
  );
  const [record, setRecord] = useState<RecordKind>("corrected");
  const [firstYear, setFirstYear] = useState(Math.max(index.firstYear, studyAreaYears(DEFAULT_STUDY_AREA)[0]));
  const [lastYear, setLastYear] = useState(Math.min(index.lastYear, studyAreaYears(DEFAULT_STUDY_AREA)[1]));
  const [picked, setPicked] = useState<MonthPick | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  /** What the map colours: fire in the chosen period, or how many years each square burned. */
  const [mapView, setMapView] = useState<"amount" | "frequency">("amount");
  const [studyAreaId, setStudyAreaId] = useState<string | null>("southern-europe");
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

  // Use the most active fire grid cell in the selected month as the automatic
  // weather sampling point. Users can move it to another point on the map.
  const suggestedWeatherPoint = useMemo(() => {
    if (!rows || !month) return null;
    const cells = squareValues(rows, { record, measure: "count", firstYear, lastYear, month });
    const hottest = cells.reduce<(typeof cells)[number] | null>(
      (best, cell) => (!best || cell.value > best.value ? cell : best),
      null,
    );
    return hottest ? { lat: hottest.lat, lon: hottest.lon } : null;
  }, [rows, record, firstYear, lastYear, month]);

  // Historical weather context. Separate from the fire data: it never changes it.
  const weather = useHistoricalWeather(month, index.firstYear, index.lastYear, suggestedWeatherPoint);
  // Choosing a weather point and drawing a region both use map clicks, so
  // only one of them is on at a time.
  const chooseDrawMode = (mode: DrawMode | null) => {
    setDrawMode(mode);
    if (mode) weather.setPicking(false);
  };
  const choosePicking = (on: boolean) => {
    weather.setPicking(on);
    if (on) setDrawMode(null);
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
  const bounds = useMemo(
    () => (region ? regionBounds(region) : rows ? (studyArea ? allCellBounds(rows) : viewBounds(rows)) : null),
    [region, rows, studyArea],
  );
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

  return (
    <section id="explorer" className="explorer" aria-labelledby="calendar-heading">
      <div className="section-heading">
        <div><p className="eyebrow">01 / EXPLORE THE RECORD</p><h2 id="calendar-heading">Fire activity explorer</h2></div>
        <span className="dataset-badge"><span className="status-dot" /> Historical observations</span>
      </div>

      <section className="study-area-section mt-5" aria-label="Six global study areas">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><p className="eyebrow">GLOBAL CASE STUDIES</p><p className="mt-1 text-sm text-muted">Choose a region. Cards without a loaded archive are marked clearly.</p></div>
          {studyArea && <button type="button" className="text-sm text-accent underline" onClick={() => { setStudyAreaId(null); setFirstYear(index.firstYear); setLastYear(index.lastYear); }}>Return to country view</button>}
        </div>
        <div className="study-area-grid mt-3">
          {STUDY_AREAS.map((area) => {
            const available = studyAreaIsAvailable(area, index);
            const active = studyAreaId === area.id;
            return (
              <button key={area.id} type="button" aria-pressed={active} onClick={() => { const [start, end] = studyAreaYears(area); setStudyAreaId(area.id); setFirstYear(Math.max(index.firstYear, start)); setLastYear(Math.min(index.lastYear, end)); setRegion(null); setDrawMode(null); }} className="study-area-card">
                <span className="study-area-region">{area.region} · {area.targetYears}</span>
                <strong>{area.name}</strong>
                <span className={available ? "study-area-status available" : "study-area-status pending"}>{available ? "NASA records available" : "NASA records needed"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="filter-bar mt-5 flex flex-wrap items-end gap-4">
        {studyArea ? (
          <div>
            <span className="block text-sm font-medium">Global study area</span>
            <div className={`${fieldClass} min-w-48`} aria-label={`Selected global study area: ${studyArea.name}`}>{studyArea.name}</div>
          </div>
        ) : (
          <div>
            <label htmlFor="country" className="block text-sm font-medium">Country</label>
            <select
              id="country"
              value={countryId}
              onChange={(event) => {
                setCountryId(event.target.value);
                setFirstYear(index.firstYear);
                setLastYear(index.lastYear);
                setRegion(null);
                setDrawMode(null);
              }}
              className={`${fieldClass} min-w-48`}
            >
              {index.countries.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

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
        {EXPLAIN[record]} Darker squares had more hotspot detections.
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

      <div className="calendar-card mt-5" aria-live="polite" aria-busy={data.status === "loading"}>
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

      <div id="spatial-view" className="spatial-card mt-8 scroll-mt-6">
        <div className="section-heading mb-5"><div><p className="eyebrow">03 / PUT IT ON THE MAP</p><h2>A closer look at your region</h2></div><span className="source-chip source-chip-muted">0.25° grid</span></div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Where: {mapPeriod}</h3>
          {mapView === "frequency" ? null : month ? (
            <button type="button" onClick={() => setPicked(null)} className="text-sm text-accent underline">
              Show all months again
            </button>
          ) : (
            <p className="text-sm text-muted">Click a month in the calendar to see it on the map.</p>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-labelledby="map-view-label" className="flex items-center gap-2">
            <span id="map-view-label" className="text-sm font-medium">
              Colour squares by
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
            : `Each square is about 25 km wide and coloured by its filtered hotspot detections in the ${record} record.`}
        </p>
        {mapView === "frequency" && extentCaution(firstYear) && (
          <p className="mt-1 text-xs text-accent">{extentCaution(firstYear)}</p>
        )}
        <div className="mt-3">
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
        </div>
        <div className="mt-3">
          <FireMap
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
            weatherMarker={weather.marker}
          />
        </div>
        <WeatherPanel weather={weather} month={month} onPickingChange={choosePicking} />
      </div>
      {rows && studyAreaIsAvailable(studyArea ?? STUDY_AREAS[5], index) && (
        <FireSciencePanel rows={rows} firstYear={firstYear} lastYear={lastYear} ratio={harmonizationReport.regional_ratio_all_cells} record={record} />
      )}
    </section>
  );
}
