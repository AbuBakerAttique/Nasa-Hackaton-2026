import { FireCalendar } from "@/components/FireCalendar";
import { parseIndex } from "@/lib/data";
// The list of countries is small, so it is built into the page.
// The country files themselves are loaded in the browser when one is chosen.
import dataIndex from "../../public/data/index.json";

const index = parseIndex(dataIndex);

export default function Home() {
  return (
    <>
      <section className="intro-grid" aria-labelledby="intro-title">
        <div>
          <p className="eyebrow"><span className="status-dot" /> A clearer view of our changing planet</p>
          <h1 id="intro-title" className="hero-title">Every fire season.<br /><span>One connected story.</span></h1>
          <p className="hero-description">Explore {index.lastYear - index.firstYear + 1} years of satellite fire observations. Two generations of sensors, brought together to reveal when and where burning happens.</p>
          <div className="mt-5 flex flex-wrap gap-2"><span className="source-chip">MODIS</span><span className="source-chip">VIIRS S-NPP</span><span className="source-chip source-chip-muted">NASA FIRMS data</span></div>
        </div>
        <div className="coverage-card">
          <p className="eyebrow">THE OBSERVATION RECORD</p>
          <div className="coverage-numbers"><div><strong>{index.lastYear - index.firstYear + 1}<span>years</span></strong><p>{index.firstYear} — {index.lastYear}</p></div><div><strong>{index.countries.length}<span>countries</span></strong><p>Across Europe</p></div></div>
          <div className="sensor-timeline" aria-label="MODIS observations from 2001, VIIRS from 2012"><div><span>MODIS</span><i /></div><div><span>VIIRS</span><i /></div></div>
          <p className="mt-4 text-xs leading-relaxed text-muted">Historical estimates before 2012. VIIRS observations from 2012 onward.</p>
        </div>
      </section>
      <div className="mt-9 sm:mt-12">
        <FireCalendar index={index} />
      </div>
    </>
  );
}
