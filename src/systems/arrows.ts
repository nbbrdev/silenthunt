import { Quaternion, Vector3, type InstancedMesh, type Mesh, type Scene } from "@babylonjs/core";
import type { CreatureBrainBehavior } from "../ai/creatureBrain";
import type { PreyBrainBehavior } from "../ai/preyBrain";
import { CONFIG } from "../config";
import { createRandom } from "../core/random";
import { createArrowMesh } from "../models/items/bow";
import type { ChunkManager } from "../world/chunks";
import type { Terrain } from "../world/terrain";
import type { NoiseSystem } from "./noise";
import type { SoundEffects } from "./soundEffects";

interface FlyingArrow {
  mesh: InstancedMesh;
  position: Vector3;
  velocity: Vector3;
  age: number;
}

interface StuckArrow {
  mesh: InstancedMesh;
  position: Vector3;
}

/** A sphere an arrow can hit. */
interface Target {
  center: Vector3;
  radius: number;
  hit: () => void;
}

/** What arrows fly through. */
export interface ArrowWorld {
  terrain: Terrain;
  chunks: ChunkManager;
  noise: NoiseSystem;
  prey: () => PreyBrainBehavior[];
  creature: CreatureBrainBehavior;
}

/**
 * Arrows in flight and stuck in the world (NBB-140, RF-33, AR3-A to AR5). Each arrow follows its
 * own ballistic curve (gravity, no physics body) and stops at the ground, a trunk, an animal or
 * the creature. Every arrow is an instance of one mesh, so many of them cost almost nothing.
 */
export class ArrowSystem {
  private readonly world: ArrowWorld;
  private readonly source: Mesh;
  private readonly random: () => number;
  private readonly flying: FlyingArrow[] = [];
  private readonly stuck: StuckArrow[] = [];
  private count = 0;
  /** NBB-149 (FE6, FE7): where an arrow stops is heard. */
  sounds: SoundEffects | undefined;

