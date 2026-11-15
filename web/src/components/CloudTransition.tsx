"use client";
import { useEffect, useRef } from 'react';
import styles from './CloudTransition.module.css';

function Rain({ phase }: {phase:'cover'|'reveal'}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;
    const context=canvas?.getContext('2d');
    if(!canvas||!context||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let width=window.innerWidth,height=window.innerHeight;
    const ratio=Math.min(window.devicePixelRatio||1,1.5);
    function resize(){width=window.innerWidth;height=window.innerHeight;canvas!.width=width*ratio;canvas!.height=height*ratio;}
    resize();window.addEventListener('resize',resize);
    const start=performance.now();let frame=0;
    function draw(now:number){
      const t=(now-start)/1000+(phase==='reveal'?2.6:0);
      context!.setTransform(ratio,0,0,ratio,0,0);context!.clearRect(0,0,width,height);
      for(let i=0;i<165;i++){
        const depth=.2+(i%13)/13;
        const speed=height*(.8+depth*.8);
        const y=((i*97.31+t*speed)%(height+150))-75;
        const x=((i*137.51-t*speed*.09)%(width+100)+width+100)%(width+100)-50;
        context!.strokeStyle=`rgba(223,238,250,${.08+depth*.22})`;
        context!.lineWidth=.3+depth*.7;
        context!.beginPath();context!.moveTo(x,y);context!.lineTo(x-2.5*depth,y+14*depth);context!.stroke();
      }
      frame=requestAnimationFrame(draw);
    }
    frame=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);};
  },[phase]);
  return <canvas ref={ref} className={styles.rain} aria-hidden="true"/>;
}

export function CloudTransition({ phase, onCovered, onFinished }: {phase:'cover'|'reveal';onCovered:()=>void;onFinished:()=>void}) {
  return <div className={`${styles.veil} ${styles[phase]}`} role="status" aria-label="Cloud and rain transition to the Europe fire explorer" onAnimationEnd={event=>{
    if(event.target!==event.currentTarget)return;
    if(phase==='cover')onCovered();else onFinished();
  }}>
    <div className={styles.cloudPhoto} aria-hidden="true"/>
    <div className={styles.shade} aria-hidden="true"/>
    <Rain phase={phase}/>
    <div className={styles.caption}><span>Entering Europe…</span></div>
  </div>;
}
