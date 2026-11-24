import {
  Observable,
  Vector3,
  type AnimationGroup,
  type Behavior,
  type Nullable,
  type Observer,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import type { DayClock } from "../core/dayClock";
import { createRandom, randomInRange } from "../core/random";
import type { Player } from "../player/player";
import type { PlayerTorch } from "../player/torch";
import type { NoiseEvent, NoiseSystem } from "../systems/noise";
import type { VisibilitySystem } from "../systems/visibility";
import { fogVisibility } from "../world/atmosphere";
import type { ChunkManager, Obstacle } from "../world/chunks";
import type { Terrain } from "../world/terrain";
import { avoidObstacles, normalized, pushOutOfObstacles, type FlatVector } from "./steering";

/** RF-21: the creature's states. */
export type CreatureState = "roam" | "stalk" | "investigate" | "attack" | "retreat" | "search";

/** State names as typed in the development console (pt-BR, IA8). */
export const STATE_NAMES: Record<string, CreatureState> = {
  rondar: "roam",
  espreitar: "stalk",
  investigar: "investigate",
  atacar: "attack",
  recuar: "retreat",
  procurar: "search",
};

/** The animations it moves with; their natural speeds are in the config (IA2). */
type GaitAnimation = keyof typeof CONFIG.creature.animationSpeed;
type AnimationName = GaitAnimation | "Atacar";

/** Everything the creature perceives and moves through. */
export interface CreatureSenses {
  scene: Scene;
  player: Player;
  torch: PlayerTorch;
  clock: DayClock;
  terrain: Terrain;
  chunks: ChunkManager;
  noise: NoiseSystem;
  visibility: VisibilitySystem;
}

/** Height of the creature's chest (at scale 1): what the player's eyes aim at to "look at" it. */
const CHEST_HEIGHT = 1.5;
/** Seconds into "Atacar" when the claws pass through the player (frame 15 of 30). */
const STRIKE_HIT_SECONDS = 0.5;
const STRIKE_SECONDS = 1;
/** Close enough to a destination to count as arrived. */
const ARRIVED_DISTANCE = 2;

/**
 * The creature's brain (G12, RF-20 to RF-24, IA1–IA7), a Babylon Behavior (T5a-C) attached to
 * the creature's root node. Every frame it perceives (noise, sight, being looked at), picks a
 * state and walks the body: speed, obstacle avoidance, terrain height, facing and animation.
 */
export class CreatureBrainBehavior implements Behavior<TransformNode> {
  readonly name = "CreatureBrain";
  attachedNode: Nullable<TransformNode> = null;
  /** RF-23: fired when the strike lands, with the damage. Health is NBB-136's job. */
  readonly onPlayerHit = new Observable<number>();
  /** GF2-B: fired now and then while the torch holds it off (its growl). */
  readonly onHeldGrowl = new Observable<void>();
  /** Lit campfires (NBB-146 fills this): it never gets closer than `fireKeepAway` (RF-24). */
  readonly fires: Vector3[] = [];
  /** Fired on every state change (its sounds react to it, NBB-135). */
  readonly onStateChanged = new Observable<CreatureState>();

  private readonly senses: CreatureSenses;
  private readonly animations: Map<string, AnimationGroup>;
  private readonly random: () => number;
  private renderObserver: Nullable<Observer<Scene>> = null;
  private noiseObserver: Nullable<Observer<NoiseEvent>> = null;

  private currentState: CreatureState = "roam";
  /** Seconds since the current state began. */
  private stateTime = 0;
  /** When (in stateTime) the current state ends: next stalk, attack, end of retreat... */
  private stateLimit = 0;
  /** Where it is heading (roaming, investigating). */
  private target: FlatVector = { x: 0, z: 0 };
  private targetAge = 0;
  private heading = 0;
  private currentAnimation: AnimationGroup | undefined;
  private currentGait: { animation: AnimationName; speedRatio: number } = {
    animation: "Andar",
    speedRatio: 0,
  };
  /** IA4-B: how long the player has been staring at it, and the backing off that follows. */
  private stareTime = 0;
  private backOffTime = 0;
  /**
   * GF2-B: held off by a lit torch during the attack; which way it circles (1 or -1) and when
   * it growls next.
   */
  private held = false;
  private circleSide = 1;
  private untilHeldGrowl = 0;
  /** Attack: seconds since the strike began (negative while still running at the player). */
  private strikeTime = -1;
  /** CN5-A: how long a wall has kept it from the player during this attack. */
  private walledSeconds = 0;

  /**
   * NBB-145 (CN5-A): true if a wall or a closed door stands between two points, seen from above
   * (set by the player's buildings). Its strike does not go through.
   */
  wallBetween: (ax: number, az: number, bx: number, bz: number) => boolean = () => false;
  /** NBB-154 (MI1-A): true while the player hides in a bush (set by the HidingSystem). */
  isPlayerHidden: () => boolean = () => false;
  /**
   * NBB-156 (OB4-A, OB11-B): the last night, after the rescue was called: it attacks without
   * stalking, the torch does not hold it, it does not give up and it searches the bushes longer.
   */
  lastNight = false;
  /** OB10-A: banished by the ritual; once it has run off, it is gone from this world. */
  private banished = false;
  private gone = false;
  /** MI4-A: where it lost the hidden player; it searches around this spot. */
  private searchCenter: FlatVector = { x: 0, z: 0 };
  private hitLanded = false;
  private lookedAt = false;
  /** AP1-A: how fast the player is coming toward it (meters per second, smoothed). */
  private closingSpeed = 0;
  private lastPlayerPosition: FlatVector | undefined;

  constructor(senses: CreatureSenses, animations: readonly AnimationGroup[], seed: number) {
    this.senses = senses;
    this.animations = new Map(animations.map((group) => [group.name, group]));
    for (const group of animations) {
      // Smooth changes between animations instead of snapping to the new pose.
      group.enableBlending = true;
      group.blendingSpeed = 0.08;
    }
    this.random = createRandom(seed);
  }

  get state(): CreatureState {
    return this.currentState;
  }

  /** The animation it moves with and how fast it plays (0 = standing still): drives the steps. */
  get gait(): { animation: AnimationName; speedRatio: number } {
    return this.currentGait;
  }

  /** Horizontal distance to the player (meters). */
  get playerDistance(): number {
    return this.distanceToPlayer();
  }

  init(): void {
    // Nothing to load: everything comes in the constructor.
  }

  attach(target: TransformNode): void {
    this.attachedNode = target;
    target.rotationQuaternion = null;
    this.placeOutOfSight(randomInRange(this.random, CONFIG.creature.roamDistance.day));
    this.enter("roam");
    const { scene, noise } = this.senses;
    this.renderObserver = scene.onBeforeRenderObservable.add(() => {
      // A long pause (another tab) must not teleport it: at most 0.1 s per frame.
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

  /** RF-32: hit by the knife: no damage, but it backs off into the fog. */
  repel(): void {
    if (this.currentState !== "retreat") {
      this.enter("retreat");
    }
  }

  /** VD5: sends it far away, out of sight, to roam again (when the player dies or respawns). */
  sendAway(): void {
    if (this.banished) {
      return;
    }
    this.placeOutOfSight(randomInRange(this.random, this.roamRange()));
    this.enter("roam");
  }

  /** Development only (IA8): forces a state, e.g. to watch the attack without waiting. */
  forceState(state: CreatureState): void {
    const { x, z } = this.senses.player.position;
    if (state === "investigate") {
      this.target = { x, z };
    }
    if (state === "search") {
      this.searchCenter = { x, z };
    }
    this.enter(state);
  }

  /**
   * MI3-A, MI10 (NBB-154): the player just hid in a bush. While stalking or chasing, unless it
   * was close enough to see them go in (as far as it would see them standing, without a torch),
   * it loses them and searches around where they were.
   */
  playerHid(): void {
    if (this.banished) {
      return;
    }
    const stalking = this.currentState === "stalk";
    const chasing = this.currentState === "attack" && this.strikeTime < 0;
    if (!stalking && !chasing) {
      return;
    }
    if (this.distanceToPlayer() <= this.senses.visibility.standingDistance()) {
      return;
    }
    const { x, z } = this.senses.player.position;
    this.searchCenter = { x, z };
    this.enter("search");
  }

  /** MI5-B: hidden too long in the same bush at night: it sniffs them out and comes for them. */
  sniffOut(): void {
    if (this.currentState !== "attack" && !this.banished) {
      this.enter("attack");
    }
  }

  /** OB10-A: true once the ritual banished it. */
  get isBanished(): boolean {
    return this.banished;
  }

  /**
   * OB10-A, OB12: the ritual banishes it: it runs off into the fog for `banishFleeSeconds` and is
   * gone for good (`now`: gone at once, as when a saved game loads).
   */
  banish(now = false): void {
    this.banished = true;
    if (now) {
      this.vanish();
      return;
    }
    this.enter("retreat");
    this.stateLimit = CONFIG.objective.banishFleeSeconds;
  }

  private vanish(): void {
    this.gone = true;
    this.currentGait = { animation: "Andar", speedRatio: 0 };
    this.currentAnimation?.stop();
    this.attachedNode?.setEnabled(false);
  }

  /**
   * Development only: runs the brain for `seconds` of game time in 1/30 s steps without drawing
   * (the headless browser used for automated checks draws ~1 frame per second).
   */
  simulate(seconds: number): void {
    for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 30) {
      this.update(1 / 30);
    }
  }

  /**
   * NBB-153: true while it chases the player, before the strike (PS1-A); held off by the torch
   * counts too (GF8: the heart keeps beating).
   */
  get isChasing(): boolean {
    return this.currentState === "attack" && this.strikeTime < 0;
  }

  /** GF2-B: held off by the player's torch right now. */
  get isHeld(): boolean {
    return this.currentState === "attack" && this.held;
  }

  /** Snapshot for the development console (IA8). */
  debugState(): {
    state: CreatureState;
    seconds: number;
    limit: number;
    distance: number;
    lookedAt: boolean;
    held: boolean;
    position: number[];
  } {
    const round = (value: number) => Math.round(value * 10) / 10;
    const position = this.attachedNode?.position ?? Vector3.Zero();
    return {
      state: this.currentState,
      seconds: round(this.stateTime),
      limit: round(this.stateLimit),
      distance: round(this.distanceToPlayer()),
      lookedAt: this.lookedAt,
      held: this.isHeld,
      position: [position.x, position.y, position.z].map(round),
    };
  }

  // --- Perception ---

  private get isNight(): boolean {
    return this.senses.clock.phase === "night";
  }

  /** How far the player sees through the fog right now (the same formula as the Atmosphere). */
  private fogVisibility(): number {
    return fogVisibility(this.senses.clock.daylight);
  }

  /** CN5-A: a wall or a closed door between it and the player. */
  private isWalledOff(): boolean {
    const body = this.attachedNode?.position;
    const player = this.senses.player.position;
    return body !== undefined && this.wallBetween(body.x, body.z, player.x, player.z);
  }

  private distanceToPlayer(): number {
    const body = this.attachedNode?.position;
    const player = this.senses.player.position;
    return body ? Math.hypot(player.x - body.x, player.z - body.z) : Infinity;
  }

  /** IA4-B: inside the cone at the center of the player's screen, and not hidden by the fog. */
  private isLookedAt(): boolean {
    const body = this.attachedNode?.position;
    if (!body) {
      return false;
    }
    const camera = this.senses.player.camera;
    const chest = CHEST_HEIGHT * CONFIG.creature.scale;
    const toChest = body.add(new Vector3(0, chest, 0)).subtract(camera.globalPosition);
    const distance = toChest.length();
    if (distance > this.fogVisibility() || distance < 1e-3) {
      return false;
    }
    const forward = camera.getDirection(Vector3.Forward());
    const cosine = Vector3.Dot(forward, toChest.scale(1 / distance));
    return cosine >= Math.cos(degrees(CONFIG.creature.lookConeDegrees / 2));
  }

  /** IA5: the player is inside its view cone and close enough to be seen (RF-13). */
  private canSeePlayer(): boolean {
    const body = this.attachedNode?.position;
    if (!body) {
      return false;
    }
    const player = this.senses.player.position;
    const toPlayerX = player.x - body.x;
    const toPlayerZ = player.z - body.z;
    const distance = Math.hypot(toPlayerX, toPlayerZ);
    // MI4-A: hidden in a bush, it only finds the player by passing right next to them.
    if (this.isPlayerHidden()) {
      return distance <= CONFIG.hiding.findDistance;
    }
    if (distance > this.senses.visibility.visibleDistance()) {
      return false;
    }
    if (distance < 1e-3) {
      return true;
    }
    const cosine =
      (Math.sin(this.heading) * toPlayerX + Math.cos(this.heading) * toPlayerZ) / distance;
    return cosine >= Math.cos(degrees(CONFIG.creature.viewConeDegrees / 2));
  }

  /** IA5: a noise that reaches it makes it investigate (by day, only very loud ones). */
  private hear(event: NoiseEvent): void {
    const body = this.attachedNode?.position;
    const listening =
      this.currentState === "roam" ||
      this.currentState === "investigate" ||
      this.currentState === "search";
    if (!body || !listening) {
      return;
    }
    if (!this.isNight && event.radius < CONFIG.creature.dayNoiseMinRadius) {
      return;
    }
    if (Math.hypot(event.position.x - body.x, event.position.z - body.z) > event.radius) {
      return;
    }
    this.target = { x: event.position.x, z: event.position.z };
    if (this.currentState === "search") {
      // MI10: searching, a noise draws it straight there, and it goes on searching around it.
      this.searchCenter = { ...this.target };
      this.targetAge = 0;
      return;
    }
    this.enter("investigate");
  }

  // --- States ---

  private enter(state: CreatureState): void {
    const settings = CONFIG.creature;
    this.currentState = state;
    this.stateTime = 0;
    this.stareTime = 0;
    this.backOffTime = 0;
    this.held = false;
    this.strikeTime = -1;
    this.walledSeconds = 0;
    this.hitLanded = false;
    this.onStateChanged.notifyObservers(state);
    switch (state) {
      case "roam":
        this.stateLimit = randomInRange(
          this.random,
          this.isNight ? settings.nightRoamSeconds : settings.dayStalkEvery,
        );
        this.pickRoamTarget();
        break;
      case "stalk":
        this.stateLimit = this.isNight
          ? randomInRange(this.random, settings.attackAfterSeconds)
          : settings.dayStalkSeconds;
        break;
      case "investigate":
        this.stateLimit = settings.investigateLookSeconds;
        break;
      case "attack":
        // PS1-A: the chase gives up if it has not caught the player by then.
        this.stateLimit = settings.chaseGiveUpSeconds;
        break;
      case "retreat":
        this.stateLimit = randomInRange(this.random, settings.retreatSeconds);
        this.pickRoamTarget();
        break;
      case "search":
        // OB11-B: the last night it searches the bushes longer.
        this.stateLimit = randomInRange(
          this.random,
          this.lastNight ? CONFIG.objective.lastNight.searchSeconds : settings.search.seconds,
        );
        this.pickSearchTarget();
        break;
    }
  }

  private update(seconds: number): void {
    const body = this.attachedNode;
    if (!body || this.gone) {
      return;
    }
    this.stateTime += seconds;
    if (this.banished) {
      // OB12: banished, it runs off into the fog and is gone.
      if (this.stateTime >= this.stateLimit) {
        this.vanish();
        return;
      }
      this.updateRetreat(seconds);
      return;
    }
    this.lookedAt = this.isLookedAt();
    if (this.distanceToPlayer() > CONFIG.creature.relocateDistance) {
      this.placeOutOfSight(randomInRange(this.random, this.roamRange()));
    }
    if (this.reactToApproach(seconds)) {
      return;
    }
    switch (this.currentState) {
      case "roam":
        this.updateRoam(seconds);
        break;
      case "investigate":
        this.updateInvestigate(seconds);
        break;
      case "stalk":
        this.updateStalk(seconds);
        break;
      case "attack":
        this.updateAttack(seconds);
        break;
      case "retreat":
        this.updateRetreat(seconds);
        break;
      case "search":
        this.updateSearch(seconds);
        break;
    }
  }

  /**
   * The player walking up to it (AP1-A, AP2-A). By day it never lets itself be reached: it
   * flees into the fog. At night, coming close without a lit torch provokes the attack.
   * Returns true when it changed state.
   */
  private reactToApproach(seconds: number): boolean {
    const settings = CONFIG.creature;
    const distance = this.distanceToPlayer();
    // How fast the player moves toward it (meters per second), smoothed over a few frames. Only
    // the player's own movement counts, not the creature's.
    const player = this.senses.player.position;
    const body = this.position();
    if (this.lastPlayerPosition && seconds > 0 && distance > 1e-3) {
      const towardX = (body.x - player.x) / distance;
      const towardZ = (body.z - player.z) / distance;
      const movedX = player.x - this.lastPlayerPosition.x;
      const movedZ = player.z - this.lastPlayerPosition.z;
      const closing = (movedX * towardX + movedZ * towardZ) / seconds;
      this.closingSpeed += (closing - this.closingSpeed) * Math.min(1, seconds * 5);
    }
    this.lastPlayerPosition = { x: player.x, z: player.z };
    // MI10: a player hidden in a bush is not noticed, unless it passes right next to them.
    if (this.isPlayerHidden() && distance > CONFIG.hiding.findDistance) {
      return false;
    }

    const calm =
      this.currentState === "roam" ||
      this.currentState === "investigate" ||
      this.currentState === "stalk";
    if (!calm) {
      return false;
    }
    if (!this.isNight) {
      const tooClose = distance < this.fogVisibility() * settings.dayFleeFogFraction;
      const chased =
        distance < settings.dayFleeChaseDistance && this.closingSpeed > settings.chaseSpeed;
      if (tooClose || chased) {
        this.enter("retreat");
        return true;
      }
      return false;
    }
    if (distance < settings.nightAttackDistance && !this.senses.torch.isLit) {
      this.enter("attack");
      return true;
    }
    return false;
  }

  private updateRoam(seconds: number): void {
    const settings = CONFIG.creature;
    // Night fell during a long daytime wait: hunt sooner (IA5).
    if (this.isNight && this.stateLimit - this.stateTime > settings.nightRoamSeconds[1]) {
      this.stateLimit = this.stateTime + randomInRange(this.random, settings.nightRoamSeconds);
    }
    // MI10: while the player hides, time alone does not lead it to them (only MI5-B does).
    const timeToStalk = this.stateTime >= this.stateLimit && !this.isPlayerHidden();
    if (this.canSeePlayer() || timeToStalk) {
      // OB4-A: the last night it skips the stalking and attacks.
      this.enter(this.lastNight && this.isNight ? "attack" : "stalk");
      return;
    }
    this.wander(seconds);
  }

  /**
   * MI4-A, MI10: it lost the hidden player and searches spots around where they were. Seeing
   * them again (they came out, stood up, lit the torch, or it passed right next to them) makes
   * it attack at once; after a while it gives up and retreats.
   */
  private updateSearch(seconds: number): void {
    if (this.canSeePlayer()) {
      this.enter(this.isNight ? "attack" : "stalk");
      return;
    }
    if (this.stateTime >= this.stateLimit) {
      this.enter("retreat");
      return;
    }
    this.targetAge += seconds;
    if (this.distanceTo(this.target) <= ARRIVED_DISTANCE || this.targetAge > 10) {
      this.pickSearchTarget();
    }
    this.walk(this.target, CONFIG.creature.search.speed, "Espreitar", seconds);
  }

  /** A spot `search.pointDistance` away from where it lost the player. */
  private pickSearchTarget(): void {
    const angle = this.random() * Math.PI * 2;
    const distance = randomInRange(this.random, CONFIG.creature.search.pointDistance);
    this.target = {
      x: this.searchCenter.x + Math.sin(angle) * distance,
      z: this.searchCenter.z + Math.cos(angle) * distance,
    };
    this.targetAge = 0;
  }

  private updateInvestigate(seconds: number): void {
    if (this.canSeePlayer()) {
      this.enter("stalk");
      return;
    }
    const arrived = this.distanceTo(this.target) <= ARRIVED_DISTANCE;
    if (!arrived) {
      // The look-around time only counts once it gets there.
      this.stateTime = 0;
      this.walk(this.target, CONFIG.creature.speed.stalkMax, "Andar", seconds);
    } else if (this.stateTime >= this.stateLimit) {
      this.enter("roam");
    } else {
      this.stand("Andar");
    }
  }

  private updateStalk(seconds: number): void {
    const settings = CONFIG.creature;
    if (this.lastNight && this.isNight) {
      // OB4-A: no stalking the last night.
      this.enter("attack");
      return;
    }
    if (this.stateTime >= this.stateLimit) {
      this.enter(this.isNight ? "attack" : "roam");
      return;
    }
    // GF2-B: the torch, stared at from close by, sends it back into the fog (as IA4-B does).
    if (this.backOffTime <= 0 && this.torchHoldsIt()) {
      this.stareTime = 0;
      this.backOffTime = settings.backOffSeconds;
    }
    const player = this.senses.player.position;
    const body = this.position();

    if (this.backOffTime > 0) {
      // IA4-B: stared at for too long, it slips back into the fog.
      this.backOffTime -= seconds;
      const away = normalized(body.x - player.x, body.z - player.z, { x: 0, z: 1 });
      const destination = { x: body.x + away.x * 5, z: body.z + away.z * 5 };
      this.walk(destination, settings.speed.backOff, "Espreitar", seconds, false);
      return;
    }
    if (this.lookedAt) {
      // IA4-B: freezes while looked at; the attack clock keeps running.
      this.stareTime += seconds;
      if (this.stareTime >= settings.stareSeconds) {
        this.stareTime = 0;
        this.backOffTime = settings.backOffSeconds;
      }
      this.stand("Espreitar", true);
      return;
    }
    this.stareTime = 0;

    // IA3: keep to the edge of the fog, on the side where it already is.
    const ring = this.fogVisibility() * settings.stalkFogFraction;
    const fromPlayer = normalized(body.x - player.x, body.z - player.z, { x: 0, z: 1 });
    const spot = { x: player.x + fromPlayer.x * ring, z: player.z + fromPlayer.z * ring };
    const error = this.distanceTo(spot);
    if (error < 1) {
      this.stand("Espreitar", true);
      return;
    }
    // Only as fast as it needs to keep up (IA2).
    const speed = Math.min(settings.speed.stalkMax, 0.4 + error * 0.5);
    this.walk(spot, speed, "Espreitar", seconds);
  }

  private updateAttack(seconds: number): void {
    const settings = CONFIG.creature;
    if (this.strikeTime < 0) {
      const { x, z } = this.senses.player.position;
      // PS1-A: the player reached a lit campfire, or the chase lasted too long: it gives up. The
      // clock keeps running while the torch holds it off (GF8).
      const atFire = this.fires.some(
        (fire) => Math.hypot(fire.x - x, fire.z - z) < settings.fireKeepAway,
      );
      // OB11-B: the last night it does not give up (the fire still keeps it away).
      const givesUp = this.stateTime >= this.stateLimit && !this.lastNight;
      if (atFire || givesUp) {
        this.enter("retreat");
        return;
      }
      // GF2-B: the torch, stared at from close by, holds it off; looked away, it charges at once.
      if (this.torchHoldsIt()) {
        this.holdOff(seconds);
        return;
      }
      this.held = false;
      // CN5-A: a wall or a closed door between them: no strike. Kept out long, it gives up.
      // Only counts once it is at the walls, not while still running toward them.
      const walled = this.distanceToPlayer() <= settings.strikeDistance + 1.5 && this.isWalledOff();
      this.walledSeconds = walled ? this.walledSeconds + seconds : 0;
      if (this.walledSeconds > CONFIG.building.creatureGiveUpSeconds) {
        this.enter("retreat");
        return;
      }
      if (walled || this.distanceToPlayer() > settings.strikeDistance) {
        // CR3a: the run is the "Recuar" gallop.
        this.walk({ x, z }, settings.speed.attack, "Recuar", seconds);
        return;
      }
      this.strikeTime = 0;
      this.play("Atacar", 1, false);
    }
    this.strikeTime += seconds;
    this.facePlayer(seconds);
    if (!this.hitLanded && this.strikeTime >= STRIKE_HIT_SECONDS) {
      this.hitLanded = true;
      if (this.distanceToPlayer() <= settings.hitDistance && !this.isWalledOff()) {
        this.onPlayerHit.notifyObservers(settings.damage);
      }
    }
    if (this.strikeTime >= STRIKE_SECONDS) {
      // GF3-B: a strike that missed sends it back to the chase (the give-up clock goes on).
      this.strikeTime = -1;
      this.hitLanded = false;
    }
  }

  /**
   * GF2-B, GF8: held off by the torch. It keeps about `torchHold.distance` from the player
   * (backing off faster the closer the player comes), circles sideways and growls now and then.
   */
  private holdOff(seconds: number): void {
    const hold = CONFIG.creature.torchHold;
    if (!this.held) {
      this.held = true;
      this.circleSide = this.random() < 0.5 ? -1 : 1;
      this.untilHeldGrowl = randomInRange(this.random, hold.growlEvery);
    }
    this.untilHeldGrowl -= seconds;
    if (this.untilHeldGrowl <= 0) {
      this.untilHeldGrowl = randomInRange(this.random, hold.growlEvery);
      this.onHeldGrowl.notifyObservers();
    }
    const player = this.senses.player.position;
    const body = this.position();
    const away = normalized(body.x - player.x, body.z - player.z, { x: 0, z: 1 });
    const side = { x: -away.z * this.circleSide, z: away.x * this.circleSide };
    const tooClose = hold.distance - this.distanceToPlayer();
    const outward = Math.max(-2, Math.min(2, tooClose));
    const destination = {
      x: body.x + side.x * 2 + away.x * outward,
      z: body.z + side.z * 2 + away.z * outward,
    };
    const speed = Math.min(
      CONFIG.creature.speed.attack,
      hold.circleSpeed + Math.max(0, tooClose) * 2,
    );
    this.walk(destination, speed, "Espreitar", seconds, false);
  }

  private updateRetreat(seconds: number): void {
    if (this.stateTime >= this.stateLimit) {
      this.enter("roam");
      return;
    }
    const settings = CONFIG.creature;
    const player = this.senses.player.position;
    const body = this.position();
    if (this.distanceToPlayer() < this.fogVisibility() + 15) {
      // RF-21: flees into the fog, then keeps away.
      const away = normalized(body.x - player.x, body.z - player.z, { x: 0, z: 1 });
      const destination = { x: body.x + away.x * 10, z: body.z + away.z * 10 };
      this.walk(destination, settings.speed.retreat, "Recuar", seconds);
      return;
    }
    this.wander(seconds);
  }

  /** RF-24, GF2-B: a lit torch, looked straight at from close by. */
  private torchHoldsIt(): boolean {
    // OB11-B: the last night the torch does not hold it.
    if (this.lastNight) {
      return false;
    }
    return (
      this.senses.torch.isLit &&
      this.lookedAt &&
      this.distanceToPlayer() < CONFIG.creature.torchHoldDistance
    );
  }

  // --- Moving ---

  private roamRange(): readonly [number, number] {
    const { day, night } = CONFIG.creature.roamDistance;
    return this.isNight ? night : day;
  }

  /** Walks around the player at roaming distance (RF-21), picking a new spot now and then. */
  private wander(seconds: number): void {
    this.targetAge += seconds;
    if (this.distanceTo(this.target) <= ARRIVED_DISTANCE || this.targetAge > 25) {
      this.pickRoamTarget();
    }
    this.walk(this.target, CONFIG.creature.speed.roam, "Andar", seconds);
  }

  private pickRoamTarget(): void {
    const player = this.senses.player.position;
    const angle = this.random() * Math.PI * 2;
    const distance = randomInRange(this.random, this.roamRange());
    this.target = {
      x: player.x + Math.sin(angle) * distance,
      z: player.z + Math.cos(angle) * distance,
    };
    this.targetAge = 0;
  }

  /** IA6 (and the start): reappears behind the player, out of sight, `distance` away. */
  private placeOutOfSight(distance: number): void {
    const body = this.attachedNode;
    if (!body) {
      return;
    }
    const camera = this.senses.player.camera;
    const forward = camera.getDirection(Vector3.Forward());
    const behind = Math.atan2(-forward.x, -forward.z) + (this.random() - 0.5) * (Math.PI / 1.5);
    const player = this.senses.player.position;
    const x = player.x + Math.sin(behind) * distance;
    const z = player.z + Math.cos(behind) * distance;
    body.position.set(x, this.senses.terrain.heightAt(x, z), z);
    this.heading = behind + Math.PI;
    body.rotation.y = this.heading;
    this.pickRoamTarget();
  }

  /**
   * Moves toward `destination` at `speed` (meters per second), around trunks, rocks and fires
   * (IA1, RF-24), following the terrain, and plays `animation` at a matching pace (IA2).
   */
  private walk(
    destination: FlatVector,
    speed: number,
    animation: GaitAnimation,
    seconds: number,
    faceMovement = true,
  ): void {
    const body = this.attachedNode;
    if (!body) {
      return;
    }
    const settings = CONFIG.creature;
    const here = this.position();
    const forward = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    let direction = normalized(destination.x - here.x, destination.z - here.z, forward);

    const obstacles = this.obstaclesAround(here);
    direction = avoidObstacles(
      here,
      direction,
      obstacles,
      settings.bodyRadius,
      settings.avoidDistance,
    );
    const step = Math.min(speed * seconds, this.distanceTo(destination));
    const moved = pushOutOfObstacles(
      { x: here.x + direction.x * step, z: here.z + direction.z * step },
      obstacles,
      settings.bodyRadius,
    );
    body.position.set(moved.x, this.senses.terrain.heightAt(moved.x, moved.z), moved.z);

    if (faceMovement) {
      this.turnToward(Math.atan2(direction.x, direction.z), seconds);
    } else {
      this.facePlayer(seconds);
    }
    this.play(animation, speed / (settings.animationSpeed[animation] * settings.scale));
  }

  /** Stands still (the animation holds its pose), facing the player if `watch` is set. */
  private stand(animation: AnimationName, watch = false): void {
    if (watch) {
      this.facePlayer(1 / 30);
    }
    this.play(animation, 0);
  }

  private obstaclesAround(here: FlatVector): Obstacle[] {
    const settings = CONFIG.creature;
    const fires = this.fires.map((fire) => ({
      x: fire.x,
      z: fire.z,
      radius: settings.fireKeepAway - settings.bodyRadius,
      height: 0,
    }));
    if (this.distanceToPlayer() > settings.avoidanceRange) {
      // Far away nobody sees it pass through a trunk, and the chunks there may not be loaded.
      return fires;
    }
    // The widest trunks are about 0.5 m: look a bit farther than the avoidance distance.
    const reach = settings.avoidDistance + settings.bodyRadius + 0.5;
    return [...this.senses.chunks.obstaclesNear(here.x, here.z, reach), ...fires];
  }

  private facePlayer(seconds: number): void {
    const player = this.senses.player.position;
    const here = this.position();
    this.turnToward(Math.atan2(player.x - here.x, player.z - here.z), seconds);
  }

  /** Turns the body toward `angle` (radians around Y) at most `turnRate` per second. */
  private turnToward(angle: number, seconds: number): void {
    const body = this.attachedNode;
    if (!body) {
      return;
    }
    let difference = angle - this.heading;
    difference = Math.atan2(Math.sin(difference), Math.cos(difference));
    const maxTurn = CONFIG.creature.turnRate * seconds;
    this.heading += Math.max(-maxTurn, Math.min(maxTurn, difference));
    body.rotation.y = this.heading;
  }

  private position(): FlatVector {
    const position = this.attachedNode?.position ?? Vector3.Zero();
    return { x: position.x, z: position.z };
  }

  private distanceTo(point: FlatVector): number {
    const here = this.position();
    return Math.hypot(point.x - here.x, point.z - here.z);
  }

  /**
   * Plays an animation at `speedRatio` (0 holds the current pose). Switching starts the new one
   * before stopping the old one, so the blending starts from the pose it was in.
   */
  private play(name: AnimationName, speedRatio: number, loop = true): void {
    const group = this.animations.get(name);
    if (!group) {
      return;
    }
    if (group !== this.currentAnimation) {
      const previous = this.currentAnimation;
      this.currentAnimation = group;
      group.start(loop, Math.max(speedRatio, 0.01));
      previous?.stop();
    }
    if (speedRatio <= 0.01) {
      this.currentGait = { animation: name, speedRatio: 0 };
      if (group.isPlaying) {
        group.pause();
      }
      return;
    }
    group.speedRatio = Math.min(speedRatio, 3);
    this.currentGait = { animation: name, speedRatio: group.speedRatio };
    if (!group.isPlaying) {
      group.play(loop);
    }
  }
}

function degrees(value: number): number {
  return (value * Math.PI) / 180;
}
