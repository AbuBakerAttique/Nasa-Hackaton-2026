"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CloudTransition } from "./CloudTransition";
import { OrbitEarth } from "./OrbitEarth";
import { SolarSystem } from "./SolarSystem";
import earthStyles from "./EarthArrival.module.css";
import solarStyles from "./SolarLaunch.module.css";

export function LaunchExperience({ children, initialEntered = false }: { children: ReactNode; initialEntered?: boolean }) {
  const [earthSelected, setEarthSelected] = useState(false);
  const [entered, setEntered] = useState(initialEntered);
  const [flightOrigin, setFlightOrigin] = useState<{x:number;y:number;size:number} | null>(null);
  const [flying, setFlying] = useState(false);
  const [cloudPhase, setCloudPhase] = useState<"cover" | "reveal" | null>(null);

  useEffect(() => {
    const clouds = new Image();
    clouds.src = "/clouds-transition.jpg";
    void clouds.decode().catch(() => {});
  }, []);

  useEffect(() => {
    if (!entered) return;
    document.getElementById("spatial-view")?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [entered]);

  const cloudOverlay = cloudPhase && <CloudTransition phase={cloudPhase} onCovered={() => { setEntered(true); setCloudPhase("reveal"); }} onFinished={() => setCloudPhase(null)} />;
  if (entered) return <>{children}{cloudOverlay}</>;
  return <>
    {!earthSelected && (
    <section className={solarStyles.screen} aria-labelledby="solar-title">
      <div className={solarStyles.heading}><p>FIRECHRONOS / THE EARTH OBSERVATION RECORD</p><h1 id="solar-title">Our solar system.<br /><span>Our planet’s fire story.</span></h1><p>Select Earth to begin your journey into Europe’s fire history.</p></div>
      <div className={solarStyles.scene}><SolarSystem flying={flying} onEarth={origin => { setFlightOrigin(origin ?? null); setFlying(true); }} /></div>
      <div className={solarStyles.bottom}><span aria-live="polite">{flying ? "APPROACHING EARTH · PREPARING THE GLOBE" : "SUN + EIGHT PLANETS · ILLUSTRATIVE SIZES AND DISTANCES"}</span><button type="button" disabled={flying} onClick={() => setFlying(true)}>{flying ? "Approaching Earth…" : "Select Earth"}</button></div>
    </section>)}
    {(flying || earthSelected) && <section key="earth-arrival" className={`${earthStyles.screen} ${flying ? earthStyles.transitioning : ""}`} aria-labelledby="earth-arrival-title">
      <div className={earthStyles.heading}><p>FIRECHRONOS / DESTINATION EARTH</p><h1 id="earth-arrival-title">Welcome to Earth.</h1><p>25 years of satellite fire observations. One European archive.</p></div>
      <div className={earthStyles.stage}><OrbitEarth onReady={element => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const box = element.getBoundingClientRect();
        const x = flightOrigin?.x ?? window.innerWidth / 2;
        const y = flightOrigin?.y ?? window.innerHeight / 2;
        const scale = (flightOrigin?.size ?? 30) / box.width;
        const animation = element.animate([
          {transform: `translate(${x-box.x-box.width/2}px, ${y-box.y-box.height/2}px) scale(${scale})`, opacity: 1},
          {transform: "translate(0, 0) scale(1)", opacity: 1},
        ], {duration: reduced ? 100 : 2200, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "both"});
        animation.finished.then(() => { setEarthSelected(true); setFlying(false); animation.cancel(); }).catch(() => {});
      }} /></div>
      <div className={earthStyles.bottom}><button type="button" className={earthStyles.explore} disabled={cloudPhase !== null} onClick={() => setCloudPhase("cover")}>Explore Europe’s fire record →</button><span className={earthStyles.credit}>Surface texture: three.js Earth imagery · illustrative lighting</span></div>
    </section>}
    {cloudOverlay}
  </>;
}
