import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type InstancedMesh,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { Huntable } from "../ai/huntable";
import { CONFIG } from "../config";
import { frameSeconds, isPaused } from "../core/gameTime";
import type { Input } from "../core/input";
import { rock } from "../models/nature/rock";
import type { Inventory } from "../player/inventory";
import type { Player } from "../player/player";
import type { ChunkManager } from "../world/chunks";
import type { Terrain } from "../world/terrain";
import type { InteractionSystem } from "./interactions";
import type { NoiseSystem } from "./noise";
import type { SoundEffects } from "./soundEffects";

/** At most this many dots in the aiming preview (40 m of path). */
const MAX_DOTS = 80;

interface FlyingStone {
  mesh: InstancedMesh;
  position: Vector3;
  velocity: Vector3;
  age: number;
}

interface LyingStone {
  mesh: InstancedMesh;
  position: Vector3;
}

/** What a thrown stone flies through. */
export interface StoneWorld {
  terrain: Terrain;
  chunks: ChunkManager;
  noise: NoiseSystem;
  prey: () => Huntable[];
}

/**
 * Throwing stones (NBB-158; RF-65, PD1-B to PD8). G throws a stone from the inventory toward the
 * center of the view, whatever is in hand. It falls with gravity like an arrow and stops where it
 * first touches the ground, a trunk or a rock; there it makes a loud noise (the creature and the
 * prey hear it) and stays on the ground, to be picked up again with E. A rabbit in its way dies.
 */
export class StoneThrowSystem {
  private readonly player: Player;
  private readonly inventory: Inventory;
  private readonly world: StoneWorld;
  private readonly say: (text: string) => void;
  private readonly source: Mesh;
  private readonly flying: FlyingStone[] = [];
  private readonly lying: LyingStone[] = [];
  private cooldown = 0;
  private count = 0;
  /** TR1-A: G is held, the path is shown. */
  private aiming = false;
  private readonly dotSource: Mesh;
  private readonly dots: InstancedMesh[] = [];
  private readonly ring: Mesh;
  /** PD7-C: the landing is heard where it happens. */
  sounds: SoundEffects | undefined;
  /** Development only: where the last stone stopped and what it hit. */
  lastLanding = "";

  constructor(
    scene: Scene,
    parts: {
      input: Input;
      player: Player;
      inventory: Inventory;
      interactions: InteractionSystem;
      world: StoneWorld;
      say: (text: string) => void;
    },
    seed: number,
  ) {
    this.player = parts.player;
    this.inventory = parts.inventory;
    this.world = parts.world;
    this.say = parts.say;

    // PD8: the loose stone's model, small; every thrown stone is an instance of it.
    this.source = rock.create(scene, seed).root as Mesh;
    const extent = this.source.getBoundingInfo().boundingBox.extendSize;
    const width = Math.max(extent.x, extent.z) * 2;
    this.source.scaling.setAll(CONFIG.stoneThrow.size / width);
    this.source.setEnabled(false);

    // PD4-A: E picks a thrown stone up again.
    parts.interactions.add(() => {
      if (!this.player.controlsEnabled) {
        return undefined;
      }
      const stone = this.nearestLying(CONFIG.inventory.pickupReach);
      if (!stone) {
        return undefined;
      }
      const { x, z } = this.player.feet;
      const distance = Math.hypot(stone.position.x - x, stone.position.z - z);
      if (this.inventory.spaceFor("stone") <= 0) {
        return { label: "Inventário cheio", distance };
      }
      return {
        label: "Pegar pedra",
        distance,
        sound: "pickup",
        act: () => {
          stone.mesh.dispose();
          this.lying.splice(this.lying.indexOf(stone), 1);
          this.inventory.add("stone", 1);
        },
      };
    });

    // TR3-A, TR4-A: the aiming preview, dots along the path and a ring where it stops. They
    // glow on their own and the fog does not hide them.
    const preview = CONFIG.stoneThrow.preview;
    const material = new StandardMaterial("stoneAimMaterial", scene);
    material.disableLighting = true;
    material.emissiveColor = new Color3(preview.color.r, preview.color.g, preview.color.b);
    material.alpha = preview.alpha;
    material.fogEnabled = false;
    this.dotSource = MeshBuilder.CreateSphere(
      "stoneAimDot",
      { diameter: preview.dotSize, segments: 4 },
      scene,
    );
    this.dotSource.material = material;
    this.dotSource.isPickable = false;
    this.dotSource.setEnabled(false);
    this.ring = MeshBuilder.CreateTorus(
      "stoneAimRing",
      { diameter: preview.ringRadius * 2, thickness: 0.03, tessellation: 24 },
      scene,
    );
    this.ring.material = material;
    this.ring.isPickable = false;
    this.ring.setEnabled(false);

    scene.onBeforeRenderObservable.add(() => {
      const input = parts.input;
      const canAct = this.player.handsFree && !isPaused();
      if (input.wasPressed("KeyG") && canAct) {
        this.startAiming();
      }
      if (this.aiming) {
        if (!canAct || input.wasPressed("Mouse2")) {
          // TR2-A: the right button cancels; the stone stays in the inventory.
          this.stopAiming();
        } else if (!input.isDown("KeyG")) {
          // TR1-A: letting go of G throws (a quick tap throws at once).
          this.stopAiming();
          this.throwStone();
        } else {
          this.showPreview();
        }
      }
      this.update(frameSeconds(scene));
    });
  }

