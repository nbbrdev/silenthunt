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
import type { DayClock } from "../core/dayClock";
import { frameSeconds } from "../core/gameTime";
import { createRandom, randomInRange } from "../core/random";
import type { PlayerHealth } from "../player/health";
import type { Player } from "../player/player";
import type { NoiseEvent, NoiseSystem } from "../systems/noise";
import type { VisibilitySystem } from "../systems/visibility";
import type { ChunkManager } from "../world/chunks";
import type { Terrain } from "../world/terrain";
import type { Huntable, Weapon } from "./huntable";
import { avoidObstacles, normalized, pushOutOfObstacles, type FlatVector } from "./steering";

export type HostileKind = "wolf" | "boar" | "bear";

/** The sounds a hostile animal makes (played by HostileSounds). */
export type HostileSound =
  "howl" | "growl" | "bite" | "wolfPain" | "grunt" | "squeal" | "roar" | "bearPain";

/**
 * idle: at home (grazing, wandering). warn: the warning (howl, dig, rear and roar). stalk: the
 * pack following the player. attack: chasing to strike. strike: the bite or the swipe. backOff:
 * a wolf drawing back after a bite. growl: a wolf growling before it rushes again. charge / pass:
 * the boar's run and its run past. flee: running away (and gone when far). home: walking back.
 * away: gone (the night, or it ran off). dead.
 */
type HostileState =
  | "idle"
  | "warn"
  | "stalk"
  | "attack"
  | "strike"
  | "backOff"
  | "growl"
  | "charge"
  | "pass"
  | "flee"
  | "home"
  | "away"
  | "dead";

/** What the hostile animals perceive and act on. */
export interface HostileSenses {
  scene: Scene;
  player: Player;
  health: PlayerHealth;
  visibility: VisibilitySystem;
  noise: NoiseSystem;
  terrain: Terrain;
  chunks: ChunkManager;
  clock: DayClock;
  creaturePosition: () => Vector3;
  /** Set by the game once those systems exist. */
  hooks: HostileHooks;
}

export interface HostileHooks {
  /** AH4-A: the lit campfires. */
  fires: () => { x: number; z: number; lit: boolean }[];
  /** AH4-A: a wall or a closed door between two points. */
  wallBetween: (ax: number, az: number, bx: number, bz: number) => boolean;
  /** AH8-A: a sound where the animal is. */
  play: (sound: HostileSound, at: Vector3) => void;
}

/** A wolf pack's shared mind (a boar or a bear is a pack of one). */
export interface Pack {
  members: HostileBrainBehavior[];
  mode: "idle" | "warn" | "stalk" | "attack" | "flee";
  /** Seconds in the current mode, and how long it lasts. */
  time: number;
  limit: number;
  /** Seconds before it may notice the player again (after giving up). */
  rest: number;
  /** Stalking: the side of the player the ring is centered on (radians). */
  bearing: number;
}

/**
 * NBB-167 (AH1-A to AH6-A): a hostile animal's brain, a Babylon Behavior on its root node, like
 * the prey's. The wolf hunts with its pack; the boar charges when the player comes too close; the
 * bear warns and defends its ground. Each warns before attacking, gives up after a while or when
 * the player escapes (deep water, a bush, a lit fire, a shelter), runs from the creature, and is
 * gone at night.
 */
export class HostileBrainBehavior implements Behavior<TransformNode>, Huntable {
  readonly name = "HostileBrain";
  attachedNode: Nullable<TransformNode> = null;
  readonly onKilled = new Observable<HostileBrainBehavior>();
  readonly kind: HostileKind;
  id = "";
  pack: Pack;

  private readonly senses: HostileSenses;
  private readonly animations: Map<string, AnimationGroup>;
  private readonly random: () => number;
  private renderObserver: Nullable<Observer<Scene>> = null;
  private noiseObserver: Nullable<Observer<NoiseEvent>> = null;
  private currentAnimation: AnimationGroup | undefined;

