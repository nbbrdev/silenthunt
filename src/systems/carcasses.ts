import { TransformNode, type InstancedMesh, type Scene } from "@babylonjs/core";
import type { HuntKind, Huntable } from "../ai/huntable";
import { CONFIG } from "../config";
import { createRemainsModel, type RemainsModel } from "../models/animals/remains";
import type { Equipment } from "../player/equipment";
import type { Inventory, Stack } from "../player/inventory";
import type { ItemId } from "../player/items";

/** The names in the "Você conseguiu" message: singular and plural. */
const NAMES: Partial<Record<ItemId, [string, string]>> = {
  rawMeat: ["carne", "carnes"],
  fat: ["gordura", "gorduras"],
  leather: ["couro", "couros"],
  deerSkull: ["crânio de cervo", "crânios de cervo"],
};
import type { ChunkManager } from "../world/chunks";
import type { Interaction, InteractionSystem } from "./interactions";

interface Remains {
  node: TransformNode;
  meshes: InstancedMesh[];
}

/**
 * Carcasses (NBB-142, RF-35): a dead animal can be cleaned by holding E with the knife in hand
 * (CA1-B, CA2-A). The rabbit gives 1 raw meat; the deer 4 and 1 leather (RF-30, CA4-A). The
 * body is replaced by what is left of it, pelt and bones on the ground (CA3-B), which stays until
 * its chunk unloads.
 */
export class CarcassSystem {
  private readonly scene: Scene;
  private readonly prey: () => Huntable[];
  private readonly equipment: Equipment;
  private readonly inventory: Inventory;
  private readonly interactions: InteractionSystem;
  private readonly templates: Record<HuntKind, RemainsModel>;
  private readonly cleaned = new Set<string>();
  private readonly remains = new Map<string, Remains>();

  constructor(
    scene: Scene,
    prey: () => Huntable[],
    chunks: ChunkManager,
    equipment: Equipment,
    inventory: Inventory,
    interactions: InteractionSystem,
    seed: number,
  ) {
    this.scene = scene;
    this.prey = prey;
    this.equipment = equipment;
    this.inventory = inventory;
    this.interactions = interactions;
    this.templates = {
      deer: createRemainsModel(scene, "deer", seed),
      rabbit: createRemainsModel(scene, "rabbit", seed),
      fox: createRemainsModel(scene, "fox", seed),
      wolf: createRemainsModel(scene, "wolf", seed),
      boar: createRemainsModel(scene, "boar", seed),
      bear: createRemainsModel(scene, "bear", seed),
    };
    for (const template of Object.values(this.templates)) {
      template.hide.setEnabled(false);
      template.bones.setEnabled(false);
    }
    chunks.onChunkUnloaded.add((chunk) => this.forgetChunk(chunk.key));
    interactions.add(() => this.nearestCarcass());
  }

  /** The animals cleaned so far (development). */
  get cleanedCount(): number {
    return this.cleaned.size;
  }

  private nearestCarcass(): Interaction | undefined {
    const eye = this.scene.activeCamera?.globalPosition;
    if (!eye) {
      return undefined;
    }
    const settings = CONFIG.carcass;
    let best: { animal: Huntable; distance: number } | undefined;
    for (const animal of this.prey()) {
      const body = animal.attachedNode?.position;
      if (!body || !animal.isDead || !animal.isActive || this.cleaned.has(animal.id)) {
        continue;
      }
      const distance = Math.hypot(body.x - eye.x, body.z - eye.z);
      if (distance <= settings.reach[animal.kind] && (!best || distance < best.distance)) {
        best = { animal, distance };
      }
    }
    if (!best) {
      return undefined;
    }
    const { animal, distance } = best;
    const name = {
      deer: "cervo",
      rabbit: "coelho",
      fox: "raposa",
      wolf: "lobo",
      boar: "javali",
      bear: "urso",
    }[animal.kind];
    // CA2-A: only with the knife in hand.
    if (this.equipment.current !== "knife") {
      return { label: "Precisa da faca", distance };
    }
    // RF-57: only if everything it gives fits.
    if (!this.inventory.canFit(this.yield(animal))) {
      return { label: "Inventário cheio", distance };
    }
    return {
      label: `Limpar ${name}`,
      distance,
      id: animal.id,
      holdSeconds: settings.harvestSeconds[animal.kind],
      // AC1: the knife cutting, while E is held.
      holdingSound: "carcass",
      act: () => this.clean(animal),
    };
  }

  private clean(animal: Huntable): void {
    const body = animal.attachedNode;
    if (!body) {
      return;
    }
    this.cleaned.add(animal.id);
    const found: string[] = [];
    for (const { item, count } of this.yield(animal)) {
      this.inventory.add(item, count);
      const [one, many] = NAMES[item] ?? [item, item];
      found.push(`${count} ${count === 1 ? one : many}`);
    }
    const last = found.pop();
    const text = found.length > 0 ? `${found.join(", ")} e ${last ?? ""}` : (last ?? "");
    this.interactions.say(`Você conseguiu: ${text}`);

    // CA3-B: the body gives way to its remains, lying along it.
    body.setEnabled(false);
    const template = this.templates[animal.kind];
    const node = new TransformNode(`remains-${animal.id}`, this.scene);
    node.position.copyFrom(body.position);
    // The remains lie along X; the animal's body along Z.
    node.rotation.y = body.rotation.y + Math.PI / 2;
    node.scaling.copyFrom(template.root.scaling);
    const meshes = [template.hide, template.bones].map((source) => {
      const mesh = source.createInstance(`${source.name}-${animal.id}`);
      mesh.parent = node;
      return mesh;
    });
    this.remains.set(animal.id, { node, meshes });
  }

  /** RF-30, PG2-A, CA4-A: what an animal gives: meat, fat and, the deer, leather. */
  private yield(animal: Huntable): Stack[] {
    const settings = CONFIG.carcass;
    const items: Stack[] = [
      { item: "rawMeat", count: settings.meat[animal.kind] },
      { item: "fat", count: settings.fat[animal.kind] },
      { item: "leather", count: settings.leather[animal.kind] },
      // OB8-A: the deer leaves its skull too.
      { item: "deerSkull", count: settings.skull[animal.kind] },
    ];
    return items.filter((stack) => stack.count > 0);
  }

  /** The chunk unloaded: its remains go (the animal ids start with the chunk's key). */
  private forgetChunk(chunkKey: string): void {
    for (const [id, remains] of this.remains) {
      if (id.slice(0, id.lastIndexOf(":")) === chunkKey) {
        remains.node.dispose();
        this.remains.delete(id);
      }
    }
  }
}
