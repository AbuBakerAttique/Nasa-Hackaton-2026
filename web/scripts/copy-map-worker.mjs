// Copies MapLibre's worker script into public/vendor/, so the browser can
// load it from /vendor/maplibre-gl-worker.mjs. MapLibre 6 looks for the worker
// next to its own script, which does not work once Next.js has bundled it.
// Runs before `npm run dev` and `npm run build` (predev, prebuild), so the
// copy always matches the installed version. public/vendor/ is not in git.

import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("maplibre-gl/package.json"));
const { version } = require("maplibre-gl/package.json");
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "vendor");

mkdirSync(target, { recursive: true });
copyFileSync(join(pkgDir, "dist", "maplibre-gl-worker.mjs"), join(target, "maplibre-gl-worker.mjs"));
console.log(`copy-map-worker: MapLibre ${version} worker copied to public/vendor/`);
