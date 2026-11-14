"use client";

// TEMPORARY, roadmap step 3. Proves that the data files load.
// Step 5 replaces this with the real country menu and calendar.

import { useState } from "react";
import { useCountryData } from "@/hooks/useCountryData";
import type { CountryEntry } from "@/lib/types";

/** A file that does not exist, to show what a loading error looks like. */
const MISSING_FILE = "Atlantis.json";

export function DataCheck({ countries }: { countries: CountryEntry[] }) {
  const [file, setFile] = useState("");
  const data = useCountryData(file || null);
  const country = countries.find((c) => c.file === file);

  return (
    <div className="rounded-lg border border-line p-4 sm:p-6">
      <label htmlFor="country" className="block text-sm font-medium">
        Country
      </label>
      <select
        id="country"
        value={file}
        onChange={(event) => setFile(event.target.value)}
        className="mt-1 w-full max-w-xs rounded-md border border-line bg-background px-3 py-2"
      >
        <option value="">Choose a country</option>
        {countries.map((c) => (
          <option key={c.id} value={c.file}>
            {c.name}
          </option>
        ))}
        <option value={MISSING_FILE}>Test: a file that does not exist</option>
      </select>

      <div className="mt-4 min-h-12" aria-live="polite">
        {data.status === "idle" && (
          <p className="text-muted">Choose a country to load its data.</p>
        )}
        {data.status === "loading" && <p className="text-muted">Loading…</p>}
        {data.status === "ready" && (
          <p>
            <strong>{country?.name ?? file}</strong>:{" "}
            {data.rows.length.toLocaleString("en")} rows loaded. Each row is one map
            square in one month.
          </p>
        )}
        {data.status === "error" && (
          <p role="alert" className="rounded-md border border-accent px-3 py-2 text-accent">
            {data.message}
          </p>
        )}
      </div>
    </div>
  );
}
