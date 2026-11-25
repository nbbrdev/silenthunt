import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import type { DayClock } from "../core/dayClock";
import { hashPosition } from "../core/random";
import type { Atmosphere } from "./atmosphere";
import type { ChunkManager } from "./chunks";
import type { Terrain } from "./terrain";

interface Spot {
  x: number;
  y: number;
  z: number;
  width: number;
}

/**
 * The shaft's look, drawn by code: light that is strongest up toward the canopy and fades away
 * before the ground, soft at the sides.
 */
function createShaftTexture(scene: Scene): DynamicTexture {
  const width = 64;
  const height = 256;
  const texture = new DynamicTexture("lightShaft", { width, height }, scene, true);
  const context = texture.getContext();
  const image = context.getImageData(0, 0, width, height);
  const smooth = (edge0: number, edge1: number, t: number) => {
    const x = Math.min(1, Math.max(0, (t - edge0) / (edge1 - edge0)));
    return x * x * (3 - 2 * x);
  };
  for (let row = 0; row < height; row++) {
    // v: 0 at the bottom (the ground), 1 at the top (the canopy).
    const v = 1 - (row + 0.5) / height;
    const along = smooth(0, 0.3, v) * (1 - smooth(0.8, 1, v)) * (0.55 + 0.45 * v);
    for (let col = 0; col < width; col++) {
      const u = (col + 0.5) / width;
      const across = Math.sin(Math.PI * u) ** 2;
      const index = (row * width + col) * 4;
      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = Math.round(255 * along * across);
    }
  }
  context.putImageData(image, 0, 0);
  texture.hasAlpha = true;
  texture.update();
  return texture;
}

/**
 * NBB-169 (FL5-A): shafts of sunlight through the canopy's gaps, around the camera, by day. Each
 * is three crossed sheets (so it never looks flat from the side), leaning with the sun, warmer
 * at dawn and dusk, swallowed by the fog with distance. They stand where no trunk is near but
 * trees are all around (a canopy above), at spots drawn from the seed, so they stay put.
 */
export class LightShafts {
  private readonly terrain: Terrain;
  private readonly chunks: ChunkManager;
  private readonly clock: DayClock;
  private readonly atmosphere: Atmosphere;
  private readonly at: () => Vector3;
  private readonly material: StandardMaterial;
  private readonly shafts: Mesh[] = [];
  private spots: Spot[] = [];
  private lastRefresh: { x: number; z: number } | undefined;
  private readonly axis = new Quaternion();

  constructor(
    scene: Scene,
    parts: {
      terrain: Terrain;
      chunks: ChunkManager;
      clock: DayClock;
      atmosphere: Atmosphere;
      at: () => Vector3;
    },
  ) {
    this.terrain = parts.terrain;
    this.chunks = parts.chunks;
    this.clock = parts.clock;
    this.atmosphere = parts.atmosphere;
    this.at = parts.at;
    const settings = CONFIG.lightShafts;

    const texture = createShaftTexture(scene);
    this.material = new StandardMaterial("lightShaft", scene);
    this.material.disableLighting = true;
    this.material.emissiveTexture = texture;
    this.material.opacityTexture = texture;
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;

    // Three sheets crossed around the shaft's axis (its local Y), 1 × 1, from its foot up.
    const sheets = [0, 1, 2].map((i) => {
      const sheet = MeshBuilder.CreatePlane(
        `lightShaftSheet${i}`,
        { width: 1, height: 1, sideOrientation: Mesh.DOUBLESIDE },
        scene,
      );
      sheet.position.y = 0.5;
      sheet.rotation.y = (i * Math.PI) / 3;
      sheet.bakeCurrentTransformIntoVertices();
      return sheet;
    });
    const base = Mesh.MergeMeshes(sheets, true);
    if (base) {
      base.name = "lightShaft";
      base.material = this.material;
      base.isPickable = false;
      base.setEnabled(false);
      for (let i = 0; i < settings.count; i++) {
        const shaft = base.clone(`lightShaft${i}`);
        shaft.rotationQuaternion = new Quaternion();
        shaft.setEnabled(false);
        this.shafts.push(shaft);
      }
    }
    scene.onBeforeRenderObservable.add(() => this.update());
  }

