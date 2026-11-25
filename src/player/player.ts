import {
  CharacterSupportedState,
  FreeCamera,
  Observable,
  PhysicsCharacterController,
  Quaternion,
  Vector3,
  type CharacterSurfaceInfo,
  type Scene,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { isPaused } from "../core/gameTime";
import type { Input } from "../core/input";
import { canRun, updateStamina } from "./stamina";

/** How the player is moving: decides how loud each footstep is (RF-10). */
export type Gait = "still" | "crouch" | "walk" | "run";

const UP = Vector3.Up();
const DOWN = Vector3.Down();
const FORWARD = Vector3.Forward();

/** Height of the collision capsule for a given eye height. */
function capsuleHeightFor(eyeHeight: number): number {
  return eyeHeight + CONFIG.player.headroomAboveEyes;
}

/**
 * First-person player (NBB-127): mouse look, walk, run (costs stamina), crouch and jump, with
 * collisions handled by Havok's character controller.
 */
export class Player {
  readonly camera: FreeCamera;
  /** Current stamina, from 0 to CONFIG.player.stamina.max (RF-42). */
  stamina: number = CONFIG.player.stamina.max;
  /**
   * BM1 (NBB-163): how the ground changes walking in a direction (set by BiomeEffects): a speed
   * multiplier and whether it tires like running.
   */
  groundEffect: (direction: Vector3) => { speed: number; tiring: boolean } = () => ({
    speed: 1,
    tiring: false,
  });
  /** MN4: the mouse sensitivity chosen in the options (1 = the base one). */
  sensitivityScale = 1;
  /** Fired when the player touches the ground after a jump or fall (it makes noise, RF-10). */
  readonly onLanded = new Observable<void>();
  /** How the player is moving right now (drives the footstep noise). */
  gait: Gait = "still";
  /** True while standing on the ground (not jumping or falling). */
  grounded = true;

  /** NBB-164: the water at a point (surface height, depth); set by the game (none by default). */
  waterAt: (x: number, z: number) => { level: number; depth: number } = () => ({
    level: -Infinity,
    depth: 0,
  });
  /** NBB-164 (AG3-B): on dry ground, wading (slowed) or swimming. */
  waterState: "dry" | "wading" | "swimming" = "dry";
  /** NBB-164: the eyes are under the water. */
  underwater = false;
  /** NBB-164 (AG14): how far the water rises above the feet (0 on dry ground). */
  waterAboveFeet = 0;
  /** NBB-164 (AG14): seconds of air left underwater. */
  air: number = CONFIG.swimming.airSeconds;
  /** NBB-164: how long the eyes have been underwater (0 above it). */
  underwaterSeconds = 0;
  /** AG14: fired with the damage of drowning, a little every frame. */
  readonly onHurt = new Observable<number>();
  /** BM1 (NBB-163): fired with the damage of a long fall, on landing. */
  readonly onHardLanding = new Observable<number>();
  /** Fired when the water state changes (to splash in or out). */
  readonly onWaterChanged = new Observable<"dry" | "wading" | "swimming">();
  /** Fired when the eyes come up, with how long they were under. */
  readonly onSurfaced = new Observable<number>();

  private airborneSeconds = 0;
  /** BM1: the highest point of the current jump or fall (for its damage). */
  private airborneTop = 0;

  private readonly controller: PhysicsCharacterController;
  private readonly gravity = new Vector3(0, CONFIG.physics.gravity, 0);
  private yaw = 0;
  private pitch = 0;
  private crouched = false;
  /** True from the jump until the player starts falling: ignores "supported" while rising. */
  private rising = false;
  private capsuleHeight = capsuleHeightFor(CONFIG.player.eyeHeight);
  /** Eye height actually used by the camera; eases toward the standing/crouching target. */
  private eyeHeight = CONFIG.player.eyeHeight;

  private readonly scene: Scene;
  private readonly input: Input;
  /** VD2: camera shake left (seconds) and its strength (radians). */
  private shakeSeconds = 0;
  private shakeStrength = 0;

  /** False while dead (VD4): no walking, looking, crouching or jumping. */
  controlsEnabled = true;

  /** @param feet where the player's feet start (on the ground). */
  constructor(scene: Scene, input: Input, feet: Vector3) {
    this.scene = scene;
    this.input = input;
    const { capsuleRadius } = CONFIG.player;
    const start = feet.add(new Vector3(0, this.capsuleHeight / 2 + 0.05, 0));

    this.controller = new PhysicsCharacterController(
      start,
      { capsuleHeight: this.capsuleHeight, capsuleRadius },
      scene,
    );

    // Babylon's default band (0.1 m) leaves the player hovering up to 10 cm above the ground after
    // a landing; a narrow band keeps the feet on it.
    this.controller.keepContactTolerance = CONFIG.player.groundContactTolerance;

    this.camera = new FreeCamera("playerCamera", start.clone(), scene);
    this.camera.inputs.clear(); // We drive the camera ourselves.
    this.camera.minZ = 0.05;
    // MW4: nothing beyond this is drawn; the fog already hides it.
    this.camera.maxZ = CONFIG.world.drawDistance;
    scene.activeCamera = this.camera;

    scene.onBeforeRenderObservable.add(() => this.update());
  }

  /** Center of the player's collision capsule, in world coordinates. */
  get position(): Vector3 {
    return this.controller.getPosition();
  }

  /** Point on the ground under the player (bottom of the capsule). */
  get feet(): Vector3 {
    const center = this.controller.getPosition();
    return new Vector3(center.x, center.y - this.capsuleHeight / 2, center.z);
  }

  /** True while the player is crouching. */
  get isCrouched(): boolean {
    return this.crouched;
  }

  /** Snapshot for debugging and automated checks (development only, see main.ts). */
  debugState(): { feet: number[]; velocity: number[]; stamina: number; crouched: boolean } {
    const center = this.controller.getPosition();
    const velocity = this.controller.getVelocity();
    const round = (value: number) => Math.round(value * 100) / 100;
    return {
      feet: [center.x, center.y - this.capsuleHeight / 2, center.z].map(round),
      velocity: [velocity.x, velocity.y, velocity.z].map(round),
      stamina: round(this.stamina),
      crouched: this.crouched,
    };
  }

  /** VD5: puts the player back on their feet at `feet`, standing and still. */
  respawn(feet: Vector3): void {
    if (this.crouched) {
      this.setCrouched(false);
    }
    this.controller.setPosition(feet.add(new Vector3(0, this.capsuleHeight / 2 + 0.05, 0)));
    this.controller.setVelocity(Vector3.Zero());
    this.rising = false;
    this.pitch = 0;
  }

  /** VD2: shakes the view for `seconds`, up to `strength` radians. */
  shake(seconds: number, strength: number): void {
    this.shakeSeconds = seconds;
    this.shakeStrength = strength;
  }

  /** Development only: turns the view to face the point (x, z), level with the horizon. */
  /** Where the player looks (NBB-147: saved and restored). */
  get view(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  set view(view: { yaw: number; pitch: number }) {
    this.yaw = view.yaw;
    this.pitch = view.pitch;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  debugFace(x: number, z: number, y?: number): void {
    const center = this.controller.getPosition();
    this.yaw = Math.atan2(x - center.x, z - center.z);
    // Looking up or down at the point when its height is given (positive pitch looks down).
    const eyes = this.camera.position.y;
    this.pitch = y === undefined ? 0 : Math.atan2(eyes - y, Math.hypot(x - center.x, z - center.z));
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  private update(): void {
    const frameSeconds = this.scene.getEngine().getDeltaTime() / 1000;
    const dt = Math.min(frameSeconds, CONFIG.physics.maxPlayerStepSeconds);
    // MN3-A: the player stands still while the game is paused.
    if (dt <= 0 || isPaused()) {
      return;
    }

    const controls = this.controlsEnabled;
    this.updateWater(dt);
    if (controls) {
      this.updateLook();
      // In deep water C dives instead (AG3-B).
      if (this.input.wasPressed("KeyC") && this.waterState !== "swimming") {
        this.setCrouched(!this.crouched);
      }
    }
    if (this.waterState === "swimming") {
      this.swim(dt, controls);
      return;
    }
    this.swimMoving = false;

    // Movement input in the player's own frame: x = right, z = forward.
    const axis = (positive: string, negative: string) =>
      controls ? Number(this.input.isDown(positive)) - Number(this.input.isDown(negative)) : 0;
    const move = new Vector3(axis("KeyD", "KeyA"), 0, axis("KeyW", "KeyS"));
    const isMoving = move.lengthSquared() > 0;
    if (isMoving) {
      move.normalize();
    }

    const facing = Quaternion.FromEulerAngles(0, this.yaw, 0);
    // BM1 (NBB-163): the ground may slow the player (the marsh's mud) or tire them (a climb).
    const direction = move.applyRotationQuaternion(facing);
    const ground = isMoving ? this.groundEffect(direction) : { speed: 1, tiring: false };

    const wantsToRun =
      controls && (this.input.isDown("ShiftLeft") || this.input.isDown("ShiftRight"));
    const isRunning = wantsToRun && isMoving && !this.crouched && canRun(this.stamina);
    this.stamina = updateStamina(this.stamina, isRunning || ground.tiring, dt);

    const { walkSpeed, runSpeed, crouchSpeed } = CONFIG.player;
    // AG14: wading through shallow water slows the walk.
    const wading = this.waterState === "wading" ? CONFIG.swimming.wadeSpeed : 1;
    const speed =
      (this.crouched ? crouchSpeed : isRunning ? runSpeed : walkSpeed) * ground.speed * wading;
    const desiredVelocity = direction.scale(speed);

    const support = this.controller.checkSupport(dt, DOWN);
    const velocity = this.computeVelocity(dt, support, desiredVelocity, facing);
    this.controller.setVelocity(velocity);
    this.controller.integrate(dt, support, this.gravity);

    this.updateGait(isRunning, dt);
    this.updateCamera(dt);
  }

  /**
   * NBB-164 (AG3-B, AG14): how deep the player stands in water (dry, wading or swimming), and
   * the air: it runs out with the eyes under the water and comes back at the surface.
   */
  private updateWater(dt: number): void {
    const settings = CONFIG.swimming;
    const center = this.controller.getPosition();
    const feetY = center.y - this.capsuleHeight / 2;
    const water = this.waterAt(center.x, center.z);
    const above = Math.max(0, water.level - feetY);
    this.waterAboveFeet = above;
    // Swimming holds on a little shallower than it starts, so it does not flicker at the edge.
    const swimming =
      above >= settings.swimDepth ||
      (this.waterState === "swimming" && above >= settings.swimDepth - 0.25);
    const state = swimming ? "swimming" : above > settings.wadeDepth ? "wading" : "dry";
    if (state !== this.waterState) {
      this.waterState = state;
      if (state === "swimming") {
        if (this.crouched) {
          this.setCrouched(false);
        }
        // Falling into deep water is no landing: no fall damage.
        this.airborneSeconds = 0;
        this.rising = false;
      }
      this.onWaterChanged.notifyObservers(state);
    }

    const under = feetY + this.eyeHeight < water.level - 0.05;
    if (under) {
      this.underwaterSeconds += dt;
      this.air = Math.max(0, this.air - dt);
      if (this.air <= 0) {
        this.onHurt.notifyObservers(settings.drownDamage * dt);
      }
    } else {
      if (this.underwater) {
        this.onSurfaced.notifyObservers(this.underwaterSeconds);
      }
      this.underwaterSeconds = 0;
      this.air = Math.min(
        settings.airSeconds,
        this.air + (settings.airSeconds / settings.refillSeconds) * dt,
      );
    }
    this.underwater = under;
  }

  /**
   * AG3-B, AG14: swimming. At the surface the player floats with the eyes just above the water;
   * WASD swims (Shift faster); C held dives, Space comes up; underwater the player swims where
   * they look. It all tires; with no stamina left the player sinks.
   */
  private swim(dt: number, controls: boolean): void {
    const settings = CONFIG.swimming;
    const center = this.controller.getPosition();
    const eyes = center.y - this.capsuleHeight / 2 + this.eyeHeight;
    const floatAt = this.waterAt(center.x, center.z).level + settings.floatEyes;
    const axis = (positive: string, negative: string) =>
      controls ? Number(this.input.isDown(positive)) - Number(this.input.isDown(negative)) : 0;
    const move = new Vector3(axis("KeyD", "KeyA"), 0, axis("KeyW", "KeyS"));
    const moving = move.lengthSquared() > 0;
    if (moving) {
      move.normalize();
    }
    const wantsSprint =
      controls && (this.input.isDown("ShiftLeft") || this.input.isDown("ShiftRight"));
    const sprinting = wantsSprint && moving && !this.underwater && canRun(this.stamina);
    const cost = sprinting ? 1 : moving ? settings.slowCost : settings.floatCost;
    this.stamina = Math.max(0, this.stamina - CONFIG.player.stamina.runCostPerSecond * cost * dt);

    let velocity: Vector3;
    if (this.underwater && moving) {
      // Underwater, where the eyes look (up and down too).
      const look = Quaternion.FromEulerAngles(this.pitch, this.yaw, 0);
      velocity = move.applyRotationQuaternion(look).scale(settings.underwaterSpeed);
    } else {
      const facing = Quaternion.FromEulerAngles(0, this.yaw, 0);
      velocity = move
        .applyRotationQuaternion(facing)
        .scale(sprinting ? settings.sprintSpeed : settings.swimSpeed);
    }
    const toFloat = floatAt - eyes;
    const vertical = settings.verticalSpeed;
    if (this.stamina <= 0) {
      velocity.y = -settings.sinkSpeed;
    } else if (controls && this.input.isDown("KeyC")) {
      velocity.y = -vertical;
    } else if (controls && this.input.isDown("Space")) {
      velocity.y = Math.min(vertical, toFloat * 4);
    } else if (!this.underwater || !moving) {
      // Floating back to the surface (slowly when underwater and still).
      velocity.y = Math.max(-vertical, Math.min(this.underwater ? 0.3 : vertical, toFloat * 2));
    }
    // Never above the floating height.
    velocity.y = Math.min(velocity.y, toFloat * 4);
    this.controller.setVelocity(velocity);
    const support = this.controller.checkSupport(dt, DOWN);
    this.controller.integrate(dt, support, Vector3.Zero());
    this.grounded = false;
    this.gait = "still";
    this.swimMoving = moving;
    this.updateCamera(dt);
  }

  /** NBB-164: swimming and moving (the strokes are heard). */
  swimMoving = false;

  /** NBB-164 (AG4-A): the hands may use weapons and tools (in control, and not swimming). */
  get handsFree(): boolean {
    return this.controlsEnabled && this.waterState !== "swimming";
  }

  /** Works out the gait and detects landings (both used by the footstep noise, NBB-131). */
  private updateGait(isRunning: boolean, dt: number): void {
    const feetY = this.feet.y;
    if (!this.grounded) {
      if (this.airborneSeconds === 0) {
        this.airborneTop = feetY;
      }
      this.airborneSeconds += dt;
      this.airborneTop = Math.max(this.airborneTop, feetY);
    } else {
      // A tiny hop over a bump is not a landing: only real jumps and falls count.
      if (this.airborneSeconds > 0.25) {
        this.onLanded.notifyObservers();
        // BM1 (NBB-163): a long fall hurts.
        const { safeDrop, damagePerMeter } = CONFIG.player.fall;
        const drop = this.airborneTop - feetY;
        // AG14: deep water breaks the fall.
        const soft = this.waterAboveFeet >= CONFIG.swimming.softLandingDepth;
        if (drop > safeDrop && !soft) {
          this.onHardLanding.notifyObservers((drop - safeDrop) * damagePerMeter);
        }
      }
      this.airborneSeconds = 0;
    }
    const velocity = this.controller.getVelocity();
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    if (!this.grounded || horizontalSpeed < 0.3) {
      this.gait = "still";
    } else if (this.crouched) {
      this.gait = "crouch";
    } else {
      this.gait = isRunning ? "run" : "walk";
    }
  }

  private updateLook(): void {
    const { maxPitch } = CONFIG.player;
    // MN4: the player's own sensitivity (options) scales the base one.
    const sensitivity = CONFIG.player.mouseSensitivity * this.sensitivityScale;
    const mouse = this.input.consumeMouseMovement();
    this.yaw += mouse.x * sensitivity;
    this.pitch = Math.min(maxPitch, Math.max(-maxPitch, this.pitch + mouse.y * sensitivity));
  }

  /** Velocity for this frame, following Babylon's character controller example. */
  private computeVelocity(
    dt: number,
    support: CharacterSurfaceInfo,
    desiredVelocity: Vector3,
    facing: Quaternion,
  ): Vector3 {
    const current = this.controller.getVelocity();
    const forwardWorld = FORWARD.applyRotationQuaternion(facing);

    // Babylon reports "supported" up to keepDistance + keepContactTolerance (0.15 m) above the
    // ground, so right after a jump the player would still count as grounded and lose the jump.
    if (this.rising && current.y <= 0) {
      this.rising = false;
    }
    const grounded = support.supportedState === CharacterSupportedState.SUPPORTED && !this.rising;
    this.grounded = grounded;
    this.controller.acceleration = grounded
      ? CONFIG.player.groundResponse
      : CONFIG.player.airResponse;

    if (!grounded) {
      // In the air: steer horizontally, keep the vertical speed and add gravity.
      const velocity = this.controller.calculateMovement(
        dt,
        forwardWorld,
        UP,
        current,
        Vector3.Zero(),
        desiredVelocity,
        UP,
      );
      velocity.addInPlace(UP.scale(-velocity.dot(UP)));
      velocity.addInPlace(UP.scale(current.dot(UP)));
      velocity.addInPlace(this.gravity.scale(dt));
      return velocity;
    }

    // On the ground: move along the surface without being launched up slopes.
    let velocity = this.controller.calculateMovement(
      dt,
      forwardWorld,
      support.averageSurfaceNormal,
      current,
      support.averageSurfaceVelocity,
      desiredVelocity,
      UP,
    );
    velocity.subtractInPlace(support.averageSurfaceVelocity);
    if (velocity.dot(UP) > 1e-3) {
      const length = velocity.length();
      velocity.normalizeFromLength(length);
      const horizontalLength = length / support.averageSurfaceNormal.dot(UP);
      velocity = support.averageSurfaceNormal.cross(velocity).cross(UP);
      velocity.scaleInPlace(horizontalLength);
    }
    velocity.addInPlace(support.averageSurfaceVelocity);

    if (this.controlsEnabled && this.input.wasPressed("Space")) {
      // Initial upward speed that reaches jumpHeight: v = sqrt(2 * g * h).
      velocity.y = Math.sqrt(2 * -CONFIG.physics.gravity * CONFIG.player.jumpHeight);
      this.rising = true;
    } else {
      // Keep pulling down while grounded so the feet settle on the ground instead of hovering
      // inside the 0.15 m "supported" band.
      velocity.addInPlace(this.gravity.scale(dt));
    }
    return velocity;
  }

  private setCrouched(crouched: boolean): void {
    this.crouched = crouched;
    const { eyeHeight, crouchEyeHeight, capsuleRadius } = CONFIG.player;
    this.capsuleHeight = capsuleHeightFor(crouched ? crouchEyeHeight : eyeHeight);
    // Keeps the feet where they are while the capsule grows or shrinks.
    this.controller.setShapeOptions({ capsuleHeight: this.capsuleHeight, capsuleRadius }, true);
  }

  private updateCamera(dt: number): void {
    const { eyeHeight, crouchEyeHeight, crouchTransitionSpeed } = CONFIG.player;
    const targetEyeHeight = this.crouched ? crouchEyeHeight : eyeHeight;
    const maxChange = crouchTransitionSpeed * dt;
    this.eyeHeight += Math.max(-maxChange, Math.min(maxChange, targetEyeHeight - this.eyeHeight));

    const center = this.controller.getPosition();
    const feetY = center.y - this.capsuleHeight / 2;
    this.camera.position.set(center.x, feetY + this.eyeHeight, center.z);

    // VD2: a short shake that fades out.
    let shakePitch = 0;
    let shakeYaw = 0;
    if (this.shakeSeconds > 0) {
      this.shakeSeconds = Math.max(0, this.shakeSeconds - dt);
      const strength = this.shakeStrength * Math.min(1, this.shakeSeconds * 8);
      shakePitch = (Math.random() * 2 - 1) * strength;
      shakeYaw = (Math.random() * 2 - 1) * strength;
    }
    this.camera.rotation.set(this.pitch + shakePitch, this.yaw + shakeYaw, 0);
  }
}
