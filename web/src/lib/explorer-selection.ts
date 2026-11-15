import type { Region } from './region';
import type { RecordKind } from './calendar';
export interface ExplorerSelection { countryId: string; studyAreaId: string | null; firstYear: number; lastYear: number; record: RecordKind; picked: {year:number;month:number} | null; region: Region | null }
/** Treat URL state as untrusted input; fall back to the default Europe view. */
export function parseExplorerSelection(raw: string | undefined): ExplorerSelection | undefined {
  if (!raw || raw.length > 20000) return;
  try {
    const s = JSON.parse(raw) as ExplorerSelection;
    if (!s || typeof s.countryId !== 'string' || ![null,'southern-europe'].includes(s.studyAreaId) || !['raw','corrected'].includes(s.record) || !Number.isInteger(s.firstYear) || !Number.isInteger(s.lastYear) || s.firstYear<2001 || s.lastYear>2025 || s.firstYear>s.lastYear) return;
    if(s.picked && (!Number.isInteger(s.picked.year)||s.picked.year<s.firstYear||s.picked.year>s.lastYear||!Number.isInteger(s.picked.month)||s.picked.month<1||s.picked.month>12)) return;
    if(s.region) {
      if(s.region.kind==='box') { const r=s.region; if(![r.south,r.north,r.west,r.east].every(Number.isFinite)||r.south < -90||r.north>90||r.west < -180||r.east>180||r.south>=r.north||r.west>=r.east) return; }
      else if(s.region.kind==='polygon') { if(!Array.isArray(s.region.ring)||s.region.ring.length<4||s.region.ring.length>1000||!s.region.ring.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90)) return; }
      else return;
    }
    return s;
  } catch { return; }
}
