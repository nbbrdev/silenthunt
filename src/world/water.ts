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
  kind: "river" | "lake";
}

/** NBB-165 (CC1-A): a waterfall, where a river drops down a step of the ridge. */
export interface Waterfall {
  /** The middle of its lip, across the river. */
  x: number;
  z: number;
  /** The water's height above and below the drop. */
  top: number;
  bottom: number;
  /** Which way it falls (a unit vector on the ground). */
  dirX: number;
  dirZ: number;
  /** How wide the lip is (meters). */
  width: number;
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
  /**
   * The land's broad shape (without small bumps), for the water's surface. NBB-165 (CC1-A):
   * `sheer` drops the ridge's steps sheer, for the rivers (they fall there); the lakes keep the
   * gentle shape.
   */
  private readonly broadHeight: (x: number, z: number, sheer: boolean) => number;
  private readonly marshWeight: (x: number, z: number) => number;
  /** NBB-165: the waterfalls found in each region (they never change). */
  private readonly falls = new Map<string, Waterfall[]>();

  /** NBB-165: how much of the ridge is at a point (waterfalls are only there). */
  private readonly ridgeWeight: (x: number, z: number) => number;

  constructor(
    seed: number,
    broadHeight: (x: number, z: number, sheer: boolean) => number,
    marshWeight: (x: number, z: number) => number,
    ridgeWeight: (x: number, z: number) => number,
  ) {
    this.seed = seed;
    this.broadHeight = broadHeight;
    this.marshWeight = marshWeight;
    this.ridgeWeight = ridgeWeight;
  }

  /**
   * The water at (x, z), or undefined where there is none near. NBB-165 (CC2-A): at the foot of
   * each waterfall, a round pool, deeper than the river.
   */
  shapeAt(x: number, z: number): WaterShape | undefined {
    const base = this.baseShapeAt(x, z);
    const { poolRadius, poolDepth, poolRamp } = CONFIG.water.falls;
    const reach = poolRadius + CONFIG.water.bankWidth;
    let shape = base;
    for (const fall of this.fallsNear(x, z, reach + poolRadius)) {
      // Only below the lip: above it the river and its banks stay as they are.
      if ((x - fall.x) * fall.dirX + (z - fall.z) * fall.dirZ < 0) {
        continue;
      }
      const edge = Math.hypot(x - this.poolX(fall), z - this.poolZ(fall)) - poolRadius;
      if (edge > reach - poolRadius || edge >= (shape?.edge ?? Infinity)) {
        continue;
      }
      shape = { level: fall.bottom, edge, depth: poolDepth, ramp: poolRamp, kind: "lake" };
    }
    return shape;
  }

  /** CC2-A: where a waterfall's pool is centered (touching the foot of the drop). */
  poolX(fall: Waterfall): number {
    return fall.x + fall.dirX * CONFIG.water.falls.poolRadius;
  }

  poolZ(fall: Waterfall): number {
    return fall.z + fall.dirZ * CONFIG.water.falls.poolRadius;
  }

  /** The rivers and lakes alone, before the waterfalls' pools. */
  private baseShapeAt(x: number, z: number): WaterShape | undefined {
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
    const isRiver = riverEdge <= lakeEdge;
    const level = this.broadHeight(x, z, isRiver) - settings.below;
    return isRiver
      ? { level, edge: riverEdge, depth: riverDepth, ramp: Math.min(halfWidth, 4), kind: "river" }
      : { level, edge: lakeEdge, depth: lakeDepth, ramp: settings.lakeRamp, kind: "lake" };
  }

