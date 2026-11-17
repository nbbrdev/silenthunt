import { Quaternion, TransformNode, Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import type { Equipment } from "../player/equipment";
import type { PlayerHands } from "../player/hands";
import type { Inventory } from "../player/inventory";
import type { Player } from "../player/player";
import type { ChunkManager, Choppable } from "../world/chunks";
import type { StumpField } from "../world/stumps";
import type { InteractionSystem } from "./interactions";
import type { NoiseSystem } from "./noise";

/** A tree on its way down (MC1-A). */
interface Falling {
  pivot: TransformNode;
  axis: Vector3;
  seconds: number;
}

/**
 * The axe at work (NBB-144, RF-59, MC1-A, MC2, MC3-A). The left button swings it (one blow every
 * 0.8 s); a blow lands on the tree trunk or big rock in front, within 2 m, and is heard 25 m away.
 * After enough blows a tree tips over away from the player and disappears, leaving a stump, and
 * its wood goes into the inventory; a rock breaks into stones. The axe does nothing to animals or
 * the creature.
 */
export class ChoppingSystem {
  private readonly scene: Scene;
  private readonly player: Player;
  private readonly hands: PlayerHands;
  private readonly chunks: ChunkManager;
  private readonly stumps: StumpField;
  private readonly noise: NoiseSystem;
  private readonly inventory: Inventory;
  private readonly interactions: InteractionSystem;
  /** Blows already taken by each tree or rock ("chunkKey:index"). */
  private readonly blows = new Map<string, number>();
  private readonly falling: Falling[] = [];
  private cooldown = 0;
  private hitIn = -1;

  constructor(
    scene: Scene,
    input: Input,
    player: Player,
    equipment: Equipment,
    hands: PlayerHands,
    world: {
      chunks: ChunkManager;
      stumps: StumpField;
      noise: NoiseSystem;
      inventory: Inventory;
      interactions: InteractionSystem;
    },
  ) {
    this.scene = scene;
    this.player = player;
    this.hands = hands;
    this.chunks = world.chunks;
    this.stumps = world.stumps;
    this.noise = world.noise;
    this.inventory = world.inventory;
    this.interactions = world.interactions;
    scene.onBeforeRenderObservable.add(() => {
      const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
      const swing =
        equipment.current === "axe" && player.controlsEnabled && input.wasPressed("Mouse0");
      if (swing) {
        this.swing();
      }
      this.update(seconds);
    });
  }

  /** Swings the axe, as the left button would (also for development). */
  swing(): void {
    if (this.cooldown > 0) {
      return;
    }
    const settings = CONFIG.axe;
    this.cooldown = settings.swingSeconds;
    this.hitIn = settings.hitAt;
    this.hands.chop();
  }

  private update(seconds: number): void {
    this.cooldown = Math.max(0, this.cooldown - seconds);
    if (this.hitIn >= 0) {
      this.hitIn -= seconds;
      if (this.hitIn < 0) {
        this.strike();
      }
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const tree = this.falling[i];
      if (!tree) {
        continue;
      }
      tree.seconds += seconds;
      const t = tree.seconds / CONFIG.axe.fallSeconds;
      // It falls slowly at first, then faster, like a real tree; then it is gone.
      const angle = Math.min(1, t) ** 2 * (Math.PI / 2 - 0.05);
      tree.pivot.rotationQuaternion = Quaternion.RotationAxis(tree.axis, angle);
      if (t >= 1.15) {
        tree.pivot.dispose(false, false);
        this.falling.splice(i, 1);
      }
    }
  }

  /** The blow lands: on the nearest tree or big rock in front, if any. */
  private strike(): void {
    const target = this.targetInFront();
    if (!target) {
      return;
    }
    this.noise.emit(this.player.feet, CONFIG.noise.radius.chop, "chop");
    const settings = CONFIG.axe;
    const id = `${target.chunkKey}:${target.index}`;
    const isRock = target.kind === "rock";
    const gives: number = isRock
      ? settings.stones
      : settings.wood[target.kind as keyof typeof settings.wood];
    const item = isRock ? "stone" : "wood";
    const blows = (this.blows.get(id) ?? 0) + 1;
    if (blows < settings.hits[target.kind]) {
      this.blows.set(id, blows);
      return;
    }
    // RF-57: the last blow waits until there is room for what it gives.
    if (this.inventory.spaceFor(item) < gives) {
      this.interactions.say("Inventário cheio");
      return;
    }
    this.blows.delete(id);
    this.chunks.removePlacement(target.chunkKey, target.index);
    this.inventory.add(item, gives);
    this.interactions.say(
      `Você conseguiu: ${gives} ${isRock ? "pedras" : gives === 1 ? "madeira" : "madeiras"}`,
    );
    if (!isRock) {
      this.stumps.add(target);
      this.fell(target);
    }
  }

  /** MC1-A: the tree tips over, away from the player. */
  private fell(target: Choppable): void {
    const pivot = new TransformNode(`falling-${target.chunkKey}:${target.index}`, this.scene);
    pivot.position.set(target.x, target.y, target.z);
    const tree = this.chunks.createLooseModel(target);
    tree.parent = pivot;
    tree.rotation.y = target.rotation;
    tree.scaling.setAll(target.scale);
    const away = new Vector3(target.x - this.player.feet.x, 0, target.z - this.player.feet.z);
    if (away.lengthSquared() < 1e-6) {
      away.set(0, 0, 1);
    }
    away.normalize();
    // Turning about this axis tips the top of the tree toward `away`.
    const axis = Vector3.Cross(Vector3.Up(), away).normalize();
    pivot.rotationQuaternion = Quaternion.Identity();
    this.falling.push({ pivot, axis, seconds: 0 });
  }

  /** The nearest tree or big rock within reach, roughly in front of the view. */
  private targetInFront(): Choppable | undefined {
    const camera = this.player.camera;
    const forward = camera.getDirection(Vector3.Forward());
    const flat = new Vector3(forward.x, 0, forward.z);
    if (flat.lengthSquared() < 1e-6) {
      return undefined;
    }
    flat.normalize();
    const { x, z } = this.player.feet;
    for (const target of this.chunks.choppablesNear(x, z, CONFIG.axe.reach)) {
      const toTarget = new Vector3(target.x - x, 0, target.z - z);
      const distance = toTarget.length();
      if (distance < 1e-3) {
        return target;
      }
      // Within about 50° of where the player looks (wider when the trunk is close and thick).
      const angle = Math.acos(Math.min(1, Vector3.Dot(flat, toTarget.scale(1 / distance))));
      if (angle <= 0.9 + Math.atan2(target.radius, distance)) {
        return target;
      }
    }
    return undefined;
  }
}
