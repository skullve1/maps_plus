import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";

const source = new NodeURL("../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url);
const publicDirectory = new NodeURL("../public/", import.meta.url);
const destination = new NodeURL("maplibre-gl-worker.mjs", publicDirectory);
mkdirSync(fileURLToPath(publicDirectory), { recursive: true });
copyFileSync(fileURLToPath(source), fileURLToPath(destination));
