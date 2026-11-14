import { DataCheck } from "@/components/DataCheck";
import type { DataIndex } from "@/lib/types";
// The list of countries is small, so it is built into the page.
// The country files themselves are loaded in the browser when one is chosen.
import dataIndex from "../../public/data/index.json";

const index: DataIndex = dataIndex;

export default function Home() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Burning calendar</h1>
      <p className="mt-1 text-muted">
        {index.countries.length} countries, {index.firstYear} to {index.lastYear}. The
        calendar and map come next.
      </p>
      <div className="mt-4">
        <DataCheck countries={index.countries} />
      </div>
    </>
  );
}
