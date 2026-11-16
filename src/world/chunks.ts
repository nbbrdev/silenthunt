import {
  Matrix,
  Mesh,
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
import type { Terrain } from "./terrain";
import type { VegetationKind, VegetationLibrary } from "./vegetation";

/** One thing placed in a chunk. */
interface Placement {
  kind: VegetationKind;
  variant: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
}

/** Something that blocks walking, seen from above: a circle on the ground. */
export interface Obstacle {
  x: number;
  z: number;
  radius: number;
}

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
          if (!placement || placement.kind !== "groundBranch") {
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
          (placement.x - x) ** 2 + (placement.z - z) ** 2 <= radius * radius
        ) {
          found.push({ x: placement.x, z: placement.z });
        }
      }
    }
    return found;
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
          let obstacleRadius: number;
          if (kind === "pine" || kind === "oak" || kind === "deadTree") {
            obstacleRadius = this.library.trunkRadius(kind, variant) * scale;
          } else if (kind === "rock") {
            const size = this.library.size(kind, variant) * scale;
            if (size < blockingRockSize) {
              continue;
            }
            obstacleRadius = size * 0.42;
          } else {
            continue;
          }
          const reachSquared = (radius + obstacleRadius) ** 2;
          if ((placement.x - x) ** 2 + (placement.z - z) ** 2 <= reachSquared) {
            found.push({ x: placement.x, z: placement.z, radius: obstacleRadius });
          }
        }
      }
    }
    return found;
  }

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

    // Group the placements by model variation and hand them to the library as matrices.
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
      const matrices = new Float32Array(group.length * 16);
      group.forEach((placement, index) => {
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

    this.chunks.set(key, { key, cx, cz, terrainMesh, placements });
  }

  private unload(chunk: Chunk): void {
    this.removeColliders(chunk);
    chunk.terrainMesh.dispose();
    this.library.removeChunk(chunk.key);
    this.chunks.delete(chunk.key);
  }

  /** Deterministic scattering of the vegetation of one chunk (MW2). */
  private placeVegetation(cx: number, cz: number): Placement[] {
    const { chunkSize, perChunk, treeMix, denseTrees, scaleJitter, spawnClearRadius } =
      CONFIG.world;
    const random = createRandom(Math.floor(hashPosition(cx, cz, 0, this.terrain.seed) * 2 ** 31));
    const placements: Placement[] = [];
    const originX = cx * chunkSize;
    const originZ = cz * chunkSize;

    const place = (kind: VegetationKind, x: number, z: number, sink = 0) => {
      placements.push({
        kind,
        variant: randomInt(random, [0, this.library.variantCount(kind) - 1]),
        x,
        y: this.terrain.heightAt(x, z) - sink,
        z,
        rotation: random() * Math.PI * 2,
        scale: 1 + randomRange(random, -scaleJitter, scaleJitter),
      });
    };
    const randomPoint = () => ({
      x: originX + random() * chunkSize,
      z: originZ + random() * chunkSize,
    });
    const nearSpawn = (x: number, z: number) => x * x + z * z < spawnClearRadius * spawnClearRadius;

    // Trees: try the "dense woods" amount and keep each one by the local density.
    const treeTries = Math.round(perChunk.trees * denseTrees);
    for (let i = 0; i < treeTries; i++) {
      const { x, z } = randomPoint();
      if (random() * denseTrees >= this.terrain.treeDensityAt(x, z)) {
        continue;
      }
      const pick = random();
      const kind: VegetationKind =
        pick < treeMix.pine ? "pine" : pick < treeMix.pine + treeMix.oak ? "oak" : "deadTree";
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
    return placements;
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
      if (kind === "pine" || kind === "oak" || kind === "deadTree") {
        const radius = this.library.trunkRadius(kind, variant) * scale;
        const trunk = new PhysicsShapeCapsule(
          new Vector3(x, y + radius, z),
          new Vector3(x, y + 2.5, z),
          radius,
          this.scene,
        );
        container.addChild(trunk);
        shapes.push(trunk);
      } else if (kind === "rock") {
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
      colors.push(tint.r, tint.g, tint.b, 1);
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
