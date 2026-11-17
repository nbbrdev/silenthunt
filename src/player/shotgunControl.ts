import {
  Color3,
  Constants,
  CreateSoundAsync,
  Mesh,
  MeshBuilder,
  PointLight,
  StandardMaterial,
  Vector3,
  type AudioEngineV2,
  type Scene,
  type StaticSound,
} from "@babylonjs/core";
import { Control, Ellipse, TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import type { CreatureBrainBehavior } from "../ai/creatureBrain";
import type { PreyBrainBehavior } from "../ai/preyBrain";
import { CONFIG } from "../config";
import { soundUrl } from "../core/audio";
import type { Input } from "../core/input";
import { MUZZLE } from "../models/items/shotgun";
import { getSoftDotTexture } from "../models/textures";
import type { NoiseSystem } from "../systems/noise";
import type { ChunkManager } from "../world/chunks";
import type { Terrain } from "../world/terrain";
import type { Equipment } from "./equipment";
import type { PlayerHands } from "./hands";
import type { Player } from "./player";

/** What the shot can hit and what can stop it. */
export interface ShotgunWorld {
  prey: () => PreyBrainBehavior[];
  creature: CreatureBrainBehavior;
  terrain: Terrain;
  chunks: ChunkManager;
  noise: NoiseSystem;
}

/**
 * The shotgun (NBB-141, RF-34, ES2, ES3, ES5). Left click fires a barrel, right click raises it
 * to the eye (a slight zoom), R reloads both barrels in 2 s. The shot is instant: inside a narrow
 * cone, the nearest prey up to 40 m dies, the creature backs off; trunks and hills stop it. It is
 * heard 150 m away (RF-10), so the creature comes even by day.
 */
export class ShotgunControl {
  /**
   * Development only: stands in for the mouse (the headless browser cannot capture it).
   * `undefined` gives control back to the real buttons.
   */
  debugButtons: { aim: boolean } | undefined;

  private readonly player: Player;
  private readonly hands: PlayerHands;
  private readonly equipment: Equipment;
  private readonly world: ShotgunWorld;
  private readonly baseFov: number;
  private readonly light: PointLight;
  private readonly flash: Mesh;
  private readonly dot: Ellipse;
  private readonly counter: TextBlock;
  private loaded = 0;
  private spare = 0;
  private aim = 0;
  private cooldown = 0;
  private recoilLeft = 0;
  private flashLeft = 0;
  private reloadLeft = 0;
  private fireRequested = false;
  private shotSound: StaticSound | undefined;
  private reloadSound: StaticSound | undefined;

  constructor(
    scene: Scene,
    input: Input,
    player: Player,
    hands: PlayerHands,
    equipment: Equipment,
    world: ShotgunWorld,
    ui: AdvancedDynamicTexture,
  ) {
    this.player = player;
    this.hands = hands;
    this.equipment = equipment;
    this.world = world;
    this.baseFov = player.camera.fov;

    // ES3: a short flash at the muzzle: a light on the surroundings and a glowing puff.
    this.light = new PointLight("muzzleLight", MUZZLE.clone(), scene);
    this.light.parent = hands.shotgun.root;
    this.light.diffuse = new Color3(1, 0.75, 0.4);
    this.light.range = 10;
    this.light.intensity = 0;
    this.flash = MeshBuilder.CreatePlane("muzzleFlash", { size: 0.3 }, scene);
    this.flash.parent = hands.shotgun.root;
    this.flash.position = MUZZLE.add(new Vector3(0, 0, 0.08));
    this.flash.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.flash.renderingGroupId = 1;
    const flashMaterial = new StandardMaterial("muzzleFlash", scene);
    flashMaterial.emissiveColor = new Color3(1, 0.8, 0.45);
    flashMaterial.disableLighting = true;
    flashMaterial.opacityTexture = getSoftDotTexture(scene);
    flashMaterial.alphaMode = Constants.ALPHA_ADD;
    flashMaterial.disableDepthWrite = true;
    this.flash.material = flashMaterial;
    this.flash.setEnabled(false);

    this.dot = new Ellipse("shotgunDot");
    this.dot.width = "5px";
    this.dot.height = "5px";
    this.dot.thickness = 0;
    this.dot.background = "white";
    this.dot.alpha = 0.55;
    this.dot.isVisible = false;
    ui.addControl(this.dot);

    // ES5: the cartridges left (loaded and spare), bottom right.
    this.counter = new TextBlock("cartridgeCount", "");
    this.counter.color = "white";
    this.counter.alpha = 0.55;
    this.counter.fontSize = 16;
    this.counter.width = "160px";
    this.counter.height = "24px";
    this.counter.left = "-36px";
    this.counter.top = "-30px";
    this.counter.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.counter.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.counter.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.counter.isVisible = false;
    ui.addControl(this.counter);

    scene.onBeforeRenderObservable.add(() => {
      this.update(input, Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  /**
   * Loads the shot and reload sounds (ES4-A). They come from the player's own hands, so they are
   * not placed in 3D.
   */
  async loadSounds(audio: AudioEngineV2): Promise<void> {
    const settings = CONFIG.shotgun.sounds;
    const load = (file: string, volume: number) =>
      CreateSoundAsync(file, soundUrl(`shotgun/${file}`), { volume, maxInstances: 2 }, audio);
    [this.shotSound, this.reloadSound] = await Promise.all([
      load(settings.shot, settings.shotVolume),
      load(settings.reload, settings.reloadVolume),
    ]);
  }

  /** Cartridges found (a chest, ES5). */
  addCartridges(count: number): void {
    this.spare += count;
  }

  get cartridges(): { loaded: number; spare: number } {
    return { loaded: this.loaded, spare: this.spare };
  }

  /** Development only: fires as a left click would. */
  debugFire(): void {
    this.fireRequested = true;
  }

  /** Development only: reloads as R would. */
  debugReload(): void {
    this.startReload();
  }

  private update(input: Input, seconds: number): void {
    const settings = CONFIG.shotgun;
    const holding = this.equipment.current === "shotgun";
    const canAct = holding && this.player.controlsEnabled;
    this.cooldown = Math.max(0, this.cooldown - seconds);
    this.recoilLeft = Math.max(0, this.recoilLeft - seconds);

    const aimHeld = this.debugButtons?.aim ?? input.isDown("Mouse2");
    const aimTarget = canAct && aimHeld && this.reloadLeft <= 0 ? 1 : 0;
    this.aim += Math.max(-seconds * 6, Math.min(seconds * 6, aimTarget - this.aim));
    if (holding || this.aim > 0) {
      this.player.camera.fov = this.baseFov + (settings.aimFov - this.baseFov) * this.aim;
    }

    if (canAct && input.wasPressed("KeyR")) {
      this.startReload();
    }
    let open = 0;
    if (this.reloadLeft > 0) {
      this.reloadLeft -= seconds;
      const done = 1 - this.reloadLeft / settings.reloadSeconds;
      // Opens fast, stays open while loading, snaps shut at the end.
      open = Math.min(1, done / 0.15, (1 - done) / 0.15);
      if (this.reloadLeft <= 0) {
        const count = Math.min(settings.barrels - this.loaded, this.spare);
        this.loaded += count;
        this.spare -= count;
      }
    }

    const fire = this.fireRequested || input.wasPressed("Mouse0");
    this.fireRequested = false;
    if (fire && canAct && this.reloadLeft <= 0 && this.cooldown <= 0 && this.loaded > 0) {
      this.shoot();
    }

    this.flashLeft = Math.max(0, this.flashLeft - seconds);
    const flashing = this.flashLeft > 0;
    this.light.intensity = flashing ? 8 : 0;
    this.flash.setEnabled(flashing);
    if (flashing) {
      this.flash.rotation.z = Math.random() * Math.PI;
    }

    this.hands.setShotgunPose(this.aim, this.recoilLeft / settings.recoilSeconds, open);
    this.dot.isVisible = holding && this.aim > 0.5;
    this.counter.isVisible = holding;
    this.counter.text = `Cartuchos: ${this.loaded + this.spare}`;
  }

  private startReload(): void {
    const settings = CONFIG.shotgun;
    const holding = this.equipment.current === "shotgun";
    if (!holding || this.reloadLeft > 0 || this.loaded >= settings.barrels || this.spare <= 0) {
      return;
    }
    this.reloadLeft = settings.reloadSeconds;
    this.reloadSound?.play();
  }

  private shoot(): void {
    const settings = CONFIG.shotgun;
    this.loaded--;
    this.cooldown = settings.shotSeconds;
    this.recoilLeft = settings.recoilSeconds;
    this.flashLeft = settings.flashSeconds;
    this.player.shake(0.15, 0.03);
    this.shotSound?.play();
    // RF-34 / RF-10: heard 150 m away.
    this.world.noise.emit(this.player.feet, CONFIG.noise.radius.shotgun, "shotgun");

    const camera = this.player.camera;
    const eye = camera.globalPosition.clone();
    const forward = camera.getDirection(Vector3.Forward());
    let best: { distance: number; hit: () => void } | undefined;
    const consider = (center: Vector3, radius: number, hit: () => void) => {
      const toTarget = center.subtract(eye);
      const distance = toTarget.length();
      if (distance > settings.range || distance < 1e-3) {
        return;
      }
      const angle = Math.acos(Math.min(1, Vector3.Dot(forward, toTarget.scale(1 / distance))));
      const tolerance = ((settings.coneDegrees / 2) * Math.PI) / 180 + Math.atan2(radius, distance);
      if (angle > tolerance || (best && best.distance <= distance) || this.blocked(eye, center)) {
        return;
      }
      best = { distance, hit };
    };
    for (const animal of this.world.prey()) {
      const body = animal.attachedNode?.position;
      if (!body || !animal.isActive || animal.state === "dead") {
        continue;
      }
      const height = animal.kind === "rabbit" ? 0.14 : 0.9;
      const radius = animal.kind === "rabbit" ? 0.16 : 0.45;
      // RF-34: one shot kills any prey.
      consider(body.add(new Vector3(0, height, 0)), radius, () => animal.kill());
    }
    const creature = this.world.creature.attachedNode?.position;
    if (creature) {
      const scale = CONFIG.creature.scale;
      // ES3: no damage, but it backs off.
      consider(creature.add(new Vector3(0, 1.5 * scale, 0)), 0.6, () =>
        this.world.creature.repel(),
      );
    }
    best?.hit();
  }

  /** A trunk, a big rock, a wall or the ground between the eye and the target stops the shot. */
  private blocked(eye: Vector3, target: Vector3): boolean {
    const distance = Vector3.Distance(eye, target);
    const steps = Math.ceil(distance / 0.5);
    for (let i = 1; i < steps; i++) {
      const point = Vector3.Lerp(eye, target, i / steps);
      const ground = this.world.terrain.heightAt(point.x, point.z);
      if (point.y < ground) {
        return true;
      }
      for (const obstacle of this.world.chunks.obstaclesNear(point.x, point.z, 0.3)) {
        if (
          Math.hypot(point.x - obstacle.x, point.z - obstacle.z) <= obstacle.radius &&
          point.y < ground + obstacle.height
        ) {
          return true;
        }
      }
    }
    return false;
  }
}
