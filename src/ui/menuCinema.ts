import {
  Color3,
  FreeCamera,
  PointLight,
  Vector3,
  type AnimationGroup,
  type Camera,
  type DefaultRenderingPipeline,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle } from "@babylonjs/gui";
import type { CreaturePresence } from "../ai/creaturePresence";
import { CONFIG, type CinematicShot } from "../config";
import type { DayClock } from "../core/dayClock";
import { createCampfireModel, type CampfireModel } from "../models/structures/campfire";
import type { Atmosphere } from "../world/atmosphere";
import type { Terrain } from "../world/terrain";
import { edgeImage } from "./damageEffects";

/** What the film works with. */
export interface FilmParts {
  scene: Scene;
  /** The player's camera (back to it when the game starts). */
  playerCamera: Camera;
  pipeline: DefaultRenderingPipeline;
  clock: DayClock;
  atmosphere: Atmosphere;
  terrain: Terrain;
  creature: { root: TransformNode; animations: AnimationGroup[] };
  presence: CreaturePresence;
  /** Moves the sound's ears (the listener) to a camera. */
  hearFrom: (camera: Camera) => void;
  /** True while the main menu (or a screen reached from it) is open. */
  isMainMenu: () => boolean;
}

/**
 * The main menu's film (NBB-159; CI1-A to CI9). While the main menu is open, a camera of its own
 * goes through a few night shots near the start, with slow moves and a slight handheld sway, cut
 * through black: the empty clearing, her eyes in the dark, the cabin with a dying fire, her
 * silhouette against the fog, her walking by. The world stays paused: only she is animated,
 * borrowed for the shots and put back afterwards, and the save is not touched.
 */
export class MenuCinema {
  private readonly p: FilmParts;
  private readonly camera: FreeCamera;
  private readonly ui: AdvancedDynamicTexture;
  private readonly black: Rectangle;
  private active = false;
  private shotIndex = 0;
  private shotTime = 0;
  /** Going into the game: seconds into the fade (undefined when not leaving). */
  private leaving: number | undefined;
  private growled = false;
  private saved:
    | { position: Vector3; rotation: number; enabled: boolean; playing: AnimationGroup[] }
    | undefined;
  private current: AnimationGroup | undefined;
  private fire: { model: CampfireModel; light: PointLight } | undefined;

