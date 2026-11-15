"use client";

const planets = [
  { name: "Mercury", orbit: 66, angle: 225, r: 5, color: "#b9aaa0", shade: "#51473f" },
  { name: "Venus", orbit: 106, angle: 330, r: 11, color: "#f5dcab", shade: "#9b734c" },
  { name: "Earth", orbit: 158, angle: 226, r: 15, color: "#acdff2", shade: "#225b8d" },
  { name: "Mars", orbit: 222, angle: 20, r: 9, color: "#d79e7b", shade: "#7f4834" },
  { name: "Jupiter", orbit: 320, angle: 240, r: 43, color: "#eee0c1", shade: "#9b8567" },
  { name: "Saturn", orbit: 415, angle: 313, r: 34, color: "#ece0bd", shade: "#a19372" },
  { name: "Uranus", orbit: 510, angle: 125, r: 28, color: "#77d9db", shade: "#17616b" },
  { name: "Neptune", orbit: 620, angle: 42, r: 29, color: "#9dbfeb", shade: "#294974" },
];
const center = { x: 750, y: 460 };
const tilt = 12 * Math.PI / 180;
function position(radius: number, angle: number) {
  const a = angle * Math.PI / 180;
  const x = radius * Math.cos(a), y = radius * .36 * Math.sin(a);
  return { x: center.x + x * Math.cos(tilt) - y * Math.sin(tilt), y: center.y + x * Math.sin(tilt) + y * Math.cos(tilt) };
}

export function SolarSystem({ onEarth, flying = false }: { onEarth: () => void; flying?: boolean }) {
  const earth = position(158, 226);
  return <svg style={flying ? { transformOrigin: `${earth.x / 15}% ${earth.y / 9}%`, animation: "approach-earth 1.7s ease-in forwards" } : undefined} className="solar-canvas" viewBox="0 0 1500 900" role="img" aria-label="Perspective illustration of the Sun and all eight planets with elliptical orbit paths. Select Earth to explore Europe.">
    <defs>
      <radialGradient id="sun"><stop stopColor="#ffffff"/><stop offset=".36" stopColor="#fff7c6"/><stop offset=".8" stopColor="#ffd15b"/><stop offset="1" stopColor="#ff9f24"/></radialGradient>
      <radialGradient id="corona"><stop stopColor="#fff4a0" stopOpacity=".9"/><stop offset=".2" stopColor="#ffb83d" stopOpacity=".7"/><stop offset=".55" stopColor="#d86812" stopOpacity=".2"/><stop offset="1" stopColor="#d86812" stopOpacity="0"/></radialGradient>
      <filter id="nebula"><feTurbulence baseFrequency=".004 .009" numOctaves="3" seed="18"/><feColorMatrix values="0 0 0 0 .1 0 0 0 0 .23 0 0 0 0 .3 0 0 0 .35 0"/><feGaussianBlur stdDeviation="12"/></filter>
      <filter id="planet-texture"><feTurbulence baseFrequency=".12" numOctaves="3" seed="7"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="soft-light"/></filter>
      {planets.map(p=><radialGradient key={p.name} id={`planet-${p.name}`} cx="32%" cy="22%" r="80%"><stop stopColor={p.color}/><stop offset=".45" stopColor={p.shade}/><stop offset=".85" stopColor="#111722"/><stop offset="1" stopColor="#040911"/></radialGradient>)}
      {planets.map(p=><clipPath key={p.name} id={`clip-${p.name}`}><circle r={p.r}/></clipPath>)}
    </defs>
    <rect width="1500" height="900" fill="#040a12"/>
    <rect width="1500" height="900" filter="url(#nebula)" opacity=".65"/>
    {Array.from({length:700},(_,i)=><circle key={i} cx={(i*137.51)%1500} cy={(i*97.31)%900} r={i%23===0?1.15:.3+(i%4)*.13} fill={i%3?'#dbeaff':'#ffe1bc'} opacity={.2+(i%6)*.11}/>)}
    {planets.map(p=><ellipse key={p.name} cx={center.x} cy={center.y} rx={p.orbit} ry={p.orbit*.36} transform={`rotate(12 ${center.x} ${center.y})`} fill="none" stroke="#d4c69b" strokeWidth=".7" opacity=".5"/>)}
    <circle cx={center.x} cy={center.y} r="155" fill="url(#corona)" className="solar-corona"/>
    <circle cx={center.x} cy={center.y} r="23" fill="url(#sun)"/>
    <text x={center.x} y={center.y+49} textAnchor="middle" className="solar-label">SUN</text>
    {planets.map(p=>{const pos=position(p.orbit,p.angle);return <g key={p.name} transform={`translate(${pos.x} ${pos.y})`}>
      {p.name==='Saturn'&&<><ellipse rx="65" ry="18" transform="rotate(-15)" fill="none" stroke="#b9ae87" strokeWidth="9" opacity=".65"/><ellipse rx="73" ry="21" transform="rotate(-15)" fill="none" stroke="#807d69" strokeWidth="3" opacity=".5"/></>}
      {p.name==='Uranus'&&<ellipse rx="12" ry="43" transform="rotate(18)" fill="none" stroke="#a0b5bb" strokeWidth="1.3" opacity=".4"/>}
      <g clipPath={`url(#clip-${p.name})`}>
        <circle r={p.r} fill={`url(#planet-${p.name})`}/>
        <circle r={p.r} fill={`url(#planet-${p.name})`} filter="url(#planet-texture)" opacity=".22"/>
        {p.name==='Earth'&&<><path d="M-10-11l8 2 2 5 5 2-3 5-5-1-4 5-6-9zM3 3l7 1 3 5-6 8-4-6z" fill="#a6b995"/><path d="M-14-5q15-11 28 5M-10 7q12-4 20 2" fill="none" stroke="#f4f5ec" opacity=".7" strokeWidth="2"/></>}
        {p.name==='Jupiter'&&<g stroke="#bb9e7b" opacity=".65"><path d="M-50-22q50 17 100 0M-50-7q50 19 100 0M-50 13q50 12 100 0M-50 28q50 9 100 0" fill="none" strokeWidth="7"/><ellipse cx="15" cy="16" rx="9" ry="4" fill="#ae7f5d"/></g>}
        {p.name==='Saturn'&&<path d="M-40-10q40 9 80 0M-40 5q40 10 80 0M-40 20q40 8 80 0" fill="none" stroke="#c1b18a" strokeWidth="4" opacity=".3"/>}
      </g>
      <text y={p.r+24} textAnchor="middle" className={p.name==='Earth'?'solar-label solar-earth-label':'solar-label'}>{p.name.toUpperCase()}</text>
      {p.name==='Earth'&&<foreignObject x="-36" y="-36" width="72" height="72"><button type="button" className="solar-earth-button" disabled={flying} onClick={onEarth} aria-label="Select Earth"/></foreignObject>}
    </g>;})}
  </svg>;
}