  /** TR1-A, TR6: holding G aims, if there is a stone to throw. */
  private startAiming(): void {
    if (this.inventory.count("stone") <= 0) {
      this.say("Sem pedras para arremessar");
      return;
    }
    this.aiming = true;
  }

  private stopAiming(): void {
    this.aiming = false;
    for (const dot of this.dots) {
      dot.setEnabled(false);
    }
    this.ring.setEnabled(false);
  }

  /** Where a stone leaves from and how fast, toward the center of the view (PD8). */
  private launch(): { position: Vector3; velocity: Vector3 } {
    const camera = this.player.camera;
    const direction = camera.getDirection(Vector3.Forward());
    return {
      position: camera.globalPosition.add(direction.scale(0.4)),
      velocity: direction.scale(CONFIG.stoneThrow.speed),
    };
  }

  /**
   * TR3-A, TR6: the path the stone would follow now, with the same steps as a real one, up to
   * the first ground, trunk or rock (animals move, so they are left out).
   */
  private showPreview(): void {
    const settings = CONFIG.stoneThrow;
    const spacing = settings.preview.dotSpacing;
    const gravity = CONFIG.physics.gravity;
    const step = 1 / 60;
    const { position, velocity } = this.launch();
    let from = position;
    let travelled = 0;
    let nextDot = settings.preview.firstDotDistance;
    let used = 0;
    let landing: Vector3 | undefined;
    for (let time = 0; time < settings.maxFlightSeconds && used < MAX_DOTS; time += step) {
      velocity.y += gravity * step;
      const to = from.add(velocity.scale(step));
      landing = this.hitScenery(from, to);
      const end = landing ?? to;
      const length = Vector3.Distance(from, end);
      while (length > 0 && travelled + length >= nextDot && used < MAX_DOTS) {
        const dot = this.dot(used++);
        dot.position.copyFrom(Vector3.Lerp(from, end, (nextDot - travelled) / length));
        nextDot += spacing;
      }
      travelled += length;
      if (landing) {
        break;
      }
      from = to;
    }
    for (let i = used; i < this.dots.length; i++) {
      this.dots[i]?.setEnabled(false);
    }
    this.ring.setEnabled(landing !== undefined);
    if (landing) {
      this.ring.position.set(landing.x, landing.y + 0.03, landing.z);
    }
  }

  /** The preview dot number `index` (made on first use), shown. */
  private dot(index: number): InstancedMesh {
    let dot = this.dots[index];
    if (!dot) {
      dot = this.dotSource.createInstance(`stoneAimDot${index}`);
      dot.isPickable = false;
      this.dots.push(dot);
    }
    dot.setEnabled(true);
    return dot;
  }

  /** Development: how many thrown stones are flying and lying on the ground. */
  get debugCounts(): { flying: number; lying: number } {
    return { flying: this.flying.length, lying: this.lying.length };
  }

  /** PD1-B, PD8: one stone from the inventory, from just in front of the eyes. */
  private throwStone(): void {
    if (this.cooldown > 0) {
      return;
    }
    if (!this.inventory.remove("stone", 1)) {
      this.say("Sem pedras para arremessar");
      return;
    }
    const settings = CONFIG.stoneThrow;
    this.cooldown = settings.cooldownSeconds;
    const { position, velocity } = this.launch();
    const mesh = this.source.createInstance(`thrownStone${this.count++}`);
    mesh.setEnabled(true);
    mesh.position.copyFrom(position);
    this.flying.push({ mesh, position, velocity, age: 0 });
    this.world.noise.emit(this.player.feet, settings.throwNoise, "throw");
    // FX14: the throw swishes.
    this.sounds?.play("throw");
  }

