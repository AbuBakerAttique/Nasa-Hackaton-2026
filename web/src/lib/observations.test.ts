import {describe,expect,it} from 'vitest';
import raw from '../../public/case-studies/brandenburg-2022.json';
import {parseObservationCase,observationFrames,observationStatistics,weatherSelection,precedingDates,precedingHours,weatherHistorySummary,observationGeoJSON} from './observations';
import {parseWeather} from './weather';
import {sampleAnswer} from './weather.fixture';

const c=parseObservationCase(raw);
const o={...c.observations[0],timestamp:'2022-06-19T00:05:00Z'};
describe('real observation replay',()=>{
  it('keeps source detections separate and preserves actual pass times',()=>{
    expect(c.observations).toHaveLength(38);
    const frames=observationFrames(c.observations);
    expect(frames).toHaveLength(12);
    expect(frames.flatMap(f=>f.observations)).toHaveLength(38);
    expect(frames.every(f=>f.observations.every(o=>o.timestamp===f.timestamp))).toBe(true);
    expect(new Set(c.observations.map(o=>o.sensor)).size).toBe(2);
  });
  it('matches to the enclosing UTC hour without changing the acquisition minute',()=>{
    expect(weatherSelection(o)).toEqual({point:{lat:o.lat,lon:o.lon},date:'2022-06-19',hour:0});
    expect(o.timestamp).toBe('2022-06-19T00:05:00Z');
  });
  it('rejects duplicate IDs and malformed timestamps',()=>{
    expect(()=>parseObservationCase({...raw,observations:[o,o]})).toThrow();
    expect(()=>parseObservationCase({...raw,observations:[{...o,timestamp:'2022-02-30T00:05:00Z'}]})).toThrow();
  });
  it('requires valid NASA type and day/night attributes',()=>{
    expect(()=>parseObservationCase({...raw,observations:[{...o,type:9}]})).toThrow();
    expect(()=>parseObservationCase({...raw,observations:[{...o,daynight:'night'}]})).toThrow();
  });
  it('aggregates type, day/night, and detected-pixel FRP from the actual case rows',()=>{
    const stats=observationStatistics(c.observations);
    expect(stats.detections).toBe(38);
    expect(stats.day+stats.night).toBe(stats.detections);
    expect(stats.typeCounts.reduce((sum,[,n])=>sum+n,0)).toBe(stats.detections);
    expect(stats.typeCounts).toEqual([[0,38]]);
    expect(stats.frpTotal).toBeCloseTo(c.observations.reduce((sum,o)=>sum+o.frp,0));
    expect(stats.meanFrp).toBeCloseTo(stats.frpTotal/stats.detections);
  });
  it('uses lon/lat order and identifies selected observations for map clicks',()=>{
    const f=observationGeoJSON([o],o.id).features[0];
    expect(f.geometry.coordinates).toEqual([o.lon,o.lat]);
    expect(f.properties).toMatchObject({id:o.id,selected:true});
  });
});
describe('weather before an observation',()=>{
  const dates=precedingDates(o);
  const days=dates.map(date=>parseWeather(sampleAnswer(date),{lat:o.lat,lon:o.lon,date}));
  it('handles midnight across days and excludes future hours',()=>{
    expect(dates).toEqual(['2022-06-16','2022-06-17','2022-06-18','2022-06-19']);
    const hours=precedingHours(days,o);
    expect(hours).toHaveLength(72);
    expect(hours[0].hour).toBe(1);
    expect(hours[71].hour).toBe(0);
    // A huge later rainfall must never influence the preceding window.
    days[3].hours[1].precipitation=99999;
    const summary=weatherHistorySummary(precedingHours(days,o));
    expect(summary.rainfall).toBeLessThan(99999);
  });
  it('does not convert a missing precipitation estimate into zero rain',()=>{
    const hours=precedingHours(days,o).map(h=>({...h}));
    hours[0].precipitation=null;
    expect(weatherHistorySummary(hours).rainfall).toBeNull();
    expect(weatherHistorySummary(hours.slice(1)).maxWind).toBeNull();
  });
});
