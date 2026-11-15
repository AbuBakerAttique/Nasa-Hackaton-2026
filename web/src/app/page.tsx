import { Suspense } from "react";
import { FireCalendar } from "@/components/FireCalendar";
import { parseExplorerSelection } from "@/lib/explorer-selection";
import explorerStyles from "@/components/ExplorerWorkspace.module.css";
import { LaunchExperience } from "@/components/LaunchExperience";
import { parseIndex } from "@/lib/data";
// The list of countries is small, so it is built into the page.
// The country files themselves are loaded in the browser when one is chosen.
import dataIndex from "../../public/data/index.json";

const index = parseIndex(dataIndex);

async function HomeContent({ searchParams }: {searchParams: Promise<{selection?:string;explore?:string}>}) {
  const params = await searchParams;
  const selection = parseExplorerSelection(params.selection);
  return (
    <LaunchExperience initialEntered={Boolean(selection || params.explore)}>
      <div className={`explorer-space ${explorerStyles.theme}`}>
        <FireCalendar index={index} initialSelection={selection} />
      </div>
    </LaunchExperience>
  );
}

export default function Home(props: {searchParams: Promise<{selection?:string;explore?:string}>}) {
 return <Suspense fallback={<p className="p-8 text-sm">Loading FireChronos…</p>}><HomeContent {...props}/></Suspense>;
}