  /** Development: how many shafts stand now, and how strong they are. */
  get debugState(): { shafts: number; alpha: number } {
    return {
      shafts: this.shafts.filter((shaft) => shaft.isEnabled()).length,
      alpha: Math.round(this.material.alpha * 1000) / 1000,
    };
  }

  /** The spots for shafts around (x, z): in gaps under a canopy, nearest first. */
  private findSpots(x: number, z: number): Spot[] {
    const settings = CONFIG.lightShafts;
    const { cell, chance, gap, around, minTrees, reach } = settings;
    const seed = this.terrain.seed;
    const spots: (Spot & { distance: number })[] = [];
    const cells = Math.ceil(reach / cell);
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    for (let dz = -cells; dz <= cells; dz++) {
      for (let dx = -cells; dx <= cells; dx++) {
        const ix = cx + dx;
        const iz = cz + dz;
        if (hashPosition(ix, iz, 731, seed) >= chance) {
          continue;
        }
        const px = (ix + 0.2 + 0.6 * hashPosition(ix, iz, 732, seed)) * cell;
        const pz = (iz + 0.2 + 0.6 * hashPosition(ix, iz, 733, seed)) * cell;
        const distance = Math.hypot(px - x, pz - z);
        if (distance > reach) {
          continue;
        }
        const trees = this.chunks.treesNear(px, pz, around);
        const grown = trees.filter((tree) => !tree.young);
        if (grown.length < minTrees) {
          continue;
        }
        if (trees.some((tree) => Math.hypot(tree.x - px, tree.z - pz) < gap)) {
          continue;
        }
        const [narrow, wide] = settings.width;
        spots.push({
          x: px,
          y: this.terrain.heightAt(px, pz),
          z: pz,
          width: narrow + (wide - narrow) * hashPosition(ix, iz, 734, seed),
          distance,
        });
      }
    }
    return spots.sort((a, b) => a.distance - b.distance).slice(0, settings.count);
  }

  private update(): void {
    const settings = CONFIG.lightShafts;
    const daylight = this.clock.daylight;
    const at = this.at();
    if (daylight <= 0.05) {
      for (const shaft of this.shafts) {
        shaft.setEnabled(false);
      }
      this.lastRefresh = undefined;
      return;
    }
    const moved = this.lastRefresh
      ? Math.hypot(at.x - this.lastRefresh.x, at.z - this.lastRefresh.z)
      : Infinity;
    if (moved > settings.refreshMeters) {
      this.lastRefresh = { x: at.x, z: at.z };
      this.spots = this.findSpots(at.x, at.z);
    }

    // The light's color and strength: warmer at dawn and dusk, gone at night.
    const warmth = this.clock.warmth;
    const { color, warmColor } = settings;
    this.material.emissiveColor = Color3.Lerp(
      new Color3(color.r, color.g, color.b),
      new Color3(warmColor.r, warmColor.g, warmColor.b),
      warmth,
    );
    this.material.alpha = settings.alpha * Math.min(1, daylight * 1.5);

    // The shaft runs up toward the sun, leaning at most `maxLean` from straight up.
    const toSun = this.atmosphere.sunDirection.scale(-1).normalize();
    const flat = Math.hypot(toSun.x, toSun.z);
    const lean = Math.min(Math.atan2(flat, Math.max(toSun.y, 1e-3)), settings.maxLean);
    const axis =
      flat > 1e-4
        ? new Vector3(
            (toSun.x / flat) * Math.sin(lean),
            Math.cos(lean),
            (toSun.z / flat) * Math.sin(lean),
          )
        : Vector3.Up();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), axis, this.axis);

    this.shafts.forEach((shaft, index) => {
      const spot = this.spots[index];
      if (!spot) {
        shaft.setEnabled(false);
        return;
      }
      shaft.setEnabled(true);
      shaft.position.set(spot.x, spot.y, spot.z);
      shaft.rotationQuaternion?.copyFrom(this.axis);
      shaft.scaling.set(spot.width, settings.height, spot.width);
      // Faded when close (it never fills the view) and toward the edge of its reach.
      const distance = Math.hypot(spot.x - at.x, spot.z - at.z);
      const near = Math.min(1, Math.max(0, (distance - settings.nearFade / 2) / settings.nearFade));
      const far = Math.min(1, Math.max(0, (settings.reach - distance) / 8));
      shaft.visibility = near * far;
    });
  }
}
