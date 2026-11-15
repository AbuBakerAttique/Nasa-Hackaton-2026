import { FireCalendar } from "@/components/FireCalendar";
import { ObservationReplay } from "@/components/ObservationReplay";
import { LaunchExperience } from "@/components/LaunchExperience";
import { parseIndex } from "@/lib/data";
// The list of countries is small, so it is built into the page.
// The country files themselves are loaded in the browser when one is chosen.
import dataIndex from "../../public/data/index.json";

const index = parseIndex(dataIndex);

export default function Home() {
  return (
    <LaunchExperience>
      <div className="mt-9 sm:mt-12">
        <FireCalendar index={index} />
        <ObservationReplay />
      </div>
    </LaunchExperience>
  );
}