  constructor(scene: Scene, world: ArrowWorld, seed: number) {
    this.world = world;
    this.random = createRandom(seed);
    this.source = createArrowMesh(scene);
    this.source.setEnabled(false);
    scene.onBeforeRenderObservable.add(() => {
      this.update(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  /** Shoots an arrow from `origin` toward `direction` (unit) at `speed` meters per second. */
  fire(origin: Vector3, direction: Vector3, speed: number): void {
    const mesh = this.source.createInstance(`arrow${this.count++}`);
    mesh.setEnabled(true);
    const arrow = { mesh, position: origin.clone(), velocity: direction.scale(speed), age: 0 };
    this.orient(mesh, arrow.position, arrow.velocity);
    this.flying.push(arrow);
  }

  /** The nearest stuck arrow within `distance` of `position` (horizontally), if any. */
  nearestStuck(position: Vector3, distance: number): StuckArrow | undefined {
    let nearest: StuckArrow | undefined;
    let best = distance;
    for (const arrow of this.stuck) {
      const d = Math.hypot(arrow.position.x - position.x, arrow.position.z - position.z);
      if (d <= best) {
        best = d;
        nearest = arrow;
      }
    }
    return nearest;
  }

  /** AR5: picks up the nearest stuck arrow; true if there was one. */
  pickUp(position: Vector3, distance: number): boolean {
    const arrow = this.nearestStuck(position, distance);
    if (!arrow) {
      return false;
    }
    arrow.mesh.dispose();
    this.stuck.splice(this.stuck.indexOf(arrow), 1);
    return true;
  }

  private update(seconds: number): void {
    const gravity = CONFIG.physics.gravity;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const arrow = this.flying[i];
      if (!arrow) {
        continue;
      }
      arrow.age += seconds;
      if (arrow.age > CONFIG.bow.maxFlightSeconds) {
        arrow.mesh.dispose();
        this.flying.splice(i, 1);
        continue;
      }
      const from = arrow.position.clone();
      arrow.velocity.y += gravity * seconds;
      const to = from.add(arrow.velocity.scale(seconds));
      if (this.collide(arrow, from, to)) {
        this.flying.splice(i, 1);
        continue;
      }
      arrow.position.copyFrom(to);
      this.orient(arrow.mesh, to, arrow.velocity);
    }
  }

  /** Checks the step from `from` to `to`; true if the arrow stopped. */
  private collide(arrow: FlyingArrow, from: Vector3, to: Vector3): boolean {
    // Animals and the creature first: they stand on the ground in front of everything else.
    for (const target of this.targetsNear(from, to)) {
      if (segmentHitsSphere(from, to, target.center, target.radius)) {
        target.hit();
        // AR5: unless it broke, the arrow falls to the ground next to the animal.
        const ground = this.world.terrain.heightAt(target.center.x, target.center.z);
        this.land(arrow, new Vector3(target.center.x, ground + 0.02, target.center.z), true);
        return true;
      }
    }
    // Trunks and the ground, checked every half meter along the step: a fast arrow (or a slow
    // frame) can move several meters at once.
    const steps = Math.max(1, Math.ceil(Vector3.Distance(from, to) / 0.5));
    for (let i = 1; i <= steps; i++) {
      const point = Vector3.Lerp(from, to, i / steps);
      const ground = this.world.terrain.heightAt(point.x, point.z);
      for (const trunk of this.world.chunks.obstaclesNear(point.x, point.z, 0.6)) {
        const inside = Math.hypot(point.x - trunk.x, point.z - trunk.z) <= trunk.radius;
        if (inside && point.y < ground + trunk.height) {
          this.land(arrow, point, false);
          return true;
        }
      }
      // The ground: the tip sinks in a little.
      if (point.y <= ground) {
        this.land(arrow, new Vector3(point.x, ground + 0.05, point.z), false);
        return true;
      }
    }
    return false;
  }

  /** Development only: where the last arrow stopped and what it hit. */
  lastLanding = "";

  /** The arrow stops at `position`: it may break (AR5); a miss makes noise there (AR4). */
  private land(arrow: FlyingArrow, position: Vector3, onAnimal: boolean): void {
    const at = [position.x, position.y, position.z].map((value) => value.toFixed(1)).join(", ");
    this.lastLanding = `${onAnimal ? "animal" : "chão ou tronco"} em (${at}) após ${arrow.age.toFixed(2)} s`;
    if (!onAnimal) {
      this.world.noise.emit(position, CONFIG.bow.impactNoise, "arrow");
    }
    // FE7: the arrow is heard where it stops; on an animal, as a hit.
    this.sounds?.play(onAnimal ? "knifeHit" : "arrowHit", position);
    if (this.random() < CONFIG.bow.breakChance) {
      arrow.mesh.dispose();
      return;
    }
    arrow.mesh.position.copyFrom(position);
    if (onAnimal) {
      // Lying on the ground beside the animal.
      const flat = new Vector3(arrow.velocity.x, 0, arrow.velocity.z);
      this.orient(arrow.mesh, position, flat.lengthSquared() > 0 ? flat : Vector3.Forward());
    } else {
      // Stuck in, tail out: back the arrow up along its flight so the tip is at the impact.
      const back = arrow.velocity.normalizeToNew().scale(CONFIG.bow.arrowLength * 0.75);
      this.orient(arrow.mesh, position.subtract(back), arrow.velocity);
    }
    this.stuck.push({ mesh: arrow.mesh, position: position.clone() });
  }

  /** The bodies an arrow going from `from` to `to` could hit (animals and the creature nearby). */
  private targetsNear(from: Vector3, to: Vector3): Target[] {
    const targets: Target[] = [];
    for (const animal of this.world.prey()) {
      const body = animal.attachedNode?.position;
      if (!body || !animal.isActive || animal.state === "dead") {
        continue;
      }
      if (flatDistanceToSegment(body, from, to) > 3) {
        continue;
      }
      if (animal.kind === "rabbit") {
        targets.push({
          center: body.add(new Vector3(0, 0.14, 0)),
          radius: 0.16,
          hit: () => animal.kill(),
        });
      } else {
        // RF-33: the first arrow wounds a deer, the second kills it. Its long body is two spheres.
        const heading = animal.attachedNode?.rotation.y ?? 0;
        const along = new Vector3(Math.sin(heading), 0, Math.cos(heading)).scale(0.35);
        for (const offset of [along, along.scale(-1)]) {
          targets.push({
            center: body.add(new Vector3(0, 0.9, 0)).add(offset),
            radius: 0.3,
            hit: () => animal.wound(),
          });
        }
      }
    }
    const creature = this.world.creature.attachedNode?.position;
    if (creature && flatDistanceToSegment(creature, from, to) < 4) {
      const scale = CONFIG.creature.scale;
      for (const height of [1, 1.9]) {
        targets.push({
          center: creature.add(new Vector3(0, height * scale, 0)),
          radius: 0.45,
          // RF-32 / AR4: no damage, but it backs off.
          hit: () => this.world.creature.repel(),
        });
      }
    }
    return targets;
  }

  private orient(mesh: InstancedMesh, position: Vector3, direction: Vector3): void {
    mesh.position.copyFrom(position);
    const forward = direction.normalizeToNew();
    const rotation = mesh.rotationQuaternion ?? new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Forward(), forward, rotation);
    mesh.rotationQuaternion = rotation;
  }
}

/** Distance on the ground (ignoring height) from `point` to the segment from `a` to `b`. */
function flatDistanceToSegment(point: Vector3, a: Vector3, b: Vector3): number {
  const abX = b.x - a.x;
  const abZ = b.z - a.z;
  const lengthSquared = abX * abX + abZ * abZ;
  const t =
    lengthSquared > 0
      ? Math.min(Math.max(((point.x - a.x) * abX + (point.z - a.z) * abZ) / lengthSquared, 0), 1)
      : 0;
  return Math.hypot(point.x - (a.x + abX * t), point.z - (a.z + abZ * t));
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
