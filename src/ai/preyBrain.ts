import {
  Observable,
  type AnimationGroup,
  type Behavior,
  type Nullable,
  type Observer,
  type Scene,
  type TransformNode,
  type Vector3,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { createRandom, randomInRange } from "../core/random";
import type { Player } from "../player/player";
import type { NoiseEvent, NoiseSystem } from "../systems/noise";
import type { VisibilitySystem } from "../systems/visibility";
import type { ChunkManager } from "../world/chunks";
import type { Terrain } from "../world/terrain";
import { avoidObstacles, normalized, pushOutOfObstacles, type FlatVector } from "./steering";

export type PreyKind = "rabbit" | "deer";

/** RF-31: graze → alert (heard or saw something: stops and looks) → flee → graze. */
export type PreyState = "graze" | "alert" | "flee" | "dead";

/** What the prey perceive and move through. */
export interface PreySenses {
  scene: Scene;
  player: Player;
  visibility: VisibilitySystem;
  noise: NoiseSystem;
  terrain: Terrain;
  chunks: ChunkManager;
  /** Where the creature is (PR5: they run from it too). */
  creaturePosition: () => Vector3;
}

type PreyAnimation = "Pastar" | "Alerta" | "Correr" | "Morrer";

/** What scared it: the player, the creature, or a fixed spot (a noise). */
type Threat = "player" | "creature" | FlatVector;

/**
 * A rabbit's or a deer's brain (NBB-138, RF-30, RF-31, PR1–PR5), a Babylon Behavior (T5a-C)
 * attached to the animal's root node. It grazes in place, hears the NoiseSystem, sees the player
 * through the VisibilitySystem (the deer twice as far), stops to look, and runs away.
 */
export class PreyBrainBehavior implements Behavior<TransformNode> {
  readonly name = "PreyBrain";
  attachedNode: Nullable<TransformNode> = null;
  /** Fired when it dies (the weapons call `kill`, NBB-139 to NBB-141). */
  readonly onKilled = new Observable<PreyBrainBehavior>();
  readonly kind: PreyKind;
  /** Identifies this animal in the world ("chunkKey:index"), so a dead one stays dead. */
  id = "";
  /** The other deer of its group: when one runs, they all run. */
  group: PreyBrainBehavior[] = [];

  private readonly senses: PreySenses;
  private readonly animations: Map<string, AnimationGroup>;
  private readonly random: () => number;
  private renderObserver: Nullable<Observer<Scene>> = null;
  private noiseObserver: Nullable<Observer<NoiseEvent>> = null;

  private currentState: PreyState = "graze";
  private active = false;
  private stateTime = 0;
  private stateLimit = 0;
  private heading = 0;
  private targetHeading = 0;
  private nextTurn = 0;
  private nextHop = 0;
  private hopLeft = 0;
  private threat: Threat = "player";
  /** PR2: how far the player was when first seen in this alert. */
  private seenAt = Infinity;
  private currentAnimation: AnimationGroup | undefined;

  constructor(
    kind: PreyKind,
    senses: PreySenses,
    animations: readonly AnimationGroup[],
    seed: number,
  ) {
    this.kind = kind;
    this.senses = senses;
    this.animations = new Map(animations.map((group) => [group.name, group]));
    for (const group of animations) {
      group.enableBlending = true;
      group.blendingSpeed = 0.1;
    }
    this.random = createRandom(seed);
  }

  get state(): PreyState {
    return this.currentState;
  }

  get isActive(): boolean {
    return this.active;
  }

  init(): void {
    // Nothing to load: everything comes in the constructor.
  }

  attach(target: TransformNode): void {
    this.attachedNode = target;
    target.rotationQuaternion = null;
    const { scene, noise } = this.senses;
    this.renderObserver = scene.onBeforeRenderObservable.add(() => {
      this.update(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
    this.noiseObserver = noise.onNoise.add((event) => this.hear(event));
  }

  detach(): void {
    this.renderObserver?.remove();
    this.noiseObserver?.remove();
    this.renderObserver = null;
    this.noiseObserver = null;
    this.attachedNode = null;
  }

  /** Puts the animal in the world, grazing (PR1). */
  spawn(id: string, x: number, z: number, heading: number): void {
    const body = this.attachedNode;
    if (!body) {
      return;
    }
    this.id = id;
    this.active = true;
    body.setEnabled(true);
    body.position.set(x, this.senses.terrain.heightAt(x, z), z);
    this.heading = heading;
    this.targetHeading = heading;
    body.rotation.set(0, heading, 0);
    this.enter("graze");
  }

  /** Takes it out of the world (its chunk unloaded); it can be spawned again elsewhere. */
  sleep(): void {
    this.active = false;
    this.group = [];
    this.currentAnimation?.stop();
    this.currentAnimation = undefined;
    this.attachedNode?.setEnabled(false);
  }

  /** It dies where it stands (the "Morrer" animation plays once). */
  kill(): void {
    if (this.currentState === "dead" || !this.active) {
      return;
    }
    this.enter("dead");
    this.onKilled.notifyObservers(this);
  }

  /** Runs away from `threat`; the rest of its group runs too. */
  flee(threat: Threat): void {
    if (this.currentState === "dead" || this.currentState === "flee" || !this.active) {
      return;
    }
    this.threat = threat;
    this.enter("flee");
    for (const other of this.group) {
      if (other !== this) {
        other.flee(threat);
      }
    }
  }

  // --- Perception ---

  private distanceToPlayer(): number {
    const player = this.senses.player.position;
    const here = this.position();
    return Math.hypot(player.x - here.x, player.z - here.z);
  }

  /** PR2: the player inside its 270° view, as far as the VisibilitySystem allows (×2 for deer). */
  private seesPlayer(distance: number): boolean {
    const settings = CONFIG.prey;
    if (distance > this.senses.visibility.visibleDistance() * settings.senseFactor[this.kind]) {
      return false;
    }
    if (distance < 1e-3) {
      return true;
    }
    const player = this.senses.player.position;
    const here = this.position();
    const cosine =
      (Math.sin(this.heading) * (player.x - here.x) +
        Math.cos(this.heading) * (player.z - here.z)) /
      distance;
    return cosine >= Math.cos(((settings.viewConeDegrees / 2) * Math.PI) / 180);
  }

  /** PR2: a noise that reaches it (twice as far for deer). */
  private hear(event: NoiseEvent): void {
    if (!this.active || this.currentState === "dead" || this.currentState === "flee") {
      return;
    }
    const here = this.position();
    const reach = event.radius * CONFIG.prey.senseFactor[this.kind];
    if (Math.hypot(event.position.x - here.x, event.position.z - here.z) > reach) {
      return;
    }
    const source = { x: event.position.x, z: event.position.z };
    if (this.currentState === "alert") {
      // A second noise while alert: it runs.
      this.flee(source);
      return;
    }
    this.threat = source;
    this.enter("alert");
  }

  // --- States ---

  private enter(state: PreyState): void {
    const settings = CONFIG.prey;
    this.currentState = state;
    this.stateTime = 0;
    switch (state) {
      case "graze":
        this.nextTurn = randomInRange(this.random, settings.turnEvery);
        this.nextHop = randomInRange(this.random, settings.hopEvery);
        this.hopLeft = 0;
        this.play("Pastar", 1);
        break;
      case "alert":
        this.seenAt = Infinity;
        this.play("Alerta", 1);
        break;
      case "flee":
        this.stateLimit = randomInRange(this.random, settings.fleeSeconds);
        this.play("Correr", 1);
        break;
      case "dead":
        this.play("Morrer", 1, false);
        break;
    }
  }

  private update(seconds: number): void {
    if (!this.active || this.currentState === "dead") {
      return;
    }
    const settings = CONFIG.prey;
    const distance = this.distanceToPlayer();
    // PR1: far away it stands still, without thinking or animating.
    if (distance > settings.activeDistance) {
      if (this.currentAnimation?.isPlaying) {
        this.currentAnimation.pause();
      }
      return;
    }
    if (this.currentAnimation && !this.currentAnimation.isPlaying) {
      this.currentAnimation.play(true);
    }
    this.stateTime += seconds;

    // PR5: the creature close by: run, whatever it was doing.
    const creature = this.senses.creaturePosition();
    const here = this.position();
    if (Math.hypot(creature.x - here.x, creature.z - here.z) < settings.creatureFleeDistance) {
      this.flee("creature");
    }

    switch (this.currentState) {
      case "graze":
        this.updateGraze(seconds, distance);
        break;
      case "alert":
        this.updateAlert(seconds, distance);
        break;
      case "flee":
        this.updateFlee(seconds);
        break;
    }
  }

  /** PR3-A: grazing in place, turning slowly now and then; the rabbit hops a little. */
  private updateGraze(seconds: number, distance: number): void {
    const settings = CONFIG.prey;
    if (this.seesPlayer(distance)) {
      this.threat = "player";
      this.enter("alert");
      return;
    }
    if (this.stateTime >= this.nextTurn) {
      this.targetHeading = this.heading + (this.random() - 0.5) * 2;
      this.nextTurn = this.stateTime + randomInRange(this.random, settings.turnEvery);
    }
    if (this.kind === "rabbit" && this.stateTime >= this.nextHop) {
      this.hopLeft = settings.hopSeconds;
      this.nextHop = this.stateTime + randomInRange(this.random, settings.hopEvery);
      this.play("Correr", 1);
    }
    if (this.hopLeft > 0) {
      this.hopLeft -= seconds;
      const forward = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
      this.move(forward, settings.hopSpeed * seconds);
      if (this.hopLeft <= 0) {
        this.play("Pastar", 1);
      }
    }
    this.turnToward(this.targetHeading, settings.turnRate, seconds);
  }

  /**
   * RF-31 alert: stops and looks at what scared it. PR2: it runs if the player comes closer than
   * half the distance at which it was seen; it calms down after a few quiet seconds.
   */
  private updateAlert(seconds: number, distance: number): void {
    const settings = CONFIG.prey;
    const sees = this.seesPlayer(distance);
    if (sees) {
      this.threat = "player";
      if (!Number.isFinite(this.seenAt)) {
        this.seenAt = distance;
      }
      this.stateTime = 0;
      if (distance < this.seenAt / 2) {
        this.flee("player");
        return;
      }
    }
    const source = this.threatPosition();
    const here = this.position();
    this.turnToward(Math.atan2(source.x - here.x, source.z - here.z), 3, seconds);
    if (!sees && this.stateTime >= settings.alertSeconds) {
      this.enter("graze");
    }
  }

  /** RF-31 flight: away from the threat for 10–15 s, around the trees (PR4). */
  private updateFlee(seconds: number): void {
    if (this.stateTime >= this.stateLimit) {
      this.enter("graze");
      return;
    }
    const source = this.threatPosition();
    const here = this.position();
    const forward = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    const away = normalized(here.x - source.x, here.z - source.z, forward);
    const direction = this.move(away, CONFIG.prey.fleeSpeed[this.kind] * seconds);
    this.turnToward(Math.atan2(direction.x, direction.z), 6, seconds);
  }

  // --- Moving ---

  private threatPosition(): FlatVector {
    if (this.threat === "player") {
      const { x, z } = this.senses.player.position;
      return { x, z };
    }
    if (this.threat === "creature") {
      const { x, z } = this.senses.creaturePosition();
      return { x, z };
    }
    return this.threat;
  }

  /** Moves `step` meters along `wanted`, around trunks and rocks, on the terrain. */
  private move(wanted: FlatVector, step: number): FlatVector {
    const body = this.attachedNode;
    if (!body) {
      return wanted;
    }
    const radius = CONFIG.prey.bodyRadius[this.kind];
    const here = this.position();
    const obstacles = this.senses.chunks.obstaclesNear(here.x, here.z, radius + 3);
    const direction = avoidObstacles(here, wanted, obstacles, radius, 2);
    const moved = pushOutOfObstacles(
      { x: here.x + direction.x * step, z: here.z + direction.z * step },
      obstacles,
      radius,
    );
    body.position.set(moved.x, this.senses.terrain.heightAt(moved.x, moved.z), moved.z);
    return direction;
  }

  private turnToward(angle: number, rate: number, seconds: number): void {
    const body = this.attachedNode;
    if (!body) {
      return;
    }
    let difference = angle - this.heading;
    difference = Math.atan2(Math.sin(difference), Math.cos(difference));
    const maxTurn = rate * seconds;
    this.heading += Math.max(-maxTurn, Math.min(maxTurn, difference));
    body.rotation.y = this.heading;
  }

  private position(): FlatVector {
    const position = this.attachedNode?.position;
    return { x: position?.x ?? 0, z: position?.z ?? 0 };
  }

  /** Switches animation, starting the new one before stopping the old (smooth blending). */
  private play(name: PreyAnimation, speedRatio: number, loop = true): void {
    const group = this.animations.get(name);
    if (!group || group === this.currentAnimation) {
      return;
    }
    const previous = this.currentAnimation;
    this.currentAnimation = group;
    group.start(loop, speedRatio);
    previous?.stop();
  }
}
