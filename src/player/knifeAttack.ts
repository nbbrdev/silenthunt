import { Vector3, type Scene } from "@babylonjs/core";
import type { CreatureBrainBehavior } from "../ai/creatureBrain";
import type { PreyBrainBehavior } from "../ai/preyBrain";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import type { NoiseSystem } from "../systems/noise";
import type { SoundEffects } from "../systems/soundEffects";
import type { PlayerHands } from "./hands";
import type { Player } from "./player";

/** What the knife can hit. */
export interface KnifeTargets {
  prey: () => PreyBrainBehavior[];
  creature: CreatureBrainBehavior;
}

/**
 * The knife (NBB-139, M8-A, RF-32, MA4). Left click thrusts it; at the thrust's farthest point it
 * hits the nearest thing within 1.5 m, inside a 30° cone at the center of the screen: a calm prey
 * dies at once, an alert one runs, the creature backs off. The thrust makes 3 m of noise (RF-10),
 * after the hit, so a careful approach still gets the silent kill.
 */
export class KnifeAttack {
  private readonly player: Player;
  private readonly hands: PlayerHands;
  private readonly noise: NoiseSystem;
  private readonly targets: KnifeTargets;
  /** AR1: only while the knife is in hand. */
  enabled = true;
  /** NBB-149 (FE6): the thrust and the hit are heard. */
  sounds: SoundEffects | undefined;
  private cooldown = 0;
  /** Seconds until the thrust reaches its farthest point (negative: no thrust going on). */
  private hitIn = -1;

  constructor(
    scene: Scene,
    input: Input,
    player: Player,
    hands: PlayerHands,
    noise: NoiseSystem,
    targets: KnifeTargets,
  ) {
    this.player = player;
    this.hands = hands;
    this.noise = noise;
    this.targets = targets;
    scene.onBeforeRenderObservable.add(() => {
      const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
      this.cooldown -= seconds;
      if (
        this.enabled &&
        input.wasPressed("Mouse0") &&
        this.player.controlsEnabled &&
        this.cooldown <= 0
      ) {
        this.attack();
      }
      if (this.hitIn >= 0) {
        this.hitIn -= seconds;
        if (this.hitIn < 0) {
          this.resolveHit();
        }
      }
    });
  }

  /** Starts a thrust (also usable from the development console). */
  attack(): void {
    const { cooldownSeconds, hitAtSeconds } = CONFIG.knife;
    this.cooldown = cooldownSeconds;
    this.hitIn = hitAtSeconds;
    this.hands.stab();
    this.sounds?.play("knifeSwing");
  }

  private resolveHit(): void {
    const { reach, coneDegrees } = CONFIG.knife;
    const camera = this.player.camera;
    const forward = camera.getDirection(Vector3.Forward());
    const facing = Math.atan2(forward.x, forward.z);
    const here = this.player.position;

    /** Is a body of `radius` at (x, z) within reach and inside the cone? Returns its distance. */
    const reachOf = (x: number, z: number, radius: number): number | undefined => {
      const distance = Math.hypot(x - here.x, z - here.z);
      if (distance > reach + radius) {
        return undefined;
      }
      let angle = Math.atan2(x - here.x, z - here.z) - facing;
      angle = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
      // Up close, a body fills more than the cone: count it if any part of it is inside.
      const tolerance = Math.max((coneDegrees / 2) * (Math.PI / 180), Math.atan2(radius, distance));
      return angle <= tolerance ? distance : undefined;
    };

    let nearestPrey: PreyBrainBehavior | undefined;
    let nearestDistance = Infinity;
    for (const animal of this.targets.prey()) {
      const position = animal.attachedNode?.position;
      if (!position || !animal.isActive || animal.state === "dead") {
        continue;
      }
      const distance = reachOf(position.x, position.z, CONFIG.prey.bodyRadius[animal.kind]);
      if (distance !== undefined && distance < nearestDistance) {
        nearestPrey = animal;
        nearestDistance = distance;
      }
    }

    const creature = this.targets.creature.attachedNode?.position;
    const creatureDistance = creature
      ? reachOf(creature.x, creature.z, CONFIG.creature.bodyRadius)
      : undefined;

    if (creatureDistance !== undefined && creatureDistance < nearestDistance && creature) {
      // RF-32: no damage, but it backs off.
      this.targets.creature.repel();
      this.sounds?.play("knifeHit", creature);
    } else if (nearestPrey) {
      const position = nearestPrey.attachedNode?.position;
      this.sounds?.play("knifeHit", position);
      // RF-32 / M8-A: the silent kill only works on prey that has not noticed the player.
      if (nearestPrey.state === "graze") {
        nearestPrey.kill();
      } else if (nearestPrey.state === "alert") {
        nearestPrey.flee("player");
      }
    }
    this.noise.emit(this.player.feet, CONFIG.noise.radius.knife, "knife");
  }
}
