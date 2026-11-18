import {
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeBox,
  PhysicsShapeContainer,
  Quaternion,
  TransformNode,
  Vector3,
  type InstancedMesh,
  type PhysicsShape,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { createRandom, hashPosition, randomInt } from "../core/random";
import { createShotgunModel, type ShotgunModel } from "../models/items/shotgun";
import { createCabinModel, type CabinModel } from "../models/structures/cabin";
import type { Inventory } from "../player/inventory";
import type { Interaction, InteractionSystem } from "../systems/interactions";
import { CABIN_SIZE, cabinsInChunk, type CabinSite } from "./cabinSites";
import type { ChunkInfo, ChunkManager } from "./chunks";
import type { Terrain } from "./terrain";

interface SpawnedCabin {
  site: CabinSite;
  root: TransformNode;
  meshes: InstancedMesh[];
  lid: InstancedMesh;
  shotgun: ShotgunModel | undefined;
  body: PhysicsBody;
  shapes: PhysicsShape[];
}

/** How far the chest lid opens (radians). */
const LID_OPEN = -1.2;

/**
 * The abandoned cabins in the world (NBB-141, ES1, ES5): built when their chunk loads (every
 * cabin is an instance of one model), with walls the player bumps into, a chest that E opens and,
 * in the first cabin, the shotgun on the table. Opened chests stay open (in this session).
 */
export class CabinManager {
  private readonly scene: Scene;
  private readonly terrain: Terrain;
  private readonly interactions: InteractionSystem;
  private readonly inventory: Inventory;
  private readonly seed: number;
  private readonly model: CabinModel;
  private readonly spawned = new Map<string, SpawnedCabin>();
  private readonly opened = new Set<string>();
  private shotgunTaken = false;

  constructor(
    scene: Scene,
    terrain: Terrain,
    chunks: ChunkManager,
    interactions: InteractionSystem,
    inventory: Inventory,
    seed: number,
  ) {
    this.scene = scene;
    this.terrain = terrain;
    this.interactions = interactions;
    this.inventory = inventory;
    this.seed = seed;
    this.model = createCabinModel(scene, seed);
    for (const mesh of [this.model.body, this.model.chest, this.model.lid]) {
      mesh.setEnabled(false);
    }
    chunks.onChunkLoaded.add((chunk) => this.load(chunk));
    chunks.onChunkUnloaded.add((chunk) => this.unload(chunk));
    for (const chunk of chunks.loadedChunks()) {
      this.load(chunk);
    }
    interactions.add(() => this.nearestInteraction());
  }

  /** NBB-147: the chests opened and whether the shotgun was taken. */
  get state(): { opened: string[]; shotgunTaken: boolean } {
    return { opened: [...this.opened], shotgunTaken: this.shotgunTaken };
  }

  /** NBB-147: back to a saved game's chests and shotgun. */
  restore(state: { opened: string[]; shotgunTaken: boolean }): void {
    for (const id of state.opened) {
      this.opened.add(id);
    }
    this.shotgunTaken = state.shotgunTaken;
    for (const cabin of this.spawned.values()) {
      if (this.opened.has(cabin.site.id)) {
        cabin.lid.rotation.x = LID_OPEN;
      }
      if (this.shotgunTaken && cabin.shotgun) {
        cabin.shotgun.root.dispose();
        cabin.shotgun = undefined;
      }
    }
  }

  /** Where the first cabin is (development console). */
  get sites(): CabinSite[] {
    return [...this.spawned.values()].map((cabin) => cabin.site);
  }

  private load(chunk: ChunkInfo): void {
    for (const site of cabinsInChunk(chunk.cx, chunk.cz, this.seed)) {
      if (!this.spawned.has(site.id)) {
        this.spawned.set(site.id, this.build(site));
      }
    }
  }

  private unload(chunk: ChunkInfo): void {
    for (const site of cabinsInChunk(chunk.cx, chunk.cz, this.seed)) {
      const cabin = this.spawned.get(site.id);
      if (!cabin) {
        continue;
      }
      cabin.body.dispose();
      for (const shape of cabin.shapes) {
        shape.dispose();
      }
      cabin.root.dispose();
      this.spawned.delete(site.id);
    }
  }

  private build(site: CabinSite): SpawnedCabin {
    const root = new TransformNode(`cabin-${site.id}`, this.scene);
    // The ground is flat around the cabin (ES1): its floor sits on it.
    root.position.set(site.x, this.terrain.heightAt(site.x, site.z), site.z);
    root.rotation.y = site.rotation;

    const instance = (source: CabinModel["body"], name: string) => {
      const mesh = source.createInstance(`${name}-${site.id}`);
      mesh.parent = root;
      return mesh;
    };
    const body = instance(this.model.body, "cabin");
    const chest = instance(this.model.chest, "chest");
    const lid = instance(this.model.lid, "chestLid");
    lid.position = this.model.lidHinge.clone();
    lid.rotation.x = this.opened.has(site.id) ? LID_OPEN : 0;

    let shotgun: ShotgunModel | undefined;
    if (site.first && !this.shotgunTaken) {
      // Lying on its side on the table, pointing along it.
      shotgun = createShotgunModel(this.scene);
      shotgun.root.parent = root;
      shotgun.root.position = this.model.tableTop.add(new Vector3(0.1, 0.02, 0));
      shotgun.root.rotation.set(0, Math.PI / 2, Math.PI / 2);
    }

    const { shape, shapes } = this.colliders();
    const physics = new PhysicsBody(root, PhysicsMotionType.STATIC, false, this.scene);
    physics.shape = shape;
    return { site, root, meshes: [body, chest, lid], lid, shotgun, body: physics, shapes };
  }

  /** Walls (with the door gap), the floor, the table and the chest, as boxes. */
  private colliders(): { shape: PhysicsShape; shapes: PhysicsShape[] } {
    const { halfWidth, halfDepth, wallHeight, doorHalfWidth, doorHeight } = CABIN_SIZE;
    const container = new PhysicsShapeContainer(this.scene);
    const shapes: PhysicsShape[] = [container];
    const box = (center: Vector3, size: Vector3) => {
      const shape = new PhysicsShapeBox(center, Quaternion.Identity(), size, this.scene);
      container.addChild(shape);
      shapes.push(shape);
    };
    const thickness = 0.3;
    const height = wallHeight;
    // Back, left and right walls.
    box(
      new Vector3(0, height / 2, -halfDepth),
      new Vector3(halfWidth * 2 + 0.5, height, thickness),
    );
    box(
      new Vector3(-halfWidth, height / 2, 0),
      new Vector3(thickness, height, halfDepth * 2 + 0.5),
    );
    box(new Vector3(halfWidth, height / 2, 0), new Vector3(thickness, height, halfDepth * 2 + 0.5));
    // Front wall: both sides of the door and the beam above it.
    const side = halfWidth + 0.25 - doorHalfWidth;
    for (const sign of [-1, 1]) {
      box(
        new Vector3(sign * (doorHalfWidth + side / 2), height / 2, halfDepth),
        new Vector3(side, height, thickness),
      );
    }
    box(
      new Vector3(0, (doorHeight + height) / 2, halfDepth),
      new Vector3(doorHalfWidth * 2, height - doorHeight, thickness),
    );
    // Floor (its top at 0), table and chest.
    box(new Vector3(0, -0.4, 0), new Vector3(halfWidth * 2, 0.8, halfDepth * 2));
    const table = this.model.tableTop;
    box(new Vector3(table.x, table.y / 2, table.z), new Vector3(1.1, table.y, 0.6));
    const chest = this.model.chestCenter;
    box(chest.clone(), new Vector3(0.8, 0.42, 0.46));
    return { shape: container, shapes };
  }

  /** E near a closed chest opens it; E near the table takes the shotgun (ES5). */
  private nearestInteraction(): Interaction | undefined {
    const reach = CONFIG.cabins.interactDistance;
    const player = this.scene.activeCamera?.globalPosition;
    if (!player) {
      return undefined;
    }
    let best: Interaction | undefined;
    for (const cabin of this.spawned.values()) {
      if (Math.hypot(cabin.site.x - player.x, cabin.site.z - player.z) > 6) {
        continue;
      }
      if (!this.opened.has(cabin.site.id)) {
        const distance = flatDistance(this.toWorld(cabin, this.model.chestCenter), player);
        if (distance <= reach && (!best || distance < best.distance)) {
          best = {
            label: "Abrir baú",
            distance,
            sound: "chest",
            act: () => this.openChest(cabin),
          };
        }
      }
      if (cabin.shotgun) {
        const distance = flatDistance(this.toWorld(cabin, this.model.tableTop), player);
        if (distance <= reach && (!best || distance < best.distance)) {
          best =
            this.inventory.spaceFor("shotgun") > 0
              ? {
                  label: "Pegar espingarda",
                  distance,
                  sound: "pickup",
                  act: () => this.takeShotgun(cabin),
                }
              : { label: "Inventário cheio", distance };
        }
      }
    }
    return best;
  }

  private openChest(cabin: SpawnedCabin): void {
    const cartridges = this.chestCartridges(cabin);
    // RF-57: with no room for what it holds, the chest stays closed.
    if (cartridges > 0 && this.inventory.spaceFor("cartridge") < cartridges) {
      this.interactions.say("Inventário cheio");
      return;
    }
    this.opened.add(cabin.site.id);
    cabin.lid.rotation.x = LID_OPEN;
    if (cartridges > 0) {
      this.inventory.add("cartridge", cartridges);
      this.interactions.say(
        `Você encontrou: ${cartridges} ${cartridges === 1 ? "cartucho" : "cartuchos"}`,
      );
    } else {
      this.interactions.say("O baú está vazio");
    }
  }

  /** ES5: what a chest holds; the same chest always holds the same thing. */
  private chestCartridges(cabin: SpawnedCabin): number {
    const settings = CONFIG.cabins;
    let cartridges = 0;
    if (cabin.site.first) {
      cartridges = settings.firstCartridges;
    } else {
      // The same chest always holds the same thing.
      const [cx, cz] = cabin.site.id.split(/[,:]/).map(Number);
      const random = createRandom(
        Math.floor(hashPosition(cx ?? 0, cz ?? 0, 41, this.seed) * 2 ** 31),
      );
      if (random() < settings.chestCartridgeChance) {
        cartridges = randomInt(random, settings.chestCartridges);
      }
    }
    return cartridges;
  }

  private takeShotgun(cabin: SpawnedCabin): void {
    if (this.inventory.add("shotgun", 1) < 1) {
      return;
    }
    cabin.shotgun?.root.dispose();
    cabin.shotgun = undefined;
    this.shotgunTaken = true;
    this.interactions.say("Você encontrou: espingarda");
  }

  private toWorld(cabin: SpawnedCabin, local: Vector3): Vector3 {
    return Vector3.TransformCoordinates(local, cabin.root.computeWorldMatrix(true));
  }
}

function flatDistance(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