  private update(seconds: number): void {
    if (seconds <= 0) {
      return;
    }
    this.cooldown = Math.max(0, this.cooldown - seconds);
    const gravity = CONFIG.physics.gravity;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const stone = this.flying[i];
      if (!stone) {
        continue;
      }
      stone.age += seconds;
      if (stone.age > CONFIG.stoneThrow.maxFlightSeconds) {
        stone.mesh.dispose();
        this.flying.splice(i, 1);
        continue;
      }
      const from = stone.position.clone();
      stone.velocity.y += gravity * seconds;
      const to = from.add(stone.velocity.scale(seconds));
      if (this.collide(stone, from, to)) {
        this.flying.splice(i, 1);
        continue;
      }
      stone.position.copyFrom(to);
      stone.mesh.position.copyFrom(to);
      stone.mesh.rotation.x += seconds * 8;
    }
  }

  /** Checks the step from `from` to `to`; true if the stone stopped. */
  private collide(stone: FlyingStone, from: Vector3, to: Vector3): boolean {
    // PD5-B: a rabbit in the way dies; the stone drops beside it.
    for (const animal of this.world.prey()) {
      const body = animal.attachedNode?.position;
      if (!body || !animal.isActive || animal.isDead || animal.kind !== "rabbit") {
        continue;
      }
      const center = body.add(new Vector3(0, 0.14, 0));
      if (segmentHitsSphere(from, to, center, 0.16 + CONFIG.stoneThrow.size / 2)) {
        animal.kill();
        this.land(stone, this.onGround(body.x, body.z), "coelho");
        return true;
      }
    }
    const landing = this.hitScenery(from, to);
    if (landing) {
      this.land(stone, landing, "chão, tronco ou rocha");
      return true;
    }
    return false;
  }

  /**
   * Trunks, rocks and the ground, every half meter along the step (it can move far in a frame):
   * where a stone going from `from` to `to` would end up on the ground, if it stops.
   */
  private hitScenery(from: Vector3, to: Vector3): Vector3 | undefined {
    const steps = Math.max(1, Math.ceil(Vector3.Distance(from, to) / 0.5));
    let previous = from;
    for (let i = 1; i <= steps; i++) {
      const point = Vector3.Lerp(from, to, i / steps);
      const ground = this.world.terrain.heightAt(point.x, point.z);
      for (const obstacle of this.world.chunks.obstaclesNear(point.x, point.z, 0.6)) {
        const inside = Math.hypot(point.x - obstacle.x, point.z - obstacle.z) <= obstacle.radius;
        if (inside && point.y < ground + obstacle.height) {
          // PD8: no bounce; it drops at the foot of what it hit, on the side it came from.
          return this.onGround(previous.x, previous.z);
        }
      }
      if (point.y <= ground) {
        return this.onGround(point.x, point.z);
      }
      previous = point;
    }
    return undefined;
  }

  /** PD2-B, PD8: it stops there, is heard, and stays on the ground (at most `maxOnGround`). */
  private land(stone: FlyingStone, position: Vector3, what: string): void {
    const settings = CONFIG.stoneThrow;
    const at = [position.x, position.y, position.z].map((value) => value.toFixed(1)).join(", ");
    this.lastLanding = `${what} em (${at}) após ${stone.age.toFixed(2)} s`;
    this.world.noise.emit(position, settings.landingNoise, "stone");
    this.sounds?.play("stoneLand", position);
    stone.mesh.position.copyFrom(position);
    stone.mesh.rotation.x = 0;
    this.lying.push({ mesh: stone.mesh, position: position.clone() });
    while (this.lying.length > settings.maxOnGround) {
      this.lying.shift()?.mesh.dispose();
    }
  }

  private onGround(x: number, z: number): Vector3 {
    return new Vector3(x, this.world.terrain.heightAt(x, z), z);
  }

  private nearestLying(reach: number): LyingStone | undefined {
    const { x, z } = this.player.feet;
    let nearest: LyingStone | undefined;
    let best = reach;
    for (const stone of this.lying) {
      const distance = Math.hypot(stone.position.x - x, stone.position.z - z);
      if (distance <= best) {
        best = distance;
        nearest = stone;
      }
    }
    return nearest;
  }
}

/** True if the segment from `a` to `b` passes within `radius` of `center`. */
function segmentHitsSphere(a: Vector3, b: Vector3, center: Vector3, radius: number): boolean {
  const ab = b.subtract(a);
  const lengthSquared = ab.lengthSquared();
  const t =
    lengthSquared > 0
      ? Math.min(Math.max(Vector3.Dot(center.subtract(a), ab) / lengthSquared, 0), 1)
      : 0;
  return Vector3.DistanceSquared(a.add(ab.scale(t)), center) <= radius * radius;
}
