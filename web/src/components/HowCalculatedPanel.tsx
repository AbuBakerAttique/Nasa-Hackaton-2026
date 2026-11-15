"use client";

type Props = {
  countRatio: number;
  frpRatio: number;
  trainYears: string;
  testYears: string;
  inputFiles: number;
  firstYear: number;
  lastYear: number;
  summary: {
    modisPreViirs: number;
    viirsSince2012: number;
    correctedCount: number;
    modisFrpPreViirs: number;
    viirsFrpSince2012: number;
    correctedFrp: number;
  } | null;
};

const count = (value: number) => Math.round(value).toLocaleString();
const frp = (value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`;

export function HowCalculatedPanel({ countRatio, frpRatio, trainYears, testYears, inputFiles, firstYear, lastYear, summary }: Props) {
  return (
    <details className="insight-card mt-4">
      <summary className="cursor-pointer font-semibold">How was this calculated?</summary>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">
        <p>
          The calendar counts filtered NASA active-fire hotspot detections, grouped by the centre of a 0.25° grid
          cell and calendar month. A detection is a hot satellite pixel, not a unique wildfire or a burned-area estimate.
        </p>

        {summary && <div className="overflow-x-auto">
          <table className="comparison-table w-full text-sm">
            <caption className="mb-2 text-left font-semibold">Observed and corrected totals for the selected area · {firstYear}–{lastYear}</caption>
            <thead><tr><th scope="col">Statistic</th><th scope="col">Total</th></tr></thead>
            <tbody>
              <tr><th scope="row">Raw MODIS contribution (before 2012)</th><td>{count(summary.modisPreViirs)} detections</td></tr>
              <tr><th scope="row">Raw VIIRS S-NPP contribution (2012 onward)</th><td>{count(summary.viirsSince2012)} detections</td></tr>
              <tr><th scope="row">Corrected series</th><td>{count(summary.correctedCount)} detections</td></tr>
              <tr><th scope="row">MODIS FRP contribution (before 2012)</th><td>{frp(summary.modisFrpPreViirs)}</td></tr>
              <tr><th scope="row">VIIRS S-NPP FRP contribution (2012 onward)</th><td>{frp(summary.viirsFrpSince2012)}</td></tr>
              <tr><th scope="row">Corrected FRP series (experimental)</th><td>{frp(summary.correctedFrp)}</td></tr>
            </tbody>
          </table>
        </div>}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-line p-3">
            <h4 className="font-semibold">Raw record</h4>
            <p className="mt-1 text-muted">2001–2011: MODIS Terra/Aqua detections. 2012–2025: VIIRS on Suomi-NPP (S-NPP) detections. The displayed raw timeline switches to VIIRS at 2012; 2012 starts partway through January for S-NPP.</p>
          </div>
          <div className="rounded-md border border-line p-3">
            <h4 className="font-semibold">Corrected record</h4>
            <p className="mt-1 text-muted">Before 2012: MODIS cell-month count × <strong>{countRatio.toFixed(3)}</strong>. From 2012: observed S-NPP VIIRS count. This fixed factor was fit to pooled Europe-wide MODIS and VIIRS totals over {trainYears}.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="comparison-table w-full text-sm">
            <caption className="mb-2 text-left font-semibold">What is included in the archive</caption>
            <thead><tr><th scope="col">Field or input</th><th scope="col">Handling</th></tr></thead>
            <tbody>
              <tr><th scope="row">Sensor coverage</th><td>MODIS: archive begins 2001 (Terra; Aqua added July 2002). VIIRS: S-NPP begins 20 January 2012, so the first overlap year is partial. NOAA-20 and NOAA-21 are not included.</td></tr>
              <tr><th scope="row">Hotspot type</th><td>Only type 0, “presumed vegetation fire,” is retained in the monthly harmonized archive. Volcano, other static land source, and offshore classes are filtered out.</td></tr>
              <tr><th scope="row">Day/night flag</th><td>The monthly archive aggregates away the per-detection D/N flag. The timestamped replay retains and summarizes NASA’s original day/night values.</td></tr>
              <tr><th scope="row">Confidence filter</th><td>MODIS confidence ≥30; VIIRS nominal or high. These are product filters, not ground-truth confirmation.</td></tr>
              <tr><th scope="row">FRP</th><td>FRP is summed per sensor and cell-month in MW. Its separate pre-2012 scaling factor is {frpRatio.toFixed(3)}; this intensity series is experimental and is not burned area or cumulative energy.</td></tr>
              <tr><th scope="row">Source files</th><td>{inputFiles} country/year NASA FIRMS CSV files were used for this committed archive. The archive spans 2001–2025; a blank cell means no retained detection record, not proof that no fire occurred.</td></tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-line p-3">
          <h4 className="font-semibold">How to interpret the correction</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
            <li>The ratio is a Europe-wide aggregate calibration, not a matched-event model and not a separate calibration for every country or cell.</li>
            <li>It raises counts where MODIS detected hotspots; it cannot add locations or fires MODIS missed. Its cell-level pattern is therefore less certain than its regional total.</li>
            <li>Repeat detections on later satellite passes are retained. The totals describe detection activity, not distinct incidents.</li>
            <li>Validation uses held-out years {testYears} and aggregate region-month totals. It does not validate ignition causes, burned area, fire spread, or future fire prediction.</li>
            <li>FRP values come from sensors with different pixel sizes and retrievals; their summed totals should be treated as a rough comparison only.</li>
          </ul>
        </div>

        <p className="text-xs text-muted">
          Product references: <a className="underline" href="https://www.earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf" target="_blank" rel="noreferrer">NASA MODIS fire guide</a> · <a className="underline" href="https://www.earthdata.nasa.gov/s3fs-public/2024-07/VIIRS_C2_AF-375m_User_Guide_1.0.pdf" target="_blank" rel="noreferrer">NASA VIIRS fire guide</a> · {inputFiles} source CSVs.
        </p>
      </div>
    </details>
  );
}
