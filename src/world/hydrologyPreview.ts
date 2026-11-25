import { CONFIG } from "../config";
import { biomeAt, type Biome } from "./biomes";
import { Terrain } from "./terrain";

/** Tints of the land per biome, for the preview only. */
const BIOME_TINT: Record<Biome, [number, number, number]> = {
  pineForest: [70, 95, 70],
  broadleaf: [120, 100, 60],
  marsh: [80, 95, 85],
  field: [140, 130, 80],
  ridge: [115, 115, 115],
};

/** The view: 4 × 4 km around the start, 8 m per pixel (the rivers are 6–14 m wide). */
const SIZE_METERS = 4096;
const CELL = 8;

/**
 * NBB-164 (AG1-A, AG12-A): a development page (`/?hidrologia`) that draws, seen from above, the
 * water around the start: the land shaded by height and tinted by biome, deep water in dark
 * blue, shallow water (fords, the marsh's lakes) in light blue, the start in white.
 */
export function showHydrologyPreview(): void {
  const terrain = new Terrain(CONFIG.world.defaultSeed);
  const size = SIZE_METERS / CELL;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.style.cssText =
    "width:min(96vh,96vw);image-rendering:pixelated;display:block;margin:2vh auto";
  document.body.innerHTML = "";
  document.body.style.background = "#222";
  document.body.appendChild(canvas);
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const image = context.createImageData(size, size);
  const started = performance.now();
  let wet = 0;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = -SIZE_METERS / 2 + (px + 0.5) * CELL;
      // North up: larger z is higher on the page.
      const z = SIZE_METERS / 2 - (py + 0.5) * CELL;
      const water = terrain.waterAt(x, z);
      let color: [number, number, number];
      if (water.depth > 1.2) {
        color = [40, 70, 115];
        wet++;
      } else if (water.depth > 0) {
        color = [80, 125, 165];
        wet++;
      } else {
        const tint = BIOME_TINT[biomeAt(x, z, terrain.seed)];
        const shade = 0.6 + Math.max(-0.4, Math.min(0.6, terrain.heightAt(x, z) / 40));
        color = [tint[0] * shade, tint[1] * shade, tint[2] * shade];
      }
      const p = (py * size + px) * 4;
      image.data[p] = color[0];
      image.data[p + 1] = color[1];
      image.data[p + 2] = color[2];
      image.data[p + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  context.fillStyle = "white";
  context.fillRect(size / 2 - 1, size / 2 - 1, 3, 3);

  // NBB-165 (CC7-A): the waterfalls, as red marks (bigger for the taller ones).
  const fallsStarted = performance.now();
  const { region } = CONFIG.water.falls;
  const regions = SIZE_METERS / region;
  const drops: number[] = [];
  context.fillStyle = "#ff3b2f";
  for (let iz = -regions / 2; iz < regions / 2; iz++) {
    for (let ix = -regions / 2; ix < regions / 2; ix++) {
      for (const fall of terrain.water.fallsInRegion(ix, iz)) {
        const drop = fall.top - fall.bottom;
        drops.push(Math.round(drop * 10) / 10);
        const px = (fall.x + SIZE_METERS / 2) / CELL;
        const py = (SIZE_METERS / 2 - fall.z) / CELL;
        const half = drop > 6 ? 4 : 3;
        context.fillRect(px - half, py - half, half * 2, half * 2);
      }
    }
  }
  const squareKm = (SIZE_METERS / 1000) ** 2;
  Object.assign(window, {
    silentHunt: {
      hydrology: {
        ready: true,
        seconds: (performance.now() - started) / 1000,
        waterShare: Math.round((wet / (size * size)) * 1000) / 1000,
        falls: drops.length,
        fallsPerKm2: Math.round((drops.length / squareKm) * 100) / 100,
        drops: drops.sort((a, b) => a - b),
        fallsSeconds: (performance.now() - fallsStarted) / 1000,
      },
    },
  });
}
