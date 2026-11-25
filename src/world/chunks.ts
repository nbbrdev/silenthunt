import {
  Matrix,
  Mesh,
  Observable,
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeCapsule,
  PhysicsShapeContainer,
  PhysicsShapeMesh,
  PhysicsShapeSphere,
  Quaternion,
  TransformNode,
  Vector3,
  VertexData,
  type Material,
  type PhysicsShape,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { createRandom, hashPosition, randomInt, randomRange } from "../core/random";
import { BIOMES, type Biome } from "./biomes";
import { cabinWallCircles, cabinsInChunk, cabinsNear } from "./cabinSites";
import { fractalNoise } from "./noise";
import type { Terrain } from "./terrain";
import { isTree, type TreeKind, type VegetationKind, type VegetationLibrary } from "./vegetation";

/** One thing placed in a chunk. */
interface Placement {
  kind: VegetationKind;
  variant: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  /** Picked up by the player (CL1): no longer drawn, and it stays gone. */
  removed?: boolean;
}

/** Something on the ground the player can pick up by hand (CL1, RF-58). */
export interface Pickable {
  /** The chunk and the index of the placement inside it (its id in the chunk's change list). */
  chunkKey: string;
  index: number;
  kind: "groundBranch" | "rock" | "bush";
  x: number;
  z: number;
}

/** A tree or a big rock the axe can work on (NBB-144, MC1-A). */
export interface Choppable {
  chunkKey: string;
  index: number;
  kind: TreeKind | "rock" | "boulder";
  variant: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  /** The trunk's radius, or the rock's (meters). */
  radius: number;
}

/** Which chunk: its key ("cx,cz") and grid coordinates. */
export interface ChunkInfo {
  key: string;
  cx: number;
  cz: number;
}

/** Something that blocks walking, seen from above: a circle on the ground. */
export interface Obstacle {
  x: number;
  z: number;
  radius: number;
  /** How tall it is above the ground: arrows and shots above it fly past (0: nothing to hit). */
  height: number;
  /** Part of the player's buildings (NBB-145): new pieces may stand next to it. */
  structure?: boolean;
}

/** Trunks stop arrows and shots up to this height above the ground (meters). */
const TRUNK_BLOCK_HEIGHT = 6;

interface ChunkColliders {
  node: TransformNode;
  body: PhysicsBody;
  shapes: PhysicsShape[];
}

interface Chunk {
  key: string;
  cx: number;
  cz: number;
  terrainMesh: Mesh;
  placements: Placement[];
  colliders?: ChunkColliders;
}

/**
 * Loads the chunks around the player and unloads the ones left behind (M11-C, G5). Each chunk
 * gets its piece of terrain and its vegetation (as copies in the VegetationLibrary). Chunks next
 * to the player also get collisions: terrain, tree trunks and big rocks (MW5).
 */
export class ChunkManager {
  private readonly scene: Scene;
  private readonly terrain: Terrain;
  private readonly library: VegetationLibrary;
  private readonly groundMaterial: Material;
  private readonly chunks = new Map<string, Chunk>();
  private readonly queue: { cx: number; cz: number }[] = [];
  private centerKey = "";
  /** Branches already stepped on ("chunkKey:placementIndex"). */
  private readonly snappedBranches = new Set<string>();
  /**
   * The changes to each chunk (CL1, docs/05): the placements the player took. Kept when the chunk
   * unloads, so they do not grow back; this is what the save stores (NBB-147).
   */
  private readonly removedByChunk = new Map<string, Set<number>>();
  /** A chunk was loaded or unloaded (the prey live and die with their chunk, PR1). */
  readonly onChunkLoaded = new Observable<ChunkInfo>();
  readonly onChunkUnloaded = new Observable<ChunkInfo>();

  /** NBB-164 (AG8-A): a loaded chunk's ground mesh (reflected by the water), if loaded. */
  terrainMeshOf(key: string): Mesh | undefined {
    return this.chunks.get(key)?.terrainMesh;
  }

  /** The chunks loaded right now. */
  loadedChunks(): ChunkInfo[] {
    return [...this.chunks.values()].map(({ key, cx, cz }) => ({ key, cx, cz }));
  }

  constructor(
    scene: Scene,
    terrain: Terrain,
    library: VegetationLibrary,
    groundMaterial: Material,
  ) {
    this.scene = scene;
    this.terrain = terrain;
    this.library = library;
    this.groundMaterial = groundMaterial;
  }

  /**
   * NO4-B: true if the feet at (x, z) are on a visible dry branch that has not snapped yet. Each
   * branch snaps only once ("estalo único", RF-11); it is remembered even if its chunk unloads.
   */
  stepOnBranch(x: number, z: number): boolean {
    const { chunkSize } = CONFIG.world;
    const reach = CONFIG.noise.branchStepDistance;
    const cx = Math.floor(x / chunkSize);
    const cz = Math.floor(z / chunkSize);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = this.chunks.get(chunkKey(cx + dx, cz + dz));
        if (!chunk) {
          continue;
        }
        for (let i = 0; i < chunk.placements.length; i++) {
          const placement = chunk.placements[i];
          if (!placement || placement.kind !== "groundBranch" || placement.removed) {
            continue;
          }
          const id = `${chunk.key}:${i}`;
          if (this.snappedBranches.has(id)) {
            continue;
          }
          const distanceX = placement.x - x;
          const distanceZ = placement.z - z;
          if (distanceX * distanceX + distanceZ * distanceZ <= reach * reach) {
            this.snappedBranches.add(id);
            return true;
          }
        }
      }
    }
    return false;
  }

  /** Positions of the dry branches lying within `radius` of (x, z) (debugging and tests). */
  branchesNear(x: number, z: number, radius: number): { x: number; z: number }[] {
    const found: { x: number; z: number }[] = [];
    for (const chunk of this.chunks.values()) {
      for (const placement of chunk.placements) {
        if (
          placement.kind === "groundBranch" &&
          !placement.removed &&
          (placement.x - x) ** 2 + (placement.z - z) ** 2 <= radius * radius
        ) {
          found.push({ x: placement.x, z: placement.z });
        }
      }
    }
    return found;
  }

  /**
   * CL1: the branches, small rocks (the ones that do not block, MW5) and bushes within `radius`
   * of (x, z), nearest first.
   */
  pickablesNear(x: number, z: number, radius: number): Pickable[] {
    const { chunkSize, blockingRockSize } = CONFIG.world;
    const cx = Math.floor(x / chunkSize);
    const cz = Math.floor(z / chunkSize);
    const found: (Pickable & { distance: number })[] = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = this.chunks.get(chunkKey(cx + dx, cz + dz));
        chunk?.placements.forEach((placement, index) => {
          const { kind } = placement;
          if (placement.removed) {
            return;
          }
          if (kind !== "groundBranch" && kind !== "bush" && kind !== "rock") {
            return;
          }
          if (
            kind === "rock" &&
            this.library.size(kind, placement.variant) * placement.scale >= blockingRockSize
          ) {
            return;
          }
          const distance = Math.hypot(placement.x - x, placement.z - z);
          if (distance <= radius) {
            found.push({
              chunkKey: chunk.key,
              index,
              kind,
              x: placement.x,
              z: placement.z,
              distance,
            });
          }
        });
      }
    }
    return found.sort((a, b) => a.distance - b.distance);
  }

  /**
   * BM1 (NBB-163): the nearest placement of `kind` within `radius` of (x, z) (the reeds and the
   * tall grass the player hides in), as "chunkKey:index", or undefined.
   */
  nearestOf(kind: VegetationKind, x: number, z: number, radius: number): string | undefined {
    const { chunkSize } = CONFIG.world;
    const cx = Math.floor(x / chunkSize);
    const cz = Math.floor(z / chunkSize);
    let best: string | undefined;
    let bestDistance = radius;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = this.chunks.get(chunkKey(cx + dx, cz + dz));
        chunk?.placements.forEach((placement, index) => {
          if (placement.kind !== kind || placement.removed) {
            return;
          }
          const distance = Math.hypot(placement.x - x, placement.z - z);
          if (distance <= bestDistance) {
            bestDistance = distance;
            best = `${chunk.key}:${index}`;
          }
        });
      }
    }
    return best;
  }

  /** NBB-147: the chunks' changes, for the save ("cx,cz" → indexes of what was taken). */
  get changes(): Record<string, number[]> {
    return Object.fromEntries(
      [...this.removedByChunk].map(([key, indexes]) => [key, [...indexes]]),
    );
  }

  /**
   * NBB-157 (MP7-A, MP8): the trees of chunk (cx, cz), loaded or not (the vegetation comes from
   * the seed alone), without the ones felled.
   */
  treesIn(cx: number, cz: number): { x: number; z: number }[] {
    const key = chunkKey(cx, cz);
    const placements = this.chunks.get(key)?.placements ?? this.placeVegetation(cx, cz);
    const removed = this.removedByChunk.get(key);
    const trees: { x: number; z: number }[] = [];
    placements.forEach((placement, index) => {
      if (isTree(placement.kind) && !removed?.has(index)) {
        trees.push({ x: placement.x, z: placement.z });
      }
    });
    return trees;
  }

  /** NBB-147: the changes of a saved game, applied to the chunks loaded now and the rest. */
  restoreChanges(changes: Record<string, number[]>): void {
    for (const [key, indexes] of Object.entries(changes)) {
      for (const index of indexes) {
        this.removePlacement(key, index);
      }
    }
  }

  /** CL1: the player took this placement: it disappears and is remembered in the chunk's changes. */
  removePlacement(key: string, index: number): void {
    const removed = this.removedByChunk.get(key) ?? new Set<number>();
    removed.add(index);
    this.removedByChunk.set(key, removed);
    const chunk = this.chunks.get(key);
    const placement = chunk?.placements[index];
    if (!chunk || !placement) {
      return;
    }
    placement.removed = true;
    this.uploadCopies(chunk.key, chunk.placements);
    // A felled tree or a broken rock no longer blocks the way (NBB-144).
    if (chunk.colliders) {
      this.removeColliders(chunk);
      chunk.colliders = this.buildColliders(chunk);
    }
  }

  /**
   * NBB-144 (MC1-A): the trees and big rocks the axe can reach from (x, z), nearest first, with
   * the radius of their trunk or body.
   */
  /**
   * NBB-169 (FL4-A, FL5-A): the standing trees within `radius` meters of (x, z), with whether
   * each is a young one (see isYoungTree), for the canopy's shade and the light shafts.
   */
  treesNear(x: number, z: number, radius: number): { x: number; z: number; young: boolean }[] {
    const { chunkSize } = CONFIG.world;
    const found: { x: number; z: number; young: boolean }[] = [];
    const reach = Math.ceil(radius / chunkSize);
    const cx = Math.floor(x / chunkSize);
    const cz = Math.floor(z / chunkSize);
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        for (const placement of this.chunks.get(chunkKey(cx + dx, cz + dz))?.placements ?? []) {
          if (placement.removed || !isTree(placement.kind)) {
            continue;
          }
          if (Math.hypot(placement.x - x, placement.z - z) <= radius) {
            found.push({
              x: placement.x,
              z: placement.z,
              young: this.library.isYoungVariant(placement.variant),
            });
          }
        }
      }
    }
    return found;
  }

  choppablesNear(x: number, z: number, radius: number): Choppable[] {
    const { chunkSize, blockingRockSize } = CONFIG.world;
    const cx = Math.floor(x / chunkSize);
    const cz = Math.floor(z / chunkSize);
    const found: (Choppable & { distance: number })[] = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = this.chunks.get(chunkKey(cx + dx, cz + dz));
        chunk?.placements.forEach((placement, index) => {
          const { kind, variant, scale } = placement;
          if (placement.removed) {
            return;
          }
          let size: number;
          if (isTree(kind)) {
            size = this.library.trunkRadius(kind, variant) * scale;
          } else if (kind === "rock" || kind === "boulder") {
            const rockSize = this.library.size(kind, variant) * scale;
            if (rockSize < blockingRockSize) {
              return;
            }
            size = rockSize * 0.42;
          } else {
            return;
          }
          const distance = Math.hypot(placement.x - x, placement.z - z) - size;
          if (distance <= radius) {
            found.push({ ...placement, kind, chunkKey: chunk.key, index, radius: size, distance });
          }
        });
      }
    }
    return found.sort((a, b) => a.distance - b.distance);
  }

  /** NBB-144: a separate copy of a tree, to show it falling (dispose of it when done). */
  createLooseModel(target: Choppable): TransformNode {
    return this.library.createLoose(target.kind, target.variant);
  }

  /** NBB-144: the trees felled in a chunk (their stumps), from the chunk's changes. */
  felledTrees(key: string): Choppable[] {
    const chunk = this.chunks.get(key);
    const felled: Choppable[] = [];
    chunk?.placements.forEach((placement, index) => {
      const { kind, variant, scale } = placement;
      if (placement.removed && isTree(kind)) {
        const radius = this.library.trunkRadius(kind, variant) * scale;
        felled.push({ ...placement, kind, chunkKey: key, index, radius });
      }
    });
    return felled;
  }

  /**
   * IA1: the things that block walking (tree trunks and big rocks, as in MW5) within `radius` of
   * (x, z), as circles on the ground. The creature steers around them.
   */
  obstaclesNear(x: number, z: number, radius: number): Obstacle[] {
    const { chunkSize, blockingRockSize } = CONFIG.world;
    const found: Obstacle[] = [];
    const reach = Math.ceil(radius / chunkSize);
    const cx = Math.floor(x / chunkSize);
    const cz = Math.floor(z / chunkSize);
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const chunk = this.chunks.get(chunkKey(cx + dx, cz + dz));
        for (const placement of chunk?.placements ?? []) {
          const { kind, variant, scale } = placement;
          if (placement.removed) {
            continue;
          }
          let obstacleRadius: number;
          let height: number;
          if (kind === "cliff") {
            // BM4-A: a rock wall, as a row of circles along its length.
            const reachSquared = (radius + this.library.size(kind, variant) * scale) ** 2;
            if ((placement.x - x) ** 2 + (placement.z - z) ** 2 <= reachSquared) {
              found.push(...cliffCircles(placement, this.library.size(kind, variant)));
            }
            continue;
          }
          if (isTree(kind)) {
            obstacleRadius = this.library.trunkRadius(kind, variant) * scale;
            height = TRUNK_BLOCK_HEIGHT;
          } else if (kind === "rock" || kind === "boulder") {
            const size = this.library.size(kind, variant) * scale;
            if (size < blockingRockSize) {
              continue;
            }
            // The same sphere as its collider: centered 0.1·size up, 0.42·size wide.
            obstacleRadius = size * 0.42;
            height = size * 0.52;
          } else {
            continue;
          }
          const reachSquared = (radius + obstacleRadius) ** 2;
          if ((placement.x - x) ** 2 + (placement.z - z) ** 2 <= reachSquared) {
            found.push({ x: placement.x, z: placement.z, radius: obstacleRadius, height });
          }
        }
        // ES1: cabin walls block like trunks.
        for (const site of cabinsInChunk(cx + dx, cz + dz, this.terrain.seed)) {
          if (Math.hypot(site.x - x, site.z - z) > radius + 4) {
            continue;
          }
          for (const circle of cabinWallCircles(site)) {
            if ((circle.x - x) ** 2 + (circle.z - z) ** 2 <= (radius + circle.radius) ** 2) {
              found.push(circle);
            }
          }
        }
      }
    }
    // NBB-145: the player's walls and closed doors block like the cabin's.
    for (const provider of this.obstacleProviders) {
      found.push(...provider(x, z, radius));
    }
    return found;
  }

  /** Other things that block walking, arrows and shots (the player's buildings, NBB-145). */
  readonly obstacleProviders: ((x: number, z: number, radius: number) => Obstacle[])[] = [];

  /** Loads everything around `position` right away (used before the game starts). */
  loadAround(position: Vector3): void {
    this.update(position);
    while (this.queue.length > 0) {
      this.loadNext();
    }
    this.updateColliders(position);
    this.library.flush(position);
  }

  /** Call every frame with the player position. Loads at most one chunk per frame. */
  update(position: Vector3): void {
    const { chunkSize, loadRadius } = CONFIG.world;
    const cx = Math.floor(position.x / chunkSize);
    const cz = Math.floor(position.z / chunkSize);
    const key = chunkKey(cx, cz);

    if (key !== this.centerKey) {
      this.centerKey = key;
      // Unload what is now out of range.
      for (const chunk of this.chunks.values()) {
        if (Math.abs(chunk.cx - cx) > loadRadius || Math.abs(chunk.cz - cz) > loadRadius) {
          this.unload(chunk);
        }
      }
      // Queue what is missing, closest first.
      this.queue.length = 0;
      for (let dz = -loadRadius; dz <= loadRadius; dz++) {
        for (let dx = -loadRadius; dx <= loadRadius; dx++) {
          if (!this.chunks.has(chunkKey(cx + dx, cz + dz))) {
            this.queue.push({ cx: cx + dx, cz: cz + dz });
          }
        }
      }
      this.queue.sort(
        (a, b) =>
          Math.max(Math.abs(a.cx - cx), Math.abs(a.cz - cz)) -
          Math.max(Math.abs(b.cx - cx), Math.abs(b.cz - cz)),
      );
      this.updateColliders(position);
    }

    if (this.queue.length > 0) {
      this.loadNext();
      this.updateColliders(position);
    }
    this.library.flush(position);
  }

  private loadNext(): void {
    const next = this.queue.shift();
    if (!next || this.chunks.has(chunkKey(next.cx, next.cz))) {
      return;
    }
    this.load(next.cx, next.cz);
  }

  private load(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    const terrainMesh = buildTerrainMesh(this.scene, this.terrain, cx, cz);
    terrainMesh.material = this.groundMaterial;
    const placements = this.placeVegetation(cx, cz);
    // CL1: what the player already took stays gone.
    for (const index of this.removedByChunk.get(key) ?? []) {
      const placement = placements[index];
      if (placement) {
        placement.removed = true;
      }
    }
    this.uploadCopies(key, placements);
    this.chunks.set(key, { key, cx, cz, terrainMesh, placements });
    this.onChunkLoaded.notifyObservers({ key, cx, cz });
  }

  /**
   * Groups the placements by model variation and hands them to the library as matrices. Removed
   * placements are left out (a variation with none left gets an empty list).
   */
  private uploadCopies(key: string, placements: Placement[]): void {
    const groups = new Map<string, Placement[]>();
    for (const placement of placements) {
      const groupKey = `${placement.kind}:${placement.variant}`;
      const group = groups.get(groupKey) ?? [];
      group.push(placement);
      groups.set(groupKey, group);
    }
    const matrix = new Matrix();
    const scale = new Vector3();
    const position = new Vector3();
    for (const group of groups.values()) {
      const first = group[0];
      if (!first) {
        continue;
      }
      const kept = group.filter((placement) => !placement.removed);
      const matrices = new Float32Array(kept.length * 16);
      kept.forEach((placement, index) => {
        scale.setAll(placement.scale);
        position.set(placement.x, placement.y, placement.z);
        Matrix.ComposeToRef(
          scale,
          Quaternion.FromEulerAngles(0, placement.rotation, 0),
          position,
          matrix,
        );
        matrix.copyToArray(matrices, index * 16);
      });
      this.library.setChunkCopies(first.kind, first.variant, key, matrices);
    }
  }

  private unload(chunk: Chunk): void {
    this.removeColliders(chunk);
    chunk.terrainMesh.dispose();
    this.library.removeChunk(chunk.key);
    this.chunks.delete(chunk.key);
    this.onChunkUnloaded.notifyObservers({ key: chunk.key, cx: chunk.cx, cz: chunk.cz });
  }

  /** Deterministic scattering of the vegetation of one chunk (MW2). */
  private placeVegetation(cx: number, cz: number): Placement[] {
    const { chunkSize, perChunk, treeMix, denseTrees, scaleJitter, spawnClearRadius } =
      CONFIG.world;
    const random = createRandom(Math.floor(hashPosition(cx, cz, 0, this.terrain.seed) * 2 ** 31));
    const placements: Placement[] = [];
    const originX = cx * chunkSize;
    const originZ = cz * chunkSize;

    const cabins = cabinsNear(originX + chunkSize / 2, originZ + chunkSize / 2, this.terrain.seed);
    const place = (kind: VegetationKind, x: number, z: number, sink = 0): Placement | undefined => {
      // ES1: a small clearing around each cabin; only grass tufts grow close, outside its walls.
      const clear = kind === "groundTuft" ? 3 : CONFIG.cabins.clearRadius;
      if (cabins.some((site) => Math.hypot(x - site.x, z - site.z) < clear)) {
        return undefined;
      }
      // NBB-164: nothing grows or lies in the water, but reeds in its shallows.
      const depth = this.terrain.waterAt(x, z).depth;
      if (depth > (kind === "reeds" ? CONFIG.water.reedsDepth : 0)) {
        return undefined;
      }
      const placement: Placement = {
        kind,
        variant: randomInt(random, [0, this.library.variantCount(kind) - 1]),
        x,
        y: this.terrain.heightAt(x, z) - sink,
        z,
        rotation: random() * Math.PI * 2,
        scale: 1 + randomRange(random, -scaleJitter, scaleJitter),
      };
      placements.push(placement);
      return placement;
    };
    const randomPoint = () => ({
      x: originX + random() * chunkSize,
      z: originZ + random() * chunkSize,
    });
    const nearSpawn = (x: number, z: number) => x * x + z * z < spawnClearRadius * spawnClearRadius;

    // Trees: try the "dense woods" amount and keep each one by the local density. BM8: each biome
    // has its share of trees and its own mix of species (the pine forest, as before).
    const biomeVegetation = CONFIG.biomes.vegetation;
    const treeTries = Math.round(perChunk.trees * denseTrees);
    for (let i = 0; i < treeTries; i++) {
      const { x, z } = randomPoint();
      const weights = this.terrain.biomeWeightsAt(x, z);
      let share = 0;
      for (const biome of BIOMES) {
        share += weights[biome] * biomeVegetation.treeShare[biome];
      }
      if (random() * denseTrees >= this.terrain.treeDensityAt(x, z) * share) {
        continue;
      }
      // The species, from the mix of the biomes here (blended at a border).
      const mix = { pine: 0, oak: 0, deadTree: 0, birch: 0 };
      for (const biome of BIOMES) {
        const own =
          biome === "pineForest" ? { ...treeMix, birch: 0 } : biomeVegetation.treeMix[biome];
        mix.pine += own.pine * weights[biome];
        mix.oak += own.oak * weights[biome];
        mix.deadTree += own.deadTree * weights[biome];
        mix.birch += own.birch * weights[biome];
      }
      const pick = random();
      const kind: VegetationKind =
        pick < mix.pine
          ? "pine"
          : pick < mix.pine + mix.oak
            ? "oak"
            : pick < mix.pine + mix.oak + mix.deadTree
              ? "deadTree"
              : "birch";
      // Sunk a little so trunks never float on slopes.
      place(kind, x, z, 0.15);
    }

    for (let i = 0; i < perChunk.bushes; i++) {
      const { x, z } = randomPoint();
      if (!nearSpawn(x, z)) {
        place("bush", x, z, 0.05);
      }
    }
    for (let i = 0; i < perChunk.rocks; i++) {
      const { x, z } = randomPoint();
      if (!nearSpawn(x, z)) {
        place("rock", x, z);
      }
    }
    // Fallen branches: everywhere sometimes, always on "twigs" ground (MW6).
    for (let i = 0; i < perChunk.branches * 2; i++) {
      const { x, z } = randomPoint();
      if (this.terrain.groundTypeAt(x, z) === "twigs" || random() < 0.4) {
        place("groundBranch", x, z);
      }
    }
    for (let i = 0; i < perChunk.tufts; i++) {
      const { x, z } = randomPoint();
      place("groundTuft", x, z, 0.02);
    }
    // AJ1-A: loose small stones to pick up, besides the rocks. They come last, so the places of
    // everything above stay the same and saved worlds still match (NBB-147 keeps them by place).
    const [smallest, largest] = CONFIG.world.looseStoneSize;
    for (let i = 0; i < perChunk.looseStones; i++) {
      const { x, z } = randomPoint();
      if (nearSpawn(x, z)) {
        continue;
      }
      const stone = place("rock", x, z);
      if (stone) {
        const size = randomRange(random, smallest, largest);
        stone.scale = size / this.library.size("rock", stone.variant);
      }
    }
    this.placeBiomeExtras(random, randomPoint, place, nearSpawn, smallest, largest);
    // NBB-170: the ground cover comes last, so everything above keeps its place (saved worlds).
    this.placeGroundCover(random, randomPoint, place, placements);
    return placements;
  }

  /**
   * NBB-170 (SL1-A, SL2-A): the ground cover of one chunk: lively grass, ferns, fallen leaves,
   * flowers and pebbles by biome (each try kept by how much its biome wants it, mixed at a
   * border), and mushrooms at the foot of some trees.
   */
  private placeGroundCover(
    random: () => number,
    randomPoint: () => { x: number; z: number },
    place: (kind: VegetationKind, x: number, z: number, sink?: number) => Placement | undefined,
    placements: readonly Placement[],
  ): void {
    const cover = CONFIG.world.groundCover;
    const kinds = ["lushGrass", "fern", "leafPile", "flowers", "pebbles"] as const;
    for (const kind of kinds) {
      const counts = cover[kind];
      const most = Math.max(...BIOMES.map((biome) => counts[biome]));
      for (let i = 0; i < most; i++) {
        const { x, z } = randomPoint();
        const weights = this.terrain.biomeWeightsAt(x, z);
        let wanted = 0;
        for (const biome of BIOMES) {
          wanted += weights[biome] * counts[biome];
        }
        if (random() * most < wanted) {
          place(kind, x, z, kind === "pebbles" ? 0.02 : 0.03);
        }
      }
    }
    // Mushrooms by some of the trees, a little way from the trunk.
    const trees = placements.filter((placement) => isTree(placement.kind));
    for (const tree of trees) {
      if (random() >= cover.mushroomChance) {
        continue;
      }
      const angle = random() * Math.PI * 2;
      const away = 0.6 + random() * 0.9;
      place("mushrooms", tree.x + Math.cos(angle) * away, tree.z + Math.sin(angle) * away, 0.01);
    }
  }

  /**
   * BM1, BM8 (NBB-163): what only some biomes have, after everything else (so the pine forest's
   * own placements stay as they were): more bushes in the wood, reeds and mud in the marsh, tall
   * grass and more loose stones in the field, boulders and rock walls on the ridge. Each try is
   * kept by how much of its biome is there.
   */
  private placeBiomeExtras(
    random: () => number,
    randomPoint: () => { x: number; z: number },
    place: (kind: VegetationKind, x: number, z: number, sink?: number) => Placement | undefined,
    nearSpawn: (x: number, z: number) => boolean,
    smallestStone: number,
    largestStone: number,
  ): void {
    const settings = CONFIG.biomes.vegetation;
    const terrain = this.terrain;
    const weight = (x: number, z: number, biome: Biome) => terrain.biomeWeightsAt(x, z)[biome];
    // Reeds and tall grass grow in patches, not evenly.
    const inPatch = (x: number, z: number) =>
      fractalNoise(x / settings.patchSpacing, z / settings.patchSpacing, terrain.seed + 9501, 2) >
      settings.patchAbove;

    for (let i = 0; i < settings.extraBushes; i++) {
      const { x, z } = randomPoint();
      if (!nearSpawn(x, z) && random() < weight(x, z, "broadleaf")) {
        place("bush", x, z, 0.05);
      }
    }
    for (let i = 0; i < settings.reeds; i++) {
      const { x, z } = randomPoint();
      if (random() < weight(x, z, "marsh") && inPatch(x, z) && !terrain.isMarshTrail(x, z)) {
        place("reeds", x, z, 0.05);
      }
    }
    for (let i = 0; i < settings.puddles; i++) {
      const { x, z } = randomPoint();
      if (random() < weight(x, z, "marsh") && !terrain.isMarshTrail(x, z)) {
        place("puddle", x, z);
      }
    }
    for (let i = 0; i < settings.tallGrass; i++) {
      const { x, z } = randomPoint();
      if (random() < weight(x, z, "field") && inPatch(x, z)) {
        place("tallGrass", x, z, 0.05);
      }
    }
    for (let i = 0; i < settings.extraStones; i++) {
      const { x, z } = randomPoint();
      if (nearSpawn(x, z) || random() >= weight(x, z, "field")) {
        continue;
      }
      const stone = place("rock", x, z);
      if (stone) {
        stone.scale =
          randomRange(random, smallestStone, largestStone) /
          this.library.size("rock", stone.variant);
      }
    }
    for (let i = 0; i < settings.boulders; i++) {
      const { x, z } = randomPoint();
      if (random() < weight(x, z, "ridge")) {
        // Sunk deeper: on the ridge's slopes its lower side must not float.
        place("boulder", x, z, 0.8);
      }
    }
    // Rock walls on the ridge's steep faces, along the slope, a few meters apart.
    const walls: { x: number; z: number }[] = [];
    for (let i = 0; i < settings.cliffs; i++) {
      const { x, z } = randomPoint();
      if (weight(x, z, "ridge") < 0.7) {
        continue;
      }
      const gx = (terrain.heightAt(x + 1, z) - terrain.heightAt(x - 1, z)) / 2;
      const gz = (terrain.heightAt(x, z + 1) - terrain.heightAt(x, z - 1)) / 2;
      const slope = Math.hypot(gx, gz);
      if (slope < settings.cliffSlope) {
        continue;
      }
      if (walls.some((wall) => Math.hypot(wall.x - x, wall.z - z) < settings.cliffSpacing)) {
        continue;
      }
      // Its length runs across the slope (along the contour); it stands on the lower side.
      const along = { x: -gz / slope, z: gx / slope };
      const wall = place("cliff", x, z);
      if (wall) {
        wall.rotation = Math.atan2(-along.z, along.x);
        wall.scale = 1;
        const lower = Math.min(
          terrain.heightAt(x - (gx / slope) * 1.5, z - (gz / slope) * 1.5),
          terrain.heightAt(x, z),
        );
        wall.y = lower - 0.3;
        walls.push({ x, z });
      }
    }
  }

  /** Collisions only for chunks the player can reach (colliderRadius around the player). */
  private updateColliders(position: Vector3): void {
    const { chunkSize, colliderRadius } = CONFIG.world;
    const cx = Math.floor(position.x / chunkSize);
    const cz = Math.floor(position.z / chunkSize);
    for (const chunk of this.chunks.values()) {
      const near =
        Math.abs(chunk.cx - cx) <= colliderRadius && Math.abs(chunk.cz - cz) <= colliderRadius;
      if (near && !chunk.colliders) {
        chunk.colliders = this.buildColliders(chunk);
      } else if (!near && chunk.colliders) {
        this.removeColliders(chunk);
      }
    }
  }

  private buildColliders(chunk: Chunk): ChunkColliders {
    const node = new TransformNode(`chunkPhysics-${chunk.key}`, this.scene);
    const container = new PhysicsShapeContainer(this.scene);
    const shapes: PhysicsShape[] = [container];

    const ground = new PhysicsShapeMesh(chunk.terrainMesh, this.scene);
    container.addChild(ground);
    shapes.push(ground);

    for (const placement of chunk.placements) {
      const { kind, variant, x, y, z, scale } = placement;
      if (placement.removed) {
        continue;
      }
      if (kind === "cliff") {
        // BM4-A: the rock wall blocks as a row of tall capsules along its length.
        for (const circle of cliffCircles(placement, this.library.size(kind, variant))) {
          const post = new PhysicsShapeCapsule(
            new Vector3(circle.x, y, circle.z),
            new Vector3(circle.x, y + circle.height, circle.z),
            circle.radius,
            this.scene,
          );
          container.addChild(post);
          shapes.push(post);
        }
      } else if (isTree(kind)) {
        const radius = this.library.trunkRadius(kind, variant) * scale;
        const trunk = new PhysicsShapeCapsule(
          new Vector3(x, y + radius, z),
          new Vector3(x, y + 2.5, z),
          radius,
          this.scene,
        );
        container.addChild(trunk);
        shapes.push(trunk);
      } else if (kind === "rock" || kind === "boulder") {
        const size = this.library.size(kind, variant) * scale;
        if (size >= CONFIG.world.blockingRockSize) {
          const stone = new PhysicsShapeSphere(
            new Vector3(x, y + size * 0.1, z),
            size * 0.42,
            this.scene,
          );
          container.addChild(stone);
          shapes.push(stone);
        }
      }
    }

    const body = new PhysicsBody(node, PhysicsMotionType.STATIC, false, this.scene);
    body.shape = container;
    return { node, body, shapes };
  }

  private removeColliders(chunk: Chunk): void {
    if (!chunk.colliders) {
      return;
    }
    chunk.colliders.body.dispose();
    for (const shape of chunk.colliders.shapes) {
      shape.dispose();
    }
    chunk.colliders.node.dispose();
    chunk.colliders = undefined;
  }
}

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/**
 * BM4-A: a rock wall seen from above, as a row of circles along its length (its local x axis,
 * turned by the placement's rotation), for walking, arrows and the creature's steering.
 */