  private currentState: HostileState = "idle";
  private active = false;
  private stateTime = 0;
  private stateLimit = 0;
  private heading = 0;
  private home: FlatVector = { x: 0, z: 0 };
  private target: FlatVector = { x: 0, z: 0 };
  private nextWander = 0;
  /** How much of its life the hits have taken (1: dead). */
  private wounds = 0;
  /** The strike of this state has landed. */
  private struck = false;
  private strikeWait = 0;
  /** Seconds the player has been out of reach (water, walls). */
  private waterSeconds = 0;
  private walledSeconds = 0;
  /** Seconds since the chase began (AH4-A). */
  private chaseTime = 0;
  /** The boar's charge: how far it has run and where it heads. */
  private run = 0;
  private hitDone = false;
  /** The bear: a hit or an ignored warning makes it attack. */
  private angry = false;
  private warnWait = 0;
  /** The bear: how many warnings the player has stayed through. */
  private warnings = 0;
  /** A wolf's flank: its own side of the player while stalking. */
  private flank = 0;
  private fleeFrom: FlatVector = { x: 0, z: 0 };
  /** Running off for good (gone once far), or only for a while. */
  private vanishing = true;

  constructor(
    kind: HostileKind,
    senses: HostileSenses,
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
    this.pack = { members: [this], mode: "idle", time: 0, limit: 0, rest: 0, bearing: 0 };
  }

  get state(): HostileState {
    return this.currentState;
  }

  get isActive(): boolean {
    return this.active && this.currentState !== "away";
  }

  get isDead(): boolean {
    return this.currentState === "dead";
  }

  init(): void {
    // Nothing to load: everything comes in the constructor.
  }