  constructor(parts: FilmParts) {
    this.p = parts;
    const scene = parts.scene;
    this.camera = new FreeCamera("filmCamera", Vector3.Zero(), scene);
    this.camera.minZ = 0.05;
    this.camera.fov = parts.playerCamera.fov;
    parts.pipeline.addCamera(this.camera);

    // CI7-A: black bars and dark edges; a black cover for the cuts. Under the menus (made first).
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("filmFrame", true, scene);
    const settings = CONFIG.cinematic;
    for (const alignment of [Control.VERTICAL_ALIGNMENT_TOP, Control.VERTICAL_ALIGNMENT_BOTTOM]) {
      const bar = new Rectangle("filmBar");
      bar.height = `${settings.barShare * 100}%`;
      bar.background = "black";
      bar.thickness = 0;
      bar.verticalAlignment = alignment;
      this.ui.addControl(bar);
    }
    const edges = edgeImage("filmEdges", "rgba(0, 0, 0, 1)");
    edges.alpha = settings.edgeAlpha;
    this.ui.addControl(edges);
    this.black = new Rectangle("filmBlack");
    this.black.background = "black";
    this.black.thickness = 0;
    this.ui.addControl(this.black);
    this.ui.rootContainer.isVisible = false;

    scene.onBeforeRenderObservable.add(() => {
      // Real time: the world is paused behind the menu.
      this.update(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  /** True while the film is on screen (the chunks load around its camera then). */
  get isActive(): boolean {
    return this.active;
  }

  /** Where the film's camera is (the world loads around it). */
  get focus(): Vector3 {
    return this.camera.position;
  }

  /** Development: which shot is playing and for how long. */
  debugState(): object {
    return {
      active: this.active,
      shot: CONFIG.cinematic.shots[this.shotIndex]?.name,
      seconds: Math.round(this.shotTime * 10) / 10,
    };
  }

  /** Development: jumps to a shot (0 to 4) and a moment in it. */
  debugShot(index: number, seconds = 2): void {
    this.startShot(index);
    this.shotTime = seconds;
  }

  private update(seconds: number): void {
    const wanted = this.p.isMainMenu();
    if (wanted && !this.active) {
      this.start();
    } else if (!wanted && this.active && this.leaving === undefined) {
      this.leaving = 0;
    }
    if (!this.active) {
      return;
    }
    const settings = CONFIG.cinematic;
    if (this.leaving !== undefined) {
      // CI9: into the game through black.
      this.leaving += seconds;
      const half = settings.exitSeconds;
      if (this.leaving < half) {
        this.black.alpha = this.leaving / half;
        this.film(seconds);
        return;
      }
      this.stop();
      return;
    }
    this.film(seconds);
  }

  private start(): void {
    const { scene, clock, atmosphere, creature } = this.p;
    this.active = true;
    this.leaving = undefined;
    this.ui.rootContainer.isVisible = true;
    this.saved = {
      position: creature.root.position.clone(),
      rotation: creature.root.rotation.y,
      enabled: creature.root.isEnabled(),
      playing: scene.animationGroups.filter((group) => group.isPlaying),
    };
    // Only she moves: every other animation waits, then the scene's animations run.
    for (const group of this.saved.playing) {
      group.pause();
    }
    scene.animationsEnabled = true;
    clock.presentNight = true;
    atmosphere.menuFog = CONFIG.cinematic.fogBlend;
    scene.activeCamera = this.camera;
    this.p.hearFrom(this.camera);
    this.startShot(0);
  }

  private stop(): void {
    const { scene, clock, atmosphere, creature, playerCamera, presence } = this.p;
    this.active = false;
    this.leaving = undefined;
    this.ui.rootContainer.isVisible = false;
    this.clearShot();
    presence.filmBreath(false, 10);
    const saved = this.saved;
    if (saved) {
      creature.root.position.copyFrom(saved.position);
      creature.root.rotation.y = saved.rotation;
      creature.root.setEnabled(saved.enabled);
      for (const group of saved.playing) {
        group.play(group.loopAnimation);
      }
    }
    // The game's own pause flag decides again (the menu resumed it already).
    scene.animationsEnabled = true;
    clock.presentNight = false;
    atmosphere.menuFog = 0;
    scene.activeCamera = playerCamera;
    this.p.hearFrom(playerCamera);
  }

  private startShot(index: number): void {
    const shots = CONFIG.cinematic.shots;
    this.clearShot();
    this.shotIndex = ((index % shots.length) + shots.length) % shots.length;
    this.shotTime = 0;
    this.growled = false;
    const shot = shots[this.shotIndex];
    if (!shot) {
      return;
    }
    const { creature, scene } = this.p;
    if (shot.creature) {
      creature.root.setEnabled(true);
      const animation = creature.animations.find(
        (group) => group.name === shot.creature?.animation,
      );
      for (const group of creature.animations) {
        group.stop();
      }
      if (animation) {
        // The walk at its pace; the stalking pose barely moving.
        const walking = shot.creature.to !== undefined;
        animation.start(true, walking ? 1.6 : 0.35);
        this.current = animation;
      }
    } else {
      creature.root.setEnabled(false);
    }
    if (shot.fire) {
      const [x = 0, z = 0] = shot.fire;
      const model = createCampfireModel(scene, 7);
      const y = this.p.terrain.heightAt(x, z);
      model.root.position.set(x, y, z);
      model.fire.start();
      // A dying fire: small, low and red.
      model.fire.emitRate *= 0.35;
      model.fire.updateSpeed = 0.012;
      const light = new PointLight("filmFireLight", new Vector3(x, y + 0.5, z), scene);
      light.diffuse = new Color3(1, 0.45, 0.18);
      light.intensity = 0.8;
      light.range = 7;
      this.fire = { model, light };
    }
  }

  private clearShot(): void {
    this.current?.stop();
    this.current = undefined;
    if (this.fire) {
      this.fire.model.fire.dispose();
      this.fire.model.root.dispose();
      this.fire.light.dispose();
      this.fire = undefined;
    }
  }

  /** One frame of the current shot: camera, the creature, the cuts' black. */
  private film(seconds: number): void {
    const settings = CONFIG.cinematic;
    const shot = settings.shots[this.shotIndex];
    if (!shot) {
      return;
    }
    this.shotTime += seconds;
    if (this.shotTime >= settings.shotSeconds) {
      this.startShot(this.shotIndex + 1);
      return;
    }
    const t = this.shotTime / settings.shotSeconds;
    const ease = t * t * (3 - 2 * t);
    this.placeCreature(shot, t);
    this.placeCamera(shot, ease);

    // CI3-A: each shot fades in from black and out to black.
    const fade = settings.fadeSeconds;
    const fromStart = this.shotTime / fade;
    const toEnd = (settings.shotSeconds - this.shotTime) / fade;
    const black = 1 - Math.min(1, fromStart, toEnd);
    if (this.leaving === undefined) {
      this.black.alpha = Math.max(0, black);
    }

    // CI6-A, CI9: her breath in her shots, a low growl in the silhouette.
    const breathing = shot.breath === true && this.p.creature.root.isEnabled();
    this.p.presence.filmBreath(breathing, seconds);
    if (shot.growlAt !== undefined && !this.growled && this.shotTime >= shot.growlAt) {
      this.growled = true;
      this.p.presence.growlNow();
    }
  }

  private placeCreature(shot: CinematicShot, t: number): void {
    const plan = shot.creature;
    if (!plan) {
      return;
    }
    const root = this.p.creature.root;
    if (plan.goneAt !== undefined && this.shotTime >= plan.goneAt) {
      root.setEnabled(false);
      return;
    }
    const [ax = 0, az = 0] = plan.at;
    const [bx = ax, bz = az] = plan.to ?? plan.at;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    root.position.set(x, this.p.terrain.heightAt(x, z), z);
    root.rotation.y = plan.heading;
  }

  private placeCamera(shot: CinematicShot, ease: number): void {
    const settings = CONFIG.cinematic;
    let position: Vector3;
    let target: Vector3;
    if (shot.orbit) {
      const { center, radius, height, from, to } = shot.orbit;
      const [cx = 0, cz = 0] = center;
      const angle = from + (to - from) * ease;
      const x = cx + Math.sin(angle) * radius;
      const z = cz + Math.cos(angle) * radius;
      position = new Vector3(x, this.p.terrain.heightAt(x, z) + height, z);
      target = new Vector3(cx, this.p.terrain.heightAt(cx, cz) + 1.3, cz);
    } else {
      position = this.onGround(shot.camera?.from, shot.camera?.to, ease);
      if (shot.follow) {
        const root = this.p.creature.root.position;
        target = new Vector3(root.x, root.y + 2.2, root.z);
      } else {
        target = this.onGround(shot.target?.from, shot.target?.to, ease);
      }
    }
    // CI4-A: a slight handheld sway.
    const time = this.shotTime;
    position.x += Math.sin(time * 1.3) * settings.swayMeters;
    position.y += Math.sin(time * 1.7 + 1) * settings.swayMeters;
    this.camera.position.copyFrom(position);
    this.camera.setTarget(target);
    this.camera.rotation.x += Math.sin(time * 0.9) * settings.swayAngle;
    this.camera.rotation.y += Math.sin(time * 0.7 + 2) * settings.swayAngle;
  }

  /** A point between `from` and `to` ([x, height above ground, z]). */
  private onGround(from: number[] = [0, 1.6, 0], to: number[] = from, t: number): Vector3 {
    const [ax = 0, ah = 1.6, az = 0] = from;
    const [bx = ax, bh = ah, bz = az] = to;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    return new Vector3(x, this.p.terrain.heightAt(x, z) + ah + (bh - ah) * t, z);
  }
}
