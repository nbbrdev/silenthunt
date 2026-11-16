import { Mesh, Vector3, VertexBuffer, type Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import { bush } from "../models/nature/bush";
import { deadTree } from "../models/nature/deadTree";
import { groundBranch } from "../models/nature/groundBranch";
import { groundTuft } from "../models/nature/groundTuft";
import { oak } from "../models/nature/oak";
import { pine } from "../models/nature/pine";
import { rock } from "../models/nature/rock";
import type { ModelGenerator } from "../models/types";

export type VegetationKind =
  "pine" | "oak" | "deadTree" | "bush" | "rock" | "groundBranch" | "groundTuft";

const GENERATORS: Record<VegetationKind, ModelGenerator> = {
  pine,
  oak,
  deadTree,
  bush,
  rock,
  groundBranch,
  groundTuft,
};

/** One pre-generated version of a model, drawn many times across the world. */
interface Variant {
  /** The model's meshes (e.g. wood and leaves); every copy is drawn on all of them. */
  meshes: Mesh[];
  /** Trunk radius around 1 m high, for the collision capsule (trees only). */
  trunkRadius: number;
  /** Largest horizontal size, for rock collisions. */
  size: number;
  /** Copies per loaded chunk: 16 numbers (a transform matrix) per copy. */
  matricesByChunk: Map<string, Float32Array>;
  dirty: boolean;
}

/**
 * MW3-A: a few variations of each model are generated once, then repeated across the world
 * with "thin instances" (the GPU draws the same mesh many times from a list of positions). A few
 * dozen meshes cover thousands of trees.
 */
export class VegetationLibrary {
  private readonly variants = new Map<VegetationKind, Variant[]>();
  /** Where the player was when the copy lists were last filtered by distance. */
  private lastCenter: Vector3 | undefined;

  constructor(scene: Scene) {
    for (const [kind, generator] of Object.entries(GENERATORS) as [
      VegetationKind,
      ModelGenerator,
    ][]) {
      const list: Variant[] = [];
      for (let i = 0; i < CONFIG.world.variantsPerModel; i++) {
        const model = generator.create(scene, 1000 + i * 17);
        const meshes = [model.root, ...model.root.getChildMeshes()].filter(
          (node): node is Mesh => node instanceof Mesh,
        );
        for (const mesh of meshes) {
          mesh.isVisible = false;
          // The copies spread over the whole loaded area; Babylon's per-mesh culling would
          // only look at the original at (0, 0, 0).
          mesh.alwaysSelectAsActiveMesh = true;
        }
        const wood = meshes[0];
        list.push({
          meshes,
          trunkRadius: wood ? measureTrunkRadius(wood) : 0.2,
          size: wood ? measureSize(wood) : 1,
          matricesByChunk: new Map(),
          dirty: false,
        });
      }
      this.variants.set(kind, list);
    }
  }

  variantCount(kind: VegetationKind): number {
    return this.variants.get(kind)?.length ?? 0;
  }

  trunkRadius(kind: VegetationKind, variant: number): number {
    return this.variants.get(kind)?.[variant]?.trunkRadius ?? 0.2;
  }

  size(kind: VegetationKind, variant: number): number {
    return this.variants.get(kind)?.[variant]?.size ?? 1;
  }

  /** Sets the copies of one variant inside one chunk (replacing any previous ones). */
  setChunkCopies(
    kind: VegetationKind,
    variant: number,
    chunkKey: string,
    matrices: Float32Array,
  ): void {
    const entry = this.variants.get(kind)?.[variant];
    if (!entry) {
      return;
    }
    entry.matricesByChunk.set(chunkKey, matrices);
    entry.dirty = true;
  }

  /** Removes every copy that belonged to a chunk. */
  removeChunk(chunkKey: string): void {
    for (const list of this.variants.values()) {
      for (const entry of list) {
        if (entry.matricesByChunk.delete(chunkKey)) {
          entry.dirty = true;
        }
      }
    }
  }

  /**
   * Uploads to the GPU only the copies near `center` (CONFIG.world.copyDistance). Changed lists
   * are rebuilt right away; all lists are rebuilt after the player walks copyRefreshDistance.
   * Call once per frame, after loading/unloading chunks.
   */
  flush(center: Vector3): void {
    const moved =
      !this.lastCenter ||
      Vector3.DistanceSquared(center, this.lastCenter) >
        CONFIG.world.copyRefreshDistance * CONFIG.world.copyRefreshDistance;
    if (moved) {
      this.lastCenter = center.clone();
    }
    const near = this.lastCenter ?? center;

    for (const [kind, list] of this.variants) {
      const maxDistance = copyDistanceFor(kind);
      const maxSquared = maxDistance * maxDistance;
      for (const entry of list) {
        if (!entry.dirty && !moved) {
          continue;
        }
        entry.dirty = false;
        // Elements 12 and 14 of a transform matrix are its x and z position.
        const isNear = (matrices: Float32Array, i: number) => {
          const dx = (matrices[i + 12] ?? 0) - near.x;
          const dz = (matrices[i + 14] ?? 0) - near.z;
          return dx * dx + dz * dz <= maxSquared;
        };
        let count = 0;
        for (const matrices of entry.matricesByChunk.values()) {
          for (let i = 0; i < matrices.length; i += 16) {
            if (isNear(matrices, i)) {
              count++;
            }
          }
        }
        const buffer = new Float32Array(count * 16);
        let offset = 0;
        for (const matrices of entry.matricesByChunk.values()) {
          for (let i = 0; i < matrices.length; i += 16) {
            if (isNear(matrices, i)) {
              buffer.set(matrices.subarray(i, i + 16), offset);
              offset += 16;
            }
          }
        }
        const total = buffer.length;
        for (const mesh of entry.meshes) {
          // With no copies the mesh is hidden: removing the buffer would draw the original.
          mesh.isVisible = total > 0;
          if (total > 0) {
            mesh.thinInstanceSetBuffer("matrix", buffer, 16, false);
          }
        }
      }
    }
  }
}

function copyDistanceFor(kind: VegetationKind): number {
  const { tree, medium, small } = CONFIG.world.copyDistance;
  if (kind === "pine" || kind === "oak" || kind === "deadTree") {
    return tree;
  }
  return kind === "bush" || kind === "rock" ? medium : small;
}

/** Widest horizontal distance of the vertices between 0.8 and 1.6 m high (above the roots). */
function measureTrunkRadius(mesh: Mesh): number {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1] ?? 0;
    if (y > 0.8 && y < 1.6) {
      const x = positions[i] ?? 0;
      const z = positions[i + 2] ?? 0;
      radius = Math.max(radius, Math.sqrt(x * x + z * z));
    }
  }
  return Math.min(Math.max(radius, 0.08), 0.6);
}

function measureSize(mesh: Mesh): number {
  const { minimum, maximum } = mesh.getBoundingInfo().boundingBox;
  return Math.max(maximum.x - minimum.x, maximum.z - minimum.z);
}
