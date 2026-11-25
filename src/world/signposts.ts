import {
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeBox,
  Quaternion,
  Vector3,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { hashPosition } from "../core/random";
import { createSignpostModel } from "../models/structures/signpost";
import type { Player } from "../player/player";
import type { InteractionSystem } from "../systems/interactions";
import { directionName } from "../systems/objectiveTexts";
import { cabinsInChunk } from "./cabinSites";
import type { ChunkInfo, ChunkManager } from "./chunks";
import type { Terrain } from "./terrain";

/** Where a signpost stands and the cabin it points at. */
export interface SignpostSite {
  id: string;
  x: number;
  z: number;
  cabin: { x: number; z: number };
}

interface Standing {
  site: SignpostSite;
  root: TransformNode;
  body: PhysicsBody;
  shape: PhysicsShapeBox;
}

/**
 * NBB-171 (PL1-A to PL4-A): old signposts, rare, at spots drawn from the seed, each pointing at
 * the cabin nearest to it (any cabin). E reads it ("Cabana a uns 300 m a nordeste") and makes
 * that cabin the map's destination, which the compass then shows.
 */
export class SignpostField {
  private readonly scene: Scene;
  private readonly terrain: Terrain;
  private readonly player: Player;
  private readonly cells = new Map<string, SignpostSite | null>();
  private readonly standing = new Map<string, Standing[]>();
  /** PL4-A: reading a sign marks its cabin (set by the game: the map's destination). */
  onRead: (cabin: { x: number; z: number }) => void = () => undefined;

  constructor(
    scene: Scene,
    parts: {
      terrain: Terrain;
      chunks: ChunkManager;
      player: Player;
      interactions: InteractionSystem;
    },
  ) {
    this.scene = scene;
    this.terrain = parts.terrain;
    this.player = parts.player;
    parts.chunks.onChunkLoaded.add((chunk) => this.build(chunk));
    parts.chunks.onChunkUnloaded.add((chunk) => this.remove(chunk.key));
    parts.interactions.add(() => this.nearestInteraction(parts.interactions));
  }

  /** The signpost of square (ix, iz) of `signposts.cell` m, if it has one (from the seed alone). */
  siteInCell(ix: number, iz: number): SignpostSite | undefined {
    const key = `${ix},${iz}`;
    const cached = this.cells.get(key);
    if (cached !== undefined) {
      return cached ?? undefined;
    }
    const site = this.findSite(ix, iz);
    this.cells.set(key, site ?? null);
    return site;
  }

  /** Development: the signposts within `radius` m of (x, z), nearest first. */
  near(x: number, z: number, radius: number): SignpostSite[] {
    const { cell } = CONFIG.signposts;
    const found: SignpostSite[] = [];
    const reach = Math.ceil(radius / cell);
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const site = this.siteInCell(cx + dx, cz + dz);
        if (site && Math.hypot(site.x - x, site.z - z) <= radius) {
          found.push(site);
        }
      }
    }
    return found.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  }

  private findSite(ix: number, iz: number): SignpostSite | undefined {
    const settings = CONFIG.signposts;
    const seed = this.terrain.seed;
    if (hashPosition(ix, iz, 4101, seed) >= settings.chance) {
      return undefined;
    }
    const x = (ix + 0.15 + 0.7 * hashPosition(ix, iz, 4102, seed)) * settings.cell;
    const z = (iz + 0.15 + 0.7 * hashPosition(ix, iz, 4103, seed)) * settings.cell;
    const { spawn } = CONFIG.player;
    if (Math.hypot(x - spawn.x, z - spawn.z) < settings.startClear) {
      return undefined;
    }
    if (this.terrain.waterAt(x, z).depth > 0) {
      return undefined;
    }
    const cabin = this.nearestCabin(x, z);
    if (!cabin) {
      return undefined;
    }
    const distance = Math.hypot(cabin.x - x, cabin.z - z);
    if (distance < settings.minCabinDistance) {
      return undefined;
    }
    return { id: `${ix},${iz}`, x, z, cabin };
  }

  /** PL1-A: the nearest cabin of any kind within `searchRadius` m. */
  private nearestCabin(x: number, z: number): { x: number; z: number } | undefined {
    const { chunkSize } = CONFIG.world;
    const { searchRadius } = CONFIG.signposts;
    const reach = Math.ceil(searchRadius / chunkSize);
    const cx = Math.floor(x / chunkSize);
    const cz = Math.floor(z / chunkSize);
    let best: { x: number; z: number } | undefined;
    let bestDistance: number = searchRadius;
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        for (const site of cabinsInChunk(cx + dx, cz + dz, this.terrain.seed)) {
          const distance = Math.hypot(site.x - x, site.z - z);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = { x: site.x, z: site.z };
          }
        }
      }
    }
    return best;
  }

  private build(chunk: ChunkInfo): void {
    const { chunkSize } = CONFIG.world;
    const { cell } = CONFIG.signposts;
    const minX = chunk.cx * chunkSize;
    const minZ = chunk.cz * chunkSize;
    const standing: Standing[] = [];
    // The squares this chunk overlaps (a chunk may straddle a square's edge).
    for (
      let iz = Math.floor(minZ / cell);
      iz <= Math.floor((minZ + chunkSize - 1e-6) / cell);
      iz++
    ) {
      for (
        let ix = Math.floor(minX / cell);
        ix <= Math.floor((minX + chunkSize - 1e-6) / cell);
        ix++
      ) {
        const site = this.siteInCell(ix, iz);
        const inside =
          site &&
          site.x >= minX &&
          site.x < minX + chunkSize &&
          site.z >= minZ &&
          site.z < minZ + chunkSize;
        if (site && inside) {
          standing.push(this.raise(site, ix, iz));
        }
      }
    }
    if (standing.length > 0) {
      this.standing.set(chunk.key, standing);
    }
  }

  private raise(site: SignpostSite, ix: number, iz: number): Standing {
    const root = createSignpostModel(this.scene, Math.floor(hashPosition(ix, iz, 4104, 1) * 1e6));
    root.position.set(site.x, this.terrain.heightAt(site.x, site.z), site.z);
    // The arrow (the model's +X) points at the cabin.
    root.rotation.y = Math.atan2(-(site.cabin.z - site.z), site.cabin.x - site.x);
    // A thin post the player and the creature cannot walk through.
    const shape = new PhysicsShapeBox(
      new Vector3(0, 1, 0),
      Quaternion.Identity(),
      new Vector3(0.2, 2, 0.2),
      this.scene,
    );
    const body = new PhysicsBody(root, PhysicsMotionType.STATIC, false, this.scene);
    body.shape = shape;
    return { site, root, body, shape };
  }

  private remove(key: string): void {
    for (const { root, body, shape } of this.standing.get(key) ?? []) {
      body.dispose();
      shape.dispose();
      root.dispose();
    }
    this.standing.delete(key);
  }

  /** PL4-A: "[E] Ler a placa" near a standing signpost. */
  private nearestInteraction(interactions: InteractionSystem) {
    const { readDistance, roundTo, text } = CONFIG.signposts;
    const feet = this.player.feet;
    let nearest: { site: SignpostSite; distance: number } | undefined;
    for (const list of this.standing.values()) {
      for (const { site } of list) {
        const distance = Math.hypot(site.x - feet.x, site.z - feet.z);
        if (distance <= readDistance && (!nearest || distance < nearest.distance)) {
          nearest = { site, distance };
        }
      }
    }
    if (!nearest) {
      return undefined;
    }
    const { site } = nearest;
    return {
      label: "Ler a placa",
      distance: nearest.distance,
      act: () => {
        const meters = Math.hypot(site.cabin.x - site.x, site.cabin.z - site.z);
        const rounded = Math.max(roundTo, Math.round(meters / roundTo) * roundTo);
        const direction = directionName(site.x, site.z, site.cabin.x, site.cabin.z);
        interactions.say(`${text} a uns ${rounded} m a ${direction}`);
        this.onRead(site.cabin);
      },
    };
  }
}
