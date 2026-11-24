import {
  Observable,
  type InstancedMesh,
  type Mesh,
  type Scene,
  type Vector3,
} from "@babylonjs/core";
import { Rectangle, type AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import type { DayClock } from "../core/dayClock";
import { createBedMesh } from "../models/structures/bed";
import type { PlayerHunger } from "../player/hunger";
import type { Inventory } from "../player/inventory";
import type { Player } from "../player/player";
import type { Interaction, InteractionSystem } from "../systems/interactions";

interface Bed {
  id: number;
  mesh: InstancedMesh;
}

/** What the beds touch in the rest of the game. */
export interface BedWorld {
  clock: DayClock;
  hunger: PlayerHunger;
  inventory: Inventory;
  interactions: InteractionSystem;
  /** Where the creature is now (no sleeping with it close, RF-62). */
  creaturePosition: () => Vector3;
}

/**
 * The beds (NBB-146; RF-60, RF-62, CM1-A, CM2, DO1). A bed put down becomes the place to respawn.
 * E on it sleeps, if it is night and the creature is not within 30 m: the screen fades out, the
 * clock jumps to dawn (hunger drops as if the night had passed; health does not come back) and
 * the screen fades in. E also makes it the respawn place again. Holding E rolls it up.
 */
export class BedManager {
  /** Fired when the player wakes up at dawn (the game saves then, SV3). */
  readonly onWoke = new Observable<void>();

  private readonly player: Player;
  private readonly world: BedWorld;
  private readonly template: Mesh;
  private readonly beds: Bed[] = [];
  private readonly fade: Rectangle;
  private respawnBed: Bed | undefined;
  private nextId = 1;
  /** DO1: the fade, from 0 (clear) to 1 (black) and back; undefined when not sleeping. */
  private sleep: { seconds: number; skipped: boolean } | undefined;
  /** NBB-156: no sleeping through the last night (the rescue only comes to who faces it). */
  sleepBlocked: () => boolean = () => false;

  constructor(scene: Scene, player: Player, world: BedWorld, ui: AdvancedDynamicTexture) {
    this.player = player;
    this.world = world;
    this.template = createBedMesh(scene);
    this.template.setEnabled(false);
    this.fade = new Rectangle("sleepFade");
    this.fade.background = "black";
    this.fade.thickness = 0;
    this.fade.alpha = 0;
    this.fade.isVisible = false;
    this.fade.isHitTestVisible = false;
    ui.addControl(this.fade);
    world.interactions.add(() => this.interaction());
    scene.onBeforeRenderObservable.add(() => {
      this.update(frameSeconds(scene));
    });
  }

  /** RF-60: where the player comes back after dying (the bed, or nothing: the start). */
  get respawnPoint(): Vector3 | undefined {
    return this.respawnBed?.mesh.position.clone();
  }

  get isSleeping(): boolean {
    return this.sleep !== undefined;
  }

  /** True if a bed stands this close to (x, z). */
  isNearAny(x: number, z: number, radius: number): boolean {
    return this.beds.some((bed) => {
      const at = bed.mesh.position;
      return Math.hypot(at.x - x, at.z - z) < radius;
    });
  }

  /** FG1-A / CM1-A: a bed put down; it becomes the respawn place. */
  placeAt(x: number, y: number, z: number, heading = 0, quiet = false): void {
    const mesh = this.template.createInstance(`bed${this.nextId}`);
    mesh.setEnabled(true);
    mesh.position.set(x, y, z);
    mesh.rotation.y = heading;
    const bed = { id: this.nextId++, mesh };
    this.beds.push(bed);
    this.respawnBed = bed;
    if (!quiet) {
      this.world.interactions.say("Você vai renascer nesta cama");
    }
  }

  /** NBB-147: the beds and which one is the respawn place (−1: none), for the save. */
  get saved(): { beds: { x: number; y: number; z: number; heading: number }[]; respawn: number } {
    return {
      beds: this.beds.map(({ mesh }) => ({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
        heading: mesh.rotation.y,
      })),
      respawn: this.respawnBed ? this.beds.indexOf(this.respawnBed) : -1,
    };
  }

  /** NBB-147: a saved game's beds. */
  restore(saved: {
    beds: { x: number; y: number; z: number; heading: number }[];
    respawn: number;
  }): void {
    for (const bed of saved.beds) {
      this.placeAt(bed.x, bed.y, bed.z, bed.heading, true);
    }
    this.respawnBed = this.beds[saved.respawn];
  }

  /** E sleeps (and makes it the respawn place); holding E rolls it up (CM2). */
  private interaction(): Interaction | undefined {
    const feet = this.player.feet;
    let nearest: { bed: Bed; distance: number } | undefined;
    for (const bed of this.beds) {
      const at = bed.mesh.position;
      const distance = Math.hypot(at.x - feet.x, at.z - feet.z);
      if (distance <= CONFIG.bed.reach && (!nearest || distance < nearest.distance)) {
        nearest = { bed, distance };
      }
    }
    if (!nearest || this.sleep) {
      return undefined;
    }
    const { bed, distance } = nearest;
    return {
      label: "Dormir",
      distance,
      id: `bed${bed.id}`,
      act: () => this.trySleep(bed),
      holdAct: () => this.rollUp(bed),
      holdLabel: "recolher",
      holdActSound: "pickup",
    };
  }

  private trySleep(bed: Bed): void {
    const { clock, creaturePosition, interactions } = this.world;
    this.respawnBed = bed;
    if (clock.phase !== "night") {
      interactions.say("Só dá para dormir à noite");
      return;
    }
    const creature = creaturePosition();
    const feet = this.player.feet;
    const near = Math.hypot(creature.x - feet.x, creature.z - feet.z) < CONFIG.bed.safeDistance;
    if (near || this.sleepBlocked()) {
      interactions.say("Não dá para dormir: há perigo por perto");
      return;
    }
    this.sleep = { seconds: 0, skipped: false };
    this.player.controlsEnabled = false;
    this.fade.isVisible = true;
  }

  private rollUp(bed: Bed): void {
    const { inventory, interactions } = this.world;
    if (inventory.spaceFor("bed") <= 0) {
      interactions.say("Inventário cheio");
      return;
    }
    inventory.add("bed", 1);
    bed.mesh.dispose();
    this.beds.splice(this.beds.indexOf(bed), 1);
    if (this.respawnBed === bed) {
      this.respawnBed = undefined;
    }
  }

  /** DO1: fade out, jump to dawn (hunger drops for the time skipped), fade back in. */
  private update(seconds: number): void {
    const sleep = this.sleep;
    if (!sleep) {
      return;
    }
    const fadeSeconds = CONFIG.bed.fadeSeconds;
    sleep.seconds += seconds;
    if (!sleep.skipped && sleep.seconds >= fadeSeconds) {
      sleep.skipped = true;
      const { clock, hunger } = this.world;
      const skipped = clock.skipToDawn();
      const settings = CONFIG.player.hunger;
      hunger.set(hunger.value - (settings.max / settings.emptySeconds) * skipped);
    }
    const t = sleep.seconds / fadeSeconds;
    this.fade.alpha = t < 1 ? t : Math.max(0, 2 - t);
    if (t >= 2) {
      this.sleep = undefined;
      this.fade.isVisible = false;
      this.player.controlsEnabled = true;
      this.onWoke.notifyObservers();
    }
  }
}
