"use client";

import { useEffect, useRef, useState } from "react";
import countryLabels from "@/lib/country-labels.json";

// Natural Earth 1:110m country label points (public domain).
// https://github.com/nvkelso/natural-earth-vector
const labels = [...countryLabels].sort((a, b) => a.rank - b.rank);

/** Texture mapped sphere, with a fixed light source and drag rotation. */
export function OrbitEarth({ onReady }: { onReady?: (element: HTMLCanvasElement) => void } = {}) {
  const readyCallback = useRef(onReady);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rotation = useRef(15 * Math.PI / 180);
  const dragging = useRef<number | null>(null);
  const showLabels = useRef(true);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    let frame = 0;
    const texture = new Image();
    texture.src = "/earth-day.jpg";
    texture.onerror = () => { if (!cancelled) setFailed(true); };
    texture.onload = () => {
      if (cancelled) return;
      const source = document.createElement("canvas");
      source.width = texture.width; source.height = texture.height;
      const sourceContext = source.getContext("2d");
      if (!sourceContext) return;
      sourceContext.drawImage(texture, 0, 0);
      const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
      const size = 600;
      const output = ctx.createImageData(size, size);
      const tilt = 45 * Math.PI / 180;
      const points: { index: number; u: number; v: number; light: number }[] = [];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const nx = (x - size / 2) / (size / 2 - 2), ny = (y - size / 2) / (size / 2 - 2);
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        points.push({ index: (y * size + x) * 4, u: Math.atan2(nx, ny * Math.sin(tilt) + nz * Math.cos(tilt)) / (2 * Math.PI), v: .5 - Math.asin(Math.max(-1, Math.min(1, -ny * Math.cos(tilt) + nz * Math.sin(tilt)))) / Math.PI,
          light: .25 + .75 * Math.max(0, nx * -.38 + ny * -.3 + nz * .87) });
      }
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let previous = 0;
      const rotationStarts = performance.now() + 7000;
      function draw(time: number) {
        if (cancelled) return;
        if (time - previous > 45) {
          if (!reducedMotion && time > rotationStarts && dragging.current === null) rotation.current += Math.min(time - previous, 60) * .000035;
          previous = time;
          for (const p of points) {
            const u = ((p.u + rotation.current / (2 * Math.PI) + .5) % 1 + 1) % 1;
            const sourceIndex = (Math.min(source.height - 1, Math.floor(p.v * source.height)) * source.width + Math.floor(u * source.width)) * 4;
            output.data[p.index] = pixels[sourceIndex] * p.light;
            output.data[p.index + 1] = pixels[sourceIndex + 1] * p.light;
            output.data[p.index + 2] = pixels[sourceIndex + 2] * p.light;
            output.data[p.index + 3] = 255;
          }
          ctx!.putImageData(output, 0, 0);
          if (showLabels.current) {
            const occupied: { x: number; y: number; w: number }[] = [];
            ctx!.font = "500 11px Arial, sans-serif";
            ctx!.textAlign = "center";
            ctx!.textBaseline = "middle";
            for (const label of labels) {
              const latitude = label.lat * Math.PI / 180;
              const longitude = label.lon * Math.PI / 180 - rotation.current;
              const z = Math.sin(latitude) * Math.sin(tilt) + Math.cos(latitude) * Math.cos(longitude) * Math.cos(tilt);
              // Hide names on the back and near the rim of the globe.
              if (z < .25) continue;
              const x = size / 2 + (size / 2 - 2) * Math.cos(latitude) * Math.sin(longitude);
              const y = size / 2 - (size / 2 - 2) * (Math.sin(latitude) * Math.cos(tilt) - Math.cos(latitude) * Math.cos(longitude) * Math.sin(tilt));
              const w = ctx!.measureText(label.name).width + 10;
              if (occupied.some(box => Math.abs(box.y - y) < 17 && Math.abs(box.x - x) < (box.w + w) / 2)) continue;
              occupied.push({ x, y, w });
              ctx!.lineWidth = 3;
              ctx!.strokeStyle = "rgba(1, 8, 18, .9)";
              ctx!.strokeText(label.name, x, y);
              ctx!.fillStyle = "#f0f7fc";
              ctx!.fillText(label.name, x, y);
            }
          }
        }
        frame = requestAnimationFrame(draw);
      }
      draw(46);
      if (canvas.current) readyCallback.current?.(canvas.current);
    };
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, []);

  return <div className="real-earth-wrap">
    <canvas ref={canvas} width="600" height="600" className="real-earth" role="img" aria-label={`Rotating Earth with ${labelsVisible ? 'country names, ' : ''}ocean, land and clouds. Drag to rotate.`}
      onPointerDown={event => { dragging.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (dragging.current !== null) { rotation.current += (event.clientX - dragging.current) * .008; dragging.current = event.clientX; } }}
      onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }} />
    {failed && <p role="alert">Earth imagery could not load. You can continue to the Europe explorer.</p>}
    <div className="earth-rotation-controls"><button type="button" onClick={() => { rotation.current -= .3; }} aria-label="Rotate Earth left">←</button><span>DRAG TO ROTATE EARTH</span><button type="button" onClick={() => { rotation.current += .3; }} aria-label="Rotate Earth right">→</button></div>
    <button type="button" aria-pressed={labelsVisible} onClick={() => { showLabels.current = !labelsVisible; setLabelsVisible(!labelsVisible); }} style={{ color: '#b9d5e8', fontSize: 11, marginTop: 0, borderBottom: '1px solid #52738b', paddingBottom: 2 }}>{labelsVisible ? 'Hide country names' : 'Show country names'}</button>
  </div>;
}
