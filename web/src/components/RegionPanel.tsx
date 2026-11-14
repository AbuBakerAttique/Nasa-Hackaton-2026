"use client";

// Tools to choose a region: draw a rectangle or polygon on the map, or type
// a latitude / longitude box. Reports the result; does not calculate anything.

import { useState, type FormEvent } from "react";
import type { DrawMode } from "@/components/FireMap";
import { parseBox, type BoxInput, type Region } from "@/lib/region";

const HINT: Record<DrawMode, string> = {
  rectangle: "Click one corner on the map, then the opposite corner. Esc cancels.",
  polygon: "Click each corner on the map, then click the first corner again to finish. Esc cancels.",
};

const inputClass = "mt-1 w-24 rounded-md border border-line bg-background px-2 py-1.5 text-sm";
const buttonClass = "rounded-md border border-line px-3 py-1.5 text-sm hover:border-foreground";

export function RegionPanel({
  drawMode,
  onDrawMode,
  hasRegion,
  onRegion,
  onClear,
}: {
  drawMode: DrawMode | null;
  onDrawMode: (mode: DrawMode | null) => void;
  hasRegion: boolean;
  onRegion: (region: Region) => void;
  onClear: () => void;
}) {
  const [box, setBox] = useState<BoxInput>({ south: "", north: "", west: "", east: "" });
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = parseBox(box);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onDrawMode(null);
    onRegion(result.region);
  }

  const field = (key: keyof BoxInput, label: string, placeholder: string) => (
    <div>
      <label htmlFor={`box-${key}`} className="block text-xs font-medium">
        {label}
      </label>
      <input
        id={`box-${key}`}
        inputMode="decimal"
        placeholder={placeholder}
        value={box[key]}
        onChange={(e) => setBox({ ...box, [key]: e.target.value })}
        className={inputClass}
      />
    </div>
  );

  return (
    <div className="region-tools rounded-md border border-line p-3">
      <p className="text-sm font-medium">Choose your own area</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(["rectangle", "polygon"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={drawMode === mode}
            onClick={() => onDrawMode(drawMode === mode ? null : mode)}
            className={drawMode === mode ? `${buttonClass} border-accent bg-accent text-background` : buttonClass}
          >
            Draw a {mode}
          </button>
        ))}
        {hasRegion && (
          <button type="button" onClick={onClear} className="text-sm text-accent underline">
            Back to the whole country
          </button>
        )}
      </div>
      <p className="mt-2 min-h-5 text-sm text-muted" aria-live="polite">
        {drawMode ? HINT[drawMode] : "Squares whose centre lies inside the area are counted, across borders."}
      </p>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3" aria-label="Type a box">
        {field("south", "South (lat)", "51.35")}
        {field("north", "North (lat)", "53.56")}
        {field("west", "West (lon)", "11.26")}
        {field("east", "East (lon)", "14.77")}
        <button type="submit" className={buttonClass}>
          Show box
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
