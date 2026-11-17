import { TransformNode, type InstancedMesh, type Scene } from "@babylonjs/core";
import type { PreyBrainBehavior, PreyKind } from "../ai/preyBrain";
import { CONFIG } from "../config";
import { createRemainsModel, type RemainsModel } from "../models/animals/remains";
import type { Equipment } from "../player/equipment";
import type { Provisions } from "../player/provisions";
import type { ChunkManager } from "../world/chunks";
import type { InteractionSystem } from "./interactions";

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
  private readonly prey: () => PreyBrainBehavior[];
  private readonly equipment: Equipment;
  private readonly provisions: Provisions;
  private readonly interactions: InteractionSystem;
  private readonly templates: Record<PreyKind, RemainsModel>;
  private readonly cleaned = new Set<string>();
  private readonly remains = new Map<string, Remains>();

  constructor(
    scene: Scene,
    prey: () => PreyBrainBehavior[],
    chunks: ChunkManager,
    equipment: Equipment,
    provisions: Provisions,
    interactions: InteractionSystem,
    seed: number,
  ) {
    this.scene = scene;
    this.prey = prey;
    this.equipment = equipment;
    this.provisions = provisions;
    this.interactions = interactions;
    this.templates = {
      deer: createRemainsModel(scene, "deer", seed),
      rabbit: createRemainsModel(scene, "rabbit", seed),
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

  private nearestCarcass() {
    const eye = this.scene.activeCamera?.globalPosition;
    if (!eye) {
      return undefined;
    }
    const settings = CONFIG.carcass;
    let best: { animal: PreyBrainBehavior; distance: number } | undefined;
    for (const animal of this.prey()) {
      const body = animal.attachedNode?.position;
      if (!body || animal.state !== "dead" || !animal.isActive || this.cleaned.has(animal.id)) {
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
    const name = animal.kind === "deer" ? "cervo" : "coelho";
    // CA2-A: only with the knife in hand.
    if (this.equipment.current !== "knife") {
      return { label: "Precisa da faca", distance };
    }
    return {
      label: `Limpar ${name}`,
      distance,
      id: animal.id,
      holdSeconds: settings.harvestSeconds[animal.kind],
      act: () => this.clean(animal),
    };
  }

  private clean(animal: PreyBrainBehavior): void {
    const body = animal.attachedNode;
    if (!body) {
      return;
    }
    const settings = CONFIG.carcass;
    const meat = settings.meat[animal.kind];
    const leather = settings.leather[animal.kind];
    this.cleaned.add(animal.id);
    this.provisions.add("rawMeat", meat);
    if (leather > 0) {
      this.provisions.add("leather", leather);
    }
    const found = [`${meat} ${meat === 1 ? "carne" : "carnes"}`];
    if (leather > 0) {
      found.push(`${leather} couro`);
    }
    this.interactions.say(`Você conseguiu: ${found.join(" e ")}`);

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
