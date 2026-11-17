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
  /** Fired when the player touches the ground after a jump or fall (it makes noise, RF-10). */
  readonly onLanded = new Observable<void>();
  /** How the player is moving right now (drives the footstep noise). */
  gait: Gait = "still";
  /** True while standing on the ground (not jumping or falling). */
  grounded = true;

  private airborneSeconds = 0;

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
    if (dt <= 0) {
      return;
    }

    const controls = this.controlsEnabled;
    if (controls) {
      this.updateLook();
      if (this.input.wasPressed("KeyC")) {
        this.setCrouched(!this.crouched);
      }
    }

    // Movement input in the player's own frame: x = right, z = forward.
    const axis = (positive: string, negative: string) =>
      controls ? Number(this.input.isDown(positive)) - Number(this.input.isDown(negative)) : 0;
    const move = new Vector3(axis("KeyD", "KeyA"), 0, axis("KeyW", "KeyS"));
    const isMoving = move.lengthSquared() > 0;
    if (isMoving) {
      move.normalize();
    }

    const wantsToRun =
      controls && (this.input.isDown("ShiftLeft") || this.input.isDown("ShiftRight"));
    const isRunning = wantsToRun && isMoving && !this.crouched && canRun(this.stamina);
    this.stamina = updateStamina(this.stamina, isRunning, dt);

    const { walkSpeed, runSpeed, crouchSpeed } = CONFIG.player;
    const speed = this.crouched ? crouchSpeed : isRunning ? runSpeed : walkSpeed;
    const facing = Quaternion.FromEulerAngles(0, this.yaw, 0);
    const desiredVelocity = move.scale(speed).applyRotationQuaternion(facing);

    const support = this.controller.checkSupport(dt, DOWN);
    const velocity = this.computeVelocity(dt, support, desiredVelocity, facing);
    this.controller.setVelocity(velocity);
    this.controller.integrate(dt, support, this.gravity);

    this.updateGait(isRunning, dt);
    this.updateCamera(dt);
  }

  /** Works out the gait and detects landings (both used by the footstep noise, NBB-131). */
  private updateGait(isRunning: boolean, dt: number): void {
    if (!this.grounded) {
      this.airborneSeconds += dt;
    } else {
      // A tiny hop over a bump is not a landing: only real jumps and falls count.
      if (this.airborneSeconds > 0.25) {
        this.onLanded.notifyObservers();
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
    const { mouseSensitivity, maxPitch } = CONFIG.player;
    const mouse = this.input.consumeMouseMovement();
    this.yaw += mouse.x * mouseSensitivity;
    this.pitch = Math.min(maxPitch, Math.max(-maxPitch, this.pitch + mouse.y * mouseSensitivity));
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
