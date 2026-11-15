import { Suspense } from "react";
import { FireCalendar } from '@/components/FireCalendar';
import { ObservationReplay } from '@/components/ObservationReplay';
import explorerStyles from '@/components/ExplorerWorkspace.module.css';
import { parseIndex } from '@/lib/data';
import { parseExplorerSelection } from '@/lib/explorer-selection';
import dataIndex from '../../../public/data/index.json';
export const metadata = {title: 'Statistics · FireChronos'};
async function StatisticsContent({ searchParams }: { searchParams: Promise<{selection?:string}> }) {
  const params = await searchParams;
  return <div className={`explorer-space ${explorerStyles.theme}`}>
    <FireCalendar index={parseIndex(dataIndex)} view="statistics" initialSelection={parseExplorerSelection(params.selection)} />
    <ObservationReplay />
  </div>;
}

export default function Statistics(props: {searchParams: Promise<{selection?:string}>}) {
 return <Suspense fallback={<p className="p-8 text-sm">Loading statistics…</p>}><StatisticsContent {...props}/></Suspense>;
}
