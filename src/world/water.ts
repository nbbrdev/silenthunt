import { CONFIG } from "../config";
import { cabinsNear } from "./cabinSites";
import { fractalNoise } from "./noise";

/** Where the water is at a point, before the land is carved for it. */
export interface WaterShape {
  /** The water's surface height here (meters). */
  level: number;
  /**
   * How far the point is from the water's edge (meters): negative inside the water (how deep in
   * from the shore), positive on the land.
   */
  edge: number;
  /** How deep the water gets here, away from the shore (meters). */
  depth: number;
  /** How far from the shore the bed takes to reach that depth (meters). */
  ramp: number;
}

/**
 * NBB-164 (BI5, AG2-A, AG9-A, AG10-A, AG12-A): the water drawn from the seed. Rivers are winding
 * valleys where a slow noise crosses its middle value (so they never end or break), with
 * shallow fords now and then; lakes are basins where another noise rises above a line (more and
 * shallower in the marsh). Their surface follows the land's broad shape, a little below it.
 * None near the start or the cabins. Pure: the same seed always gives the same water.
 */
export class WaterField {
  private readonly seed: number;
  /** The land's broad shape (without small bumps), for the water's surface. */
  private readonly broadHeight: (x: number, z: number) => number;
  private readonly marshWeight: (x: number, z: number) => number;

  constructor(
    seed: number,
    broadHeight: (x: number, z: number) => number,
    marshWeight: (x: number, z: number) => number,
  ) {
    this.seed = seed;
    this.broadHeight = broadHeight;
    this.marshWeight = marshWeight;
  }

  /** The water at (x, z), or undefined where there is none near. */
  shapeAt(x: number, z: number): WaterShape | undefined {
    const settings = CONFIG.water;
    const clear = this.clearance(x, z);
    if (clear <= 0) {
      return undefined;
    }
    const marsh = this.marshWeight(x, z);

    // The river: how far the point is from where the river's noise crosses 0.5.
    const river = this.riverNoise(x, z);
    const gx = (this.riverNoise(x + 1, z) - this.riverNoise(x - 1, z)) / 2;
    const gz = (this.riverNoise(x, z + 1) - this.riverNoise(x, z - 1)) / 2;
    const fromCenter = Math.abs(river - 0.5) / Math.max(Math.hypot(gx, gz), 1e-5);
    const [narrow, wide] = settings.riverHalfWidth;
    const widthNoise = fractalNoise(x / 300, z / 300, this.seed + 9611, 2);
    const halfWidth = (narrow + (wide - narrow) * widthNoise) * clear;
    const riverEdge = fromCenter - halfWidth;
    const ford =
      fractalNoise(x / settings.fordSpacing, z / settings.fordSpacing, this.seed + 9621, 2) >
      settings.fordAbove;
    const riverDepth = ford ? settings.fordDepth : settings.riverDepth;

    // The lake: how far inside the basin's line (more lakes, shallower, in the marsh).
    const above = settings.lakeAbove + (settings.marshLakeAbove - settings.lakeAbove) * marsh;
    const lake = this.lakeNoise(x, z);
    const lx = (this.lakeNoise(x + 1, z) - this.lakeNoise(x - 1, z)) / 2;
    const lz = (this.lakeNoise(x, z + 1) - this.lakeNoise(x, z - 1)) / 2;
    const lakeEdge =
      (above - lake) / Math.max(Math.hypot(lx, lz), 1e-5) + (1 - clear) * settings.bankWidth * 2;
    const lakeDepth = settings.lakeDepth + (settings.marshLakeDepth - settings.lakeDepth) * marsh;

    const nearest = Math.min(riverEdge, lakeEdge);
    if (nearest > settings.bankWidth) {
      return undefined;
    }
    const level = this.broadHeight(x, z) - settings.below;
    return riverEdge <= lakeEdge
      ? { level, edge: riverEdge, depth: riverDepth, ramp: Math.min(halfWidth, 4) }
      : { level, edge: lakeEdge, depth: lakeDepth, ramp: settings.lakeRamp };
  }

  /**
   * The land carved for the water: under it the bed (deepening from the shore), along it a low
   * bank that blends back into `ground` over `bankWidth` meters.
   */
  carve(x: number, z: number, ground: number): number {
    const shape = this.shapeAt(x, z);
    if (!shape) {
      return ground;
    }
    const { bankWidth, bankRise } = CONFIG.water;
    if (shape.edge < 0) {
      const t = Math.min(1, -shape.edge / Math.max(shape.ramp, 0.5));
      return shape.level - 0.05 - (shape.depth - 0.05) * smooth(t);
    }
    const t = smooth(shape.edge / bankWidth);
    return shape.level + bankRise + (ground - shape.level - bankRise) * t;
  }

  /** 1 away from the start and the cabins; 0 inside their clear rings (AG10-A). */
  private clearance(x: number, z: number): number {
    const { clearStart, clearCabins, clearBlend } = CONFIG.water;
    let clear = Math.min(1, Math.max(0, (Math.hypot(x, z) - clearStart) / clearBlend));
    for (const site of cabinsNear(x, z, this.seed)) {
      const distance = Math.hypot(x - site.x, z - site.z);
      clear = Math.min(clear, Math.max(0, (distance - clearCabins) / clearBlend));
    }
    return clear;
  }

  private riverNoise(x: number, z: number): number {
    const { riverSpacing, riverWarp } = CONFIG.water;
    // The coordinates are pushed around by another slow noise: the rivers wind.
    const wx = x + (fractalNoise(x / 400, z / 400, this.seed + 9601, 2) - 0.5) * 2 * riverWarp;
    const wz = z + (fractalNoise(x / 400, z / 400, this.seed + 9602, 2) - 0.5) * 2 * riverWarp;
    return fractalNoise(wx / riverSpacing, wz / riverSpacing, this.seed + 9603, 2);
  }

  private lakeNoise(x: number, z: number): number {
    const { lakeSpacing } = CONFIG.water;
    return fractalNoise(x / lakeSpacing, z / lakeSpacing, this.seed + 9631, 3);
  }
}

function smooth(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}