function cliffCircles(placement: Placement, width: number): Obstacle[] {
  const length = width * placement.scale;
  const radius = Math.min(1.6, length * 0.16);
  const count = Math.max(2, Math.ceil(length / (radius * 1.6)));
  const along = { x: Math.cos(placement.rotation), z: -Math.sin(placement.rotation) };
  const circles: Obstacle[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1) - 0.5) * (length - radius * 2);
    circles.push({
      x: placement.x + along.x * t,
      z: placement.z + along.z * t,
      radius,
      height: 6,
    });
  }
  return circles;
}

/**
 * Terrain of one chunk: a grid in world coordinates. Normals and texture coordinates come from
 * the world position (not from the chunk), so neighboring chunks join without visible seams.
 */
function buildTerrainMesh(scene: Scene, terrain: Terrain, cx: number, cz: number): Mesh {
  const { chunkSize, terrainCell, groundTints } = CONFIG.world;
  const tile = CONFIG.surfaces.groundTileMeters;
  const cells = Math.round(chunkSize / terrainCell);
  const originX = cx * chunkSize;
  const originZ = cz * chunkSize;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= cells; row++) {
    for (let col = 0; col <= cells; col++) {
      const x = originX + col * terrainCell;
      const z = originZ + row * terrainCell;
      positions.push(x, terrain.heightAt(x, z), z);

      const dx = terrain.heightAt(x - terrainCell, z) - terrain.heightAt(x + terrainCell, z);
      const dz = terrain.heightAt(x, z - terrainCell) - terrain.heightAt(x, z + terrainCell);
      const normal = new Vector3(dx, 2 * terrainCell, dz).normalize();
      normals.push(normal.x, normal.y, normal.z);

      uvs.push(x / tile, z / tile);
      const tint = groundTints[terrain.groundTypeAt(x, z)];
      // BM8: each biome's own ground color, blended at the borders; the marsh's trails lighter.
      const weights = terrain.biomeWeightsAt(x, z);
      let r = 0;
      let g = 0;
      let b = 0;
      for (const biome of BIOMES) {
        const own = CONFIG.biomes.groundTints[biome];
        r += own.r * weights[biome];
        g += own.g * weights[biome];
        b += own.b * weights[biome];
      }
      // NBB-170 (SL1-A): broad patches, lighter and darker, greener and browner, so the floor
      // never reads as one repeated texture.
      const variation = CONFIG.surfaces.groundVariation;
      const [darkest, lightest] = variation.brightness;
      const light =
        darkest +
        (lightest - darkest) *
          fractalNoise(
            x / variation.brightSpacing,
            z / variation.brightSpacing,
            terrain.seed + 9701,
            2,
          );
      const hue =
        (fractalNoise(x / variation.hueSpacing, z / variation.hueSpacing, terrain.seed + 9702, 2) -
          0.5) *
        2 *
        variation.hue;
      colors.push(
        // Greener one way (more green), drier the other (less blue), never redder.
        tint.r * r * light * (1 - Math.max(0, hue) * 0.3),
        tint.g * g * light * (1 + Math.max(0, hue) * 0.6),
        tint.b * b * light * (1 - Math.abs(hue) * 0.4),
        1,
      );
    }
  }
  const stride = cells + 1;
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const a = row * stride + col;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      // Order matters: it decides which side is the "front". This one faces up.
      indices.push(a, b, c, b, d, c);
    }
  }

  const mesh = new Mesh(`terrain-${cx},${cz}`, scene);
  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.uvs = uvs;
  data.colors = colors;
  data.indices = indices;
  data.applyToMesh(mesh, false);
  mesh.freezeWorldMatrix();
  return mesh;
}
