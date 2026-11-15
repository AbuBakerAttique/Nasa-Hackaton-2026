"use client";

import { useEffect, useState, type ReactNode } from "react";
import { OrbitEarth } from "./OrbitEarth";
import { SolarSystem } from "./SolarSystem";
import earthStyles from "./EarthArrival.module.css";

export function LaunchExperience({ children }: { children: ReactNode }) {
  const [earthSelected, setEarthSelected] = useState(false);
  const [entered, setEntered] = useState(false);
  const [flying, setFlying] = useState(false);

  useEffect(() => {
    if (!flying) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setEarthSelected(true), reducedMotion ? 150 : 1700);
    return () => window.clearTimeout(timer);
  }, [flying]);

  useEffect(() => {
    if (!entered) return;
    document.getElementById("spatial-view")?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [entered]);

  if (entered) return <>{children}</>;
  if (!earthSelected) return (
    <section className="solar-launch" aria-labelledby="solar-title">
      <div className="solar-heading"><p>FIRECHRONOS / THE EARTH OBSERVATION RECORD</p><h1 id="solar-title">Our solar system.<br /><span>Our planet’s fire story.</span></h1><p>Select Earth to begin your journey into Europe’s fire history.</p></div>
      <SolarSystem flying={flying} onEarth={() => setFlying(true)} />
      <div className="solar-bottom"><span aria-live="polite">{flying ? "APPROACHING EARTH · PREPARING THE GLOBE" : "SUN + EIGHT PLANETS · ILLUSTRATIVE SIZES AND DISTANCES"}</span><button type="button" disabled={flying} onClick={() => setFlying(true)}>{flying ? "Approaching Earth…" : "Select Earth"}</button></div>
    </section>
  );
  return (
    <section className={earthStyles.screen} aria-labelledby="earth-arrival-title">
      <div className={earthStyles.heading}><p>FIRECHRONOS / DESTINATION EARTH</p><h1 id="earth-arrival-title">Welcome to Earth.</h1><p>25 years of satellite fire observations. One European archive.</p></div>
      <div className={earthStyles.stage}><OrbitEarth /></div>
      <div className={earthStyles.bottom}><button type="button" className={earthStyles.explore} onClick={() => setEntered(true)}>Explore Europe’s fire record →</button><span className={earthStyles.credit}>Surface texture: three.js Earth imagery · illustrative lighting</span></div>
    </section>
  );
}