  /**
   * NBB-165 (CC1-A): the waterfalls whose lip lies in the square region (ix, iz) of
   * `falls.region` meters. A river's surface follows the land's broad shape, which on the ridge
   * drops sheer at each step (see Terrain): where two neighboring points of a river differ by
   * more than `falls.minDrop`, the river falls. Those points are gathered into one waterfall per
   * crossing. A margin around the region keeps a waterfall on a border whole.
   */
  fallsInRegion(ix: number, iz: number): Waterfall[] {
    const key = `${ix},${iz}`;
    const cached = this.falls.get(key);
    if (cached) {
      return cached;
    }
    const { region, sample, minDrop, gather, margin } = CONFIG.water.falls;
    const minX = ix * region;
    const minZ = iz * region;
    // Only the ridge has steps: a region without any of it has no waterfall (checked on a few
    // points; the ridge's patches are hundreds of meters wide).
    let ridge = false;
    for (let j = 0; j <= 4 && !ridge; j++) {
      for (let i = 0; i <= 4 && !ridge; i++) {
        const px = minX - margin + ((region + margin * 2) * i) / 4;
        const pz = minZ - margin + ((region + margin * 2) * j) / 4;
        ridge = this.ridgeWeight(px, pz) > 0;
      }
    }
    if (!ridge) {
      this.falls.set(key, []);
      return [];
    }
    const count = Math.ceil((region + margin * 2) / sample) + 1;
    const levels: (number | undefined)[] = [];
    for (let j = 0; j < count; j++) {
      for (let i = 0; i < count; i++) {
        const shape = this.baseShapeAt(minX - margin + i * sample, minZ - margin + j * sample);
        // CC1-A: only the rivers fall (a lake keeps its gentle surface).
        levels.push(shape && shape.edge < 0 && shape.kind === "river" ? shape.level : undefined);
      }
    }
    // Each step of the grid that crosses a drop, from the higher point to the lower one.
    const crossings: {
      x: number;
      z: number;
      top: number;
      bottom: number;
      dx: number;
      dz: number;
    }[] = [];
    for (let j = 0; j < count; j++) {
      for (let i = 0; i < count; i++) {
        const here = levels[j * count + i];
        if (here === undefined) {
          continue;
        }
        for (const [di, dj] of [
          [1, 0],
          [0, 1],
        ] as const) {
          if (i + di >= count || j + dj >= count) {
            continue;
          }
          const there = levels[(j + dj) * count + i + di];
          if (there === undefined || Math.abs(here - there) < minDrop) {
            continue;
          }
          const down = there < here ? 1 : -1;
          crossings.push({
            x: minX - margin + (i + di / 2) * sample,
            z: minZ - margin + (j + dj / 2) * sample,
            top: Math.max(here, there),
            bottom: Math.min(here, there),
            dx: di * down,
            dz: dj * down,
          });
        }
      }
    }
    // Gathered: crossings next to each other (within `gather` m) down the same step (about the
    // same heights) join into one waterfall, in chains along its lip; the next step down, a few
    // meters on, is another one. Each crossing starts alone and neighbors merge (union-find).
    const parent = crossings.map((_, index) => index);
    const root = (index: number): number => {
      let at = index;
      while (parent[at] !== at) {
        at = parent[at] ?? at;
      }
      return at;
    };
    crossings.forEach((a, i) => {
      for (let j = i + 1; j < crossings.length; j++) {
        const b = crossings[j];
        if (
          b &&
          Math.hypot(a.x - b.x, a.z - b.z) <= gather &&
          Math.abs(a.top - b.top) < minDrop / 2 &&
          Math.abs(a.bottom - b.bottom) < minDrop / 2
        ) {
          parent[root(j)] = root(i);
        }
      }
    });
    const byRoot = new Map<number, typeof crossings>();
    crossings.forEach((crossing, index) => {
      const key = root(index);
      byRoot.set(key, [...(byRoot.get(key) ?? []), crossing]);
    });
    const groups = [...byRoot.values()];
    const falls: Waterfall[] = [];
    for (const group of groups) {
      const x = group.reduce((sum, m) => sum + m.x, 0) / group.length;
      const z = group.reduce((sum, m) => sum + m.z, 0) / group.length;
      if (x < minX || x >= minX + region || z < minZ || z >= minZ + region) {
        continue;
      }
      let dirX = group.reduce((sum, m) => sum + m.dx, 0);
      let dirZ = group.reduce((sum, m) => sum + m.dz, 0);
      const length = Math.hypot(dirX, dirZ) || 1;
      dirX /= length;
      dirZ /= length;
      // Across the fall: the spread of the crossings sideways.
      const side = group.map((m) => (m.x - x) * -dirZ + (m.z - z) * dirX);
      const width = Math.max(...side) - Math.min(...side) + sample;
      falls.push({
        x,
        z,
        top: group.reduce((sum, m) => sum + m.top, 0) / group.length,
        bottom: group.reduce((sum, m) => sum + m.bottom, 0) / group.length,
        dirX,
        dirZ,
        width,
      });
    }
    this.falls.set(key, falls);
    return falls;
  }

  /** NBB-165: the waterfalls within `radius` meters of (x, z). */
  fallsNear(x: number, z: number, radius: number): Waterfall[] {
    const { region } = CONFIG.water.falls;
    const found: Waterfall[] = [];
    for (
      let iz = Math.floor((z - radius) / region);
      iz <= Math.floor((z + radius) / region);
      iz++
    ) {
      for (
        let ix = Math.floor((x - radius) / region);
        ix <= Math.floor((x + radius) / region);
        ix++
      ) {
        for (const fall of this.fallsInRegion(ix, iz)) {
          if (Math.hypot(fall.x - x, fall.z - z) <= radius) {
            found.push(fall);
          }
        }
      }
    }
    return found;
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