  attach(target: TransformNode): void {
    this.attachedNode = target;
    target.rotationQuaternion = null;
    const { scene, noise } = this.senses;
    this.renderObserver = scene.onBeforeRenderObservable.add(() => {
      this.update(frameSeconds(scene));
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

  /** Puts it in the world, at home. */
  spawn(id: string, x: number, z: number, heading: number): void {
    this.id = id;
    this.active = true;
    this.wounds = 0;
    this.home = { x, z };
    this.flank = (this.random() - 0.5) * 2.4;
    this.place(x, z, heading);
    this.enter("idle");
  }

  /** Taken out of the world (its chunk unloaded). */
  sleep(): void {
    this.active = false;
    this.pack = { members: [this], mode: "idle", time: 0, limit: 0, rest: 0, bearing: 0 };
    this.currentAnimation?.stop();
    this.currentAnimation = undefined;
    this.attachedNode?.setEnabled(false);
  }

  /** AH3-A: each weapon takes its share of its life; the last one kills it. */
  hit(weapon: Weapon): void {
    if (!this.isActive || this.isDead) {
      return;
    }
    this.wounds += 1 / CONFIG.hostile.hitsToKill[this.kind][weapon];
    if (this.wounds >= 0.999) {
      this.kill();
      return;
    }
    this.sound(this.painSound());
    // Hurt, it fights back.
    if (this.kind === "wolf") {
      this.startPack("attack");
    } else if (this.kind === "boar") {
      if (this.currentState !== "charge" && this.currentState !== "pass") {
        this.enter("charge");
      }
    } else {
      this.angry = true;
      if (this.currentState !== "strike") {
        this.enter("attack");
      }
    }
  }

  kill(): void {
    if (this.isDead || !this.active) {
      return;
    }
    this.sound(this.painSound());
    this.enter("dead");
    this.onKilled.notifyObservers(this);
    // Half the pack dead: the rest run away.
    const { members } = this.pack;
    const alive = members.filter((member) => !member.isDead).length;
    if (members.length > 1 && alive <= members.length * CONFIG.hostile.wolf.fleeWhenLeft) {
      this.startPack("flee");
    }
  }

  /** Development: what it is doing. */
  debugState(): object {
    const here = this.position();
    return {
      id: this.id,
      kind: this.kind,
      state: this.currentState,
      pack: this.pack.mode,
      wounds: Math.round(this.wounds * 100) / 100,
      at: [Math.round(here.x), Math.round(here.z)],
      distance: Math.round(this.distanceToPlayer()),
    };
  }

  // --- Perception ---

  private distanceToPlayer(): number {
    const { x, z } = this.senses.player.position;
    const here = this.position();
    return Math.hypot(x - here.x, z - here.z);
  }

  /** The player within `range`, as far as the fog and the light let it see (hidden: no). */
  private seesPlayer(range: number): boolean {
    const distance = this.distanceToPlayer();
    const sight = this.senses.visibility.visibleDistance();
    if (sight <= 0) {
      // AH4-A: hidden in a bush; only a wolf right next to it smells the player.
      return this.kind === "wolf" && distance <= CONFIG.hostile.sniffDistance;
    }
    return distance <= Math.min(range, sight * 1.5);
  }

  /** A noise that reaches it: the boar is startled, the bear and the pack look into it. */
  private hear(event: NoiseEvent): void {
    if (!this.isActive || this.isDead || event.source.startsWith("hostile")) {
      return;
    }
    const here = this.position();
    if (Math.hypot(event.position.x - here.x, event.position.z - here.z) > event.radius) {
      return;
    }
    if (this.currentState !== "idle" || this.pack.rest > 0) {
      return;
    }
    if (this.kind === "boar") {
      this.enter("warn");
    } else if (this.kind === "bear") {
      if (this.distanceToPlayer() < CONFIG.hostile.bear.warnDistance * 1.5) {
        this.enter("warn");
      }
    } else if (this.distanceToPlayer() < CONFIG.hostile.wolf.sightDistance) {
      this.startPack("warn");
    }
  }

  // --- States ---

  private enter(state: HostileState): void {
    this.currentState = state;
    this.stateTime = 0;
    this.struck = false;
    const settings = CONFIG.hostile;
    switch (state) {
      case "idle":
        this.nextWander = randomInRange(this.random, settings.wander.every);
        this.target = { ...this.home };
        this.play(this.kind === "wolf" ? "Andar" : "Pastar", this.kind === "wolf" ? 0 : 1);
        break;
      case "warn":
        if (this.kind === "wolf") {
          this.stateLimit = settings.wolf.howlSeconds;
          const leader = this.pack.members.find((member) => !member.isDead) === this;
          this.play(leader ? "Uivar" : "Rosnar", 1);
          if (leader) {
            this.sound("howl");
          }
        } else if (this.kind === "boar") {
          this.stateLimit = settings.boar.digSeconds;
          this.play("Cavar", 1);
          this.sound("grunt");
        } else {
          this.stateLimit = settings.bear.roarSeconds;
          this.play("Rugir", 1, false);
          this.sound("roar");
        }
        break;
      case "stalk":
        this.play("Andar", 1);
        break;
      case "attack":
        this.chaseTime = 0;
        this.waterSeconds = 0;
        this.walledSeconds = 0;
        this.play("Correr", 1);
        break;
      case "strike":
        this.stateLimit =
          this.kind === "wolf" ? settings.wolf.biteSeconds : settings.bear.swipeSeconds;
        this.play(this.kind === "wolf" ? "Morder" : "Patada", 1, false);
        break;
      case "backOff":
        this.play("Correr", 1);
        break;
      case "growl":
        this.stateLimit = randomInRange(this.random, settings.wolf.growlSeconds);
        this.play("Rosnar", 1);
        if (this.random() < 0.5) {
          this.sound("growl");
        }
        break;
      case "charge":
        this.run = 0;
        this.hitDone = false;
        this.faceTo(this.playerAt(), Math.PI);
        this.play("Investir", 1);
        this.sound("squeal");
        break;
      case "pass":
        this.run = 0;
        break;
      case "flee":
        this.stateLimit = settings.fleeSeconds;
        this.play(this.kind === "boar" ? "Investir" : "Correr", 1);
        break;
      case "home":
        this.play("Andar", 1);
        break;
      case "away":
        this.currentAnimation?.stop();
        this.currentAnimation = undefined;
        this.attachedNode?.setEnabled(false);
        break;
      case "dead":
        this.play("Morrer", 1, false);
        break;
    }
  }

  private update(seconds: number): void {
    if (!this.active || this.currentState === "dead" || seconds <= 0) {
      return;
    }
    const settings = CONFIG.hostile;
    const distance = this.distanceToPlayer();
    const night = this.senses.clock.phase === "night";
    if (this.currentState === "away") {
      // AH5-A: back home by day, while the player is far.
      if (!night && distance > settings.vanishDistance) {
        this.attachedNode?.setEnabled(true);
        this.wounds = 0;
        this.place(this.home.x, this.home.z, this.random() * Math.PI * 2);
        this.enter("idle");
      }
      return;
    }
    // Far away it stands still, without thinking or animating.
    if (distance > settings.activeDistance && this.currentState !== "flee") {
      if (this.currentAnimation?.isPlaying) {
        this.currentAnimation.pause();
      }
      if (night) {
        this.enter("away");
      }
      return;
    }
    if (this.currentAnimation && !this.currentAnimation.isPlaying) {
      this.currentAnimation.play(this.currentState !== "strike" && this.currentState !== "warn");
    }
    this.stateTime += seconds;
    if (this.pack.members[0] === this) {
      this.updatePack(seconds);
    }
    this.warnWait = Math.max(0, this.warnWait - seconds);

    // AH5-A: the creature close, or the night come: it runs off (a howl or a roar as it goes).
    const creature = this.senses.creaturePosition();
    const here = this.position();
    const fromCreature = Math.hypot(creature.x - here.x, creature.z - here.z);
    if (this.currentState !== "flee" && fromCreature < settings.creatureFleeDistance) {
      this.sound(this.kind === "wolf" ? "howl" : this.kind === "bear" ? "roar" : "squeal");
      this.runFrom({ x: creature.x, z: creature.z });
      return;
    }
    if (night && this.currentState !== "flee") {
      this.runFrom(this.playerAt());
      return;
    }

    switch (this.currentState) {
      case "idle":
        this.updateIdle(seconds, distance);
        break;
      case "warn":
        this.updateWarn(distance);
        break;
      case "stalk":
        this.updateStalk(seconds);
        break;
      case "attack":
        this.updateAttack(seconds, distance);
        break;
      case "strike":
        this.updateStrike(distance);
        break;
      case "backOff":
        this.updateBackOff(seconds);
        break;
      case "growl":
        this.faceTo(this.playerAt(), 4 * seconds);
        if (this.stateTime >= this.stateLimit) {
          this.enter("attack");
        }
        break;
      case "charge":
        this.updateCharge(seconds, distance);
        break;
      case "pass":
        this.updatePass(seconds);
        break;
      case "flee":
        this.updateFlee(seconds, distance);
        break;
      case "home":
        this.updateHome(seconds);
        break;
    }
  }

  /** The pack's leader keeps the pack's clock: the stalk ends in an attack; a chase gives up. */
  private updatePack(seconds: number): void {
    const pack = this.pack;
    pack.time += seconds;
    pack.rest = Math.max(0, pack.rest - seconds);
    if (pack.mode === "warn" && pack.time >= CONFIG.hostile.wolf.howlSeconds) {
      this.startPack("stalk");
    } else if (pack.mode === "stalk" && pack.time >= pack.limit) {
      this.startPack("attack");
    }
  }

  /** The whole pack (or this animal alone) moves to a new mode. */
  private startPack(mode: Pack["mode"]): void {
    const pack = this.pack;
    if (pack.mode === mode || (mode !== "flee" && pack.mode === "flee")) {
      return;
    }
    pack.mode = mode;
    pack.time = 0;
    if (mode === "stalk") {
      pack.limit = randomInRange(this.random, CONFIG.hostile.wolf.stalkSeconds);
      // The ring starts on the pack's side of the player.
      const alive = pack.members.filter((member) => !member.isDead);
      const player = this.playerAt();
      let x = 0;
      let z = 0;
      for (const member of alive) {
        const at = member.position();
        x += at.x / Math.max(1, alive.length);
        z += at.z / Math.max(1, alive.length);
      }
      pack.bearing = Math.atan2(x - player.x, z - player.z);
    }
    for (const member of pack.members) {
      if (member.isDead || !member.isActive) {
        continue;
      }
      if (mode === "warn") {
        member.enter("warn");
      } else if (mode === "stalk") {
        member.enter("stalk");
      } else if (mode === "attack") {
        if (member.currentState !== "strike" && member.currentState !== "attack") {
          member.enter("attack");
        }
      } else if (mode === "flee") {
        member.runFrom(member.playerAt());
      } else {
        member.enter("home");
      }
    }
    if (mode === "attack") {
      this.sound("growl");
    }
  }

  /** Grazing and wandering about its home; noticing the player. */
  private updateIdle(seconds: number, distance: number): void {
    const settings = CONFIG.hostile;
    if (this.pack.rest <= 0) {
      if (this.kind === "wolf" && this.seesPlayer(settings.wolf.sightDistance)) {
        this.startPack("warn");
        return;
      }
      if (this.kind === "boar" && this.seesPlayer(settings.boar.warnDistance)) {
        this.enter("warn");
        return;
      }
      if (this.kind === "bear") {
        // The player went away: the warnings start over.
        if (distance > settings.bear.warnDistance * 1.3) {
          this.warnings = 0;
        }
        if (this.angry && distance < settings.bear.attackDistance) {
          this.enter("attack");
          return;
        }
        if (this.warnWait <= 0 && this.seesPlayer(settings.bear.warnDistance)) {
          this.enter("warn");
          return;
        }
      }
    }
    // Now and then a new spot near home.
    if (this.stateTime >= this.nextWander) {
      const angle = this.random() * Math.PI * 2;
      const reach = this.random() * settings.wander.radius;
      this.target = {
        x: this.home.x + Math.sin(angle) * reach,
        z: this.home.z + Math.cos(angle) * reach,
      };
      this.nextWander = this.stateTime + randomInRange(this.random, settings.wander.every);
    }
    const here = this.position();
    const away = Math.hypot(this.target.x - here.x, this.target.z - here.z);
    if (away > 0.5) {
      this.play("Andar", 1);
      this.walkTo(this.target, settings.walkSpeed[this.kind], seconds);
    } else if (this.kind === "wolf") {
      this.play("Andar", 0);
    } else {
      this.play("Pastar", 1);
    }
  }

  /** AH2-A: the warning, facing the player; then what comes next depends on the kind. */
  private updateWarn(distance: number): void {
    const settings = CONFIG.hostile;
    this.faceTo(this.playerAt(), 0.2);
    if (this.stateTime < this.stateLimit) {
      return;
    }
    if (this.kind === "wolf") {
      // The pack moves on together (see updatePack).
      return;
    }
    if (this.kind === "boar") {
      this.enter(distance < settings.boar.calmDistance ? "charge" : "idle");
      return;
    }
    // The bear: still too close, already angry, or a warning already ignored: it comes.
    this.warnWait = settings.bear.warnEvery;
    this.warnings++;
    if (
      this.angry ||
      distance < settings.bear.attackDistance ||
      this.warnings >= settings.bear.warningsBeforeAttack
    ) {
      this.angry = true;
      this.enter("attack");
    } else {
      this.enter("idle");
    }
  }

  /** AH1-A: each wolf keeps to its own side of the player, at a distance, closing the ring. */
  private updateStalk(seconds: number): void {
    const settings = CONFIG.hostile;
    if (this.lostPlayer()) {
      return;
    }
    const player = this.playerAt();
    const here = this.position();
    // Each wolf takes its own side, spread round the pack's side of the player, and the ring
    // turns slowly (they circle).
    const alive = this.pack.members.filter((member) => !member.isDead);
    const slot = alive.indexOf(this) - (alive.length - 1) / 2;
    const around =
      this.pack.bearing +
      slot * settings.wolf.flankSpread +
      this.pack.time * settings.wolf.circleRate;
    const [near, far] = settings.wolf.stalkDistance;
    const ring = near + (far - near) * (0.5 + this.flank / 5);
    const spot = { x: player.x + Math.sin(around) * ring, z: player.z + Math.cos(around) * ring };
    const error = Math.hypot(spot.x - here.x, spot.z - here.z);
    if (error < 0.8) {
      this.play("Rosnar", 1);
      this.faceTo(player, 3 * seconds);
      return;
    }
    const speed = Math.min(settings.runSpeed.wolf * 0.7, 0.8 + error * 0.6);
    this.play(speed > 3 ? "Correr" : "Andar", speed > 3 ? 1 : speed / settings.walkSpeed.wolf);
    this.walkTo(spot, speed, seconds);
  }

  /** Chasing the player to strike; giving up as AH4-A says. */
  private updateAttack(seconds: number, distance: number): void {
    const settings = CONFIG.hostile;
    this.chaseTime += seconds;
    if (this.givesUp(seconds) || this.lostPlayer()) {
      return;
    }
    this.strikeWait = Math.max(0, this.strikeWait - seconds);
    const reach = this.kind === "wolf" ? settings.wolf.biteReach : settings.bear.swipeReach;
    if (distance <= reach && this.strikeWait <= 0 && !this.walledOff()) {
      this.enter("strike");
      return;
    }
    if (distance > reach * 0.8) {
      this.play("Correr", 1);
      this.walkTo(this.playerAt(), settings.runSpeed[this.kind], seconds);
    } else {
      this.faceTo(this.playerAt(), 6 * seconds);
    }
  }

  /** The bite or the swipe: it lands partway through, if the player is still in reach. */
  private updateStrike(distance: number): void {
    const settings = CONFIG.hostile;
    const wolf = this.kind === "wolf";
    const landAt = wolf ? settings.wolf.biteAtSeconds : settings.bear.swipeAtSeconds;
    const reach = (wolf ? settings.wolf.biteReach : settings.bear.swipeReach) + 0.5;
    this.faceTo(this.playerAt(), 0.15);
    if (!this.struck && this.stateTime >= landAt) {
      this.struck = true;
      if (distance <= reach && !this.walledOff()) {
        this.damagePlayer();
        if (wolf) {
          this.sound("bite");
        }
      }
    }
    if (this.stateTime >= this.stateLimit) {
      if (wolf) {
        // Back off to one side, then growl and come again.
        const player = this.playerAt();
        const here = this.position();
        const away = Math.atan2(here.x - player.x, here.z - player.z) + this.flank * 0.5;
        this.target = {
          x: here.x + Math.sin(away) * settings.wolf.backOff,
          z: here.z + Math.cos(away) * settings.wolf.backOff,
        };
        this.enter("backOff");
      } else {
        this.strikeWait = randomInRange(this.random, settings.bear.swipeEvery);
        this.enter("attack");
      }
    }
  }

  private updateBackOff(seconds: number): void {
    const here = this.position();
    const left = Math.hypot(this.target.x - here.x, this.target.z - here.z);
    if (left < 0.5 || this.stateTime > 2.5) {
      this.enter("growl");
      return;
    }
    this.walkTo(this.target, CONFIG.hostile.runSpeed.wolf * 0.6, seconds);
  }

  /** AH1-A: the boar's charge: straight at the player, turning little; one hit, then past. */
  private updateCharge(seconds: number, distance: number): void {
    const settings = CONFIG.hostile;
    const player = this.playerAt();
    const here = this.position();
    this.faceTo(player, settings.boar.chargeTurnRate * seconds);
    const step = settings.runSpeed.boar * seconds;
    const moved = this.stepForward(step);
    this.run += step;
    if (!this.hitDone && distance <= settings.boar.hitReach && !this.walledOff()) {
      this.hitDone = true;
      this.damagePlayer();
      this.sound("grunt");
      this.enter("pass");
      return;
    }
    // Missed, blocked by water or a wall, or ran its whole length: past and away.
    if (!moved || this.run >= settings.boar.chargeDistance || this.inFireLight(here)) {
      this.enter("pass");
    }
  }

  private updatePass(seconds: number): void {
    const settings = CONFIG.hostile;
    const step = settings.runSpeed.boar * seconds;
    const moved = this.stepForward(step);
    this.run += step;
    if (!moved || this.run >= settings.boar.passDistance) {
      this.pack.rest = settings.boar.restSeconds;
      const fleeSpeed = settings.runSpeed.boar * 0.7;
      this.runFrom(this.playerAt(), false, settings.boar.fleeDistance / fleeSpeed);
    }
  }

  /**
   * Running from `fleeFrom`. AH5-A: running off for good (the night, the creature, the pack
   * broken), it is gone once far from the player; the boar's run after a charge ends at home.
   */
  private updateFlee(seconds: number, distance: number): void {
    const settings = CONFIG.hostile;
    const here = this.position();
    const away = normalized(here.x - this.fleeFrom.x, here.z - this.fleeFrom.z, {
      x: Math.sin(this.heading),
      z: Math.cos(this.heading),
    });
    const speed =
      this.kind === "boar" ? settings.runSpeed.boar * 0.7 : settings.runSpeed[this.kind];
    const direction = this.move(away, speed * seconds);
    this.turnTo(Math.atan2(direction.x, direction.z), 6 * seconds);
    if (this.vanishing && distance > settings.vanishDistance) {
      this.enter("away");
    } else if (this.stateTime >= this.stateLimit) {
      this.enter(this.vanishing ? "away" : "home");
    }
  }

  private updateHome(seconds: number): void {
    const here = this.position();
    if (Math.hypot(this.home.x - here.x, this.home.z - here.z) < 1.5 || this.stateTime > 40) {
      if (this.pack.members[0] === this || this.pack.members.length === 1) {
        this.pack.mode = "idle";
      }
      this.enter("idle");
      return;
    }
    this.walkTo(this.home, CONFIG.hostile.walkSpeed[this.kind], seconds);
  }

  // --- Escapes (AH4-A) ---

  /** The chase ends: too long, the player in deep water, by a lit fire, or behind walls. */
  private givesUp(seconds: number): boolean {
    const settings = CONFIG.hostile;
    const player = this.playerAt();
    const deep = this.senses.terrain.waterAt(player.x, player.z).depth > settings.waterDepth;
    this.waterSeconds = deep ? this.waterSeconds + seconds : 0;
    const walled = this.distanceToPlayer() < 4 && this.walledOff();
    this.walledSeconds = walled ? this.walledSeconds + seconds : 0;
    const outOfTerritory =
      this.kind === "bear" &&
      Math.hypot(player.x - this.home.x, player.z - this.home.z) > settings.bear.territory;
    if (
      this.chaseTime >= settings.giveUpSeconds ||
      this.waterSeconds >= settings.waterGiveUpSeconds ||
      this.walledSeconds >= settings.walledGiveUpSeconds ||
      this.inFireLight(player) ||
      outOfTerritory
    ) {
      this.goHome();
      return true;
    }
    return false;
  }

  /** The player hidden (a bush): it looks around a while, then goes home. */
  private lostPlayer(): boolean {
    if (this.senses.visibility.visibleDistance() > 0) {
      return false;
    }
    if (this.kind === "wolf" && this.distanceToPlayer() <= CONFIG.hostile.sniffDistance) {
      return false;
    }
    if (this.stateTime >= CONFIG.hostile.searchSeconds) {
      this.goHome();
      return true;
    }
    this.play("Andar", 0.6);
    return false;
  }

  private goHome(): void {
    this.angry = false;
    this.warnings = 0;
    this.pack.rest = CONFIG.hostile.giveUpSeconds;
    if (this.kind === "wolf") {
      this.startPack("idle");
    } else {
      this.enter("home");
    }
  }

  private inFireLight(point: FlatVector): boolean {
    const keepAway = CONFIG.hostile.fireKeepAway;
    return this.senses.hooks
      .fires()
      .some((fire) => fire.lit && Math.hypot(fire.x - point.x, fire.z - point.z) < keepAway);
  }

  private walledOff(): boolean {
    const player = this.playerAt();
    const here = this.position();
    return this.senses.hooks.wallBetween(here.x, here.z, player.x, player.z);
  }

  /** Runs from `threat`, for good (`vanishing`) or for `seconds` and back home. */
  private runFrom(
    threat: FlatVector,
    vanishing = true,
    seconds: number = CONFIG.hostile.fleeSeconds,
  ): void {
    this.fleeFrom = threat;
    this.vanishing = vanishing;
    this.enter("flee");
    this.stateLimit = seconds;
  }

  // --- Acting ---

  private damagePlayer(): void {
    const { health } = this.senses;
    if (!health.isDead) {
      health.damage(CONFIG.hostile.damage[this.kind]);
    }
  }

  private painSound(): HostileSound {
    return this.kind === "wolf" ? "wolfPain" : this.kind === "boar" ? "squeal" : "bearPain";
  }

  private sound(sound: HostileSound): void {
    const body = this.attachedNode;
    if (body) {
      this.senses.hooks.play(sound, body.position);
    }
  }

  // --- Moving ---

  private playerAt(): FlatVector {
    const { x, z } = this.senses.player.position;
    return { x, z };
  }

  private position(): FlatVector {
    const position = this.attachedNode?.position;
    return { x: position?.x ?? 0, z: position?.z ?? 0 };
  }

  private place(x: number, z: number, heading: number): void {
    const body = this.attachedNode;
    if (!body) {
      return;
    }
    body.setEnabled(true);
    body.position.set(x, this.senses.terrain.heightAt(x, z), z);
    this.heading = heading;
    body.rotation.set(0, heading, 0);
  }

  private walkTo(point: FlatVector, speed: number, seconds: number): void {
    const here = this.position();
    const left = Math.hypot(point.x - here.x, point.z - here.z);
    if (left < 0.05) {
      return;
    }
    const forward = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    const wanted = normalized(point.x - here.x, point.z - here.z, forward);
    const direction = this.move(wanted, Math.min(left, speed * seconds));
    this.turnTo(Math.atan2(direction.x, direction.z), 5 * seconds);
  }

  /** Straight ahead `step` meters (false: deep water ahead, it did not move). */
  private stepForward(step: number): boolean {
    const forward = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    const before = this.position();
    this.move(forward, step);
    const after = this.position();
    return Math.hypot(after.x - before.x, after.z - before.z) > step * 0.3;
  }

  /** Moves `step` meters along `wanted`, around trunks and rocks, never into deep water. */
  private move(wanted: FlatVector, step: number): FlatVector {
    const body = this.attachedNode;
    if (!body) {
      return wanted;
    }
    const { terrain, chunks } = this.senses;
    const radius = CONFIG.hostile.bodyRadius[this.kind];
    const here = this.position();
    const obstacles = chunks.obstaclesNear(here.x, here.z, radius + 3);
    const direction = avoidObstacles(here, wanted, obstacles, radius, 2);
    const ahead = { x: here.x + direction.x * 1.2, z: here.z + direction.z * 1.2 };
    if (terrain.waterAt(ahead.x, ahead.z).depth > CONFIG.hostile.waterDepth) {
      return direction;
    }
    const moved = pushOutOfObstacles(
      { x: here.x + direction.x * step, z: here.z + direction.z * step },
      obstacles,
      radius,
    );
    body.position.set(moved.x, terrain.heightAt(moved.x, moved.z), moved.z);
    return direction;
  }

  private faceTo(point: FlatVector, maxTurn: number): void {
    const here = this.position();
    this.turnTo(Math.atan2(point.x - here.x, point.z - here.z), maxTurn);
  }

  private turnTo(angle: number, maxTurn: number): void {
    const body = this.attachedNode;
    if (!body) {
      return;
    }
    const difference = Math.atan2(Math.sin(angle - this.heading), Math.cos(angle - this.heading));
    this.heading += Math.max(-maxTurn, Math.min(maxTurn, difference));
    body.rotation.y = this.heading;
  }

  /** Switches animation (`speedRatio` 0 holds it still), blending from the last one. */
  private play(name: string, speedRatio: number, loop = true): void {
    const group = this.animations.get(name);
    if (!group) {
      return;
    }
    if (group === this.currentAnimation) {
      group.speedRatio = speedRatio;
      return;
    }
    const previous = this.currentAnimation;
    this.currentAnimation = group;
    group.start(loop, speedRatio);
    previous?.stop();
  }
}
