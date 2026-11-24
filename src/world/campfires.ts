import { Color3, PointLight, Vector3, type Scene, type StaticSound } from "@babylonjs/core";
import type { CreatureBrainBehavior } from "../ai/creatureBrain";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import { createMeatModel, type MeatModel } from "../models/items/meat";
import { createCampfireModel, type CampfireModel } from "../models/structures/campfire";
import type { Equipment } from "../player/equipment";
import type { Inventory } from "../player/inventory";
import type { Player } from "../player/player";
import type { Interaction, InteractionSystem } from "../systems/interactions";
import type { SoundEffects } from "../systems/soundEffects";
import type { VisibilitySystem } from "../systems/visibility";

interface SpitSlot {
  meat: MeatModel;
  state: "empty" | "cooking" | "cooked";
  seconds: number;
}

interface Fire {
  id: number;
  model: CampfireModel;
  light: PointLight;
  slots: SpitSlot[];
  /** RF-55: burning time left (0: a cold fire). */
  fuel: number;
  /** CH1-B: its own 3D crackle (once the sounds are loaded) and how loud it is now. */
  crackle: StaticSound | undefined;
  crackleLevel: number;
  cracklePending: boolean;
}

/** A fire as the save keeps it (NBB-147). */
export interface SavedFire {
  x: number;
  y: number;
  z: number;
  heading: number;
  fuel: number;
  spit: { state: SpitSlot["state"]; seconds: number }[];
}

/** What the campfires touch in the rest of the game. */
export interface CampfireWorld {
  creature: CreatureBrainBehavior;
  visibility: VisibilitySystem;
  inventory: Inventory;
  equipment: Equipment;
  interactions: InteractionSystem;
}

/**
 * The campfires (NBB-142, NBB-146; RF-24, RF-35, RF-55, FG1-A to FG4). Each one is made by
 * crafting and put down from the quick bar (PlacingSystem), and there can be many. A fire burns
 * 5 min; E with a branch in hand adds 2 min, up to 10; the flames shrink over the last 30 s and
 * it goes cold (stones and ash), and a branch lights it again. Holding E puts it out. While lit it
 * lights the area, the creature keeps 8 m away and the player next to it is seen from far away
 * (RF-13). Raw meat goes on its spit with E, up to 4 pieces, ready in 10 s (CZ2-A).
 */
export class CampfireManager {
  private readonly scene: Scene;
  private readonly player: Player;
  private readonly world: CampfireWorld;
  private readonly fires: Fire[] = [];
  private time = 0;
  private nextId = 1;
  /** NBB-149 (CH1-B): each fire's crackle. */
  sounds: SoundEffects | undefined;

  constructor(scene: Scene, player: Player, world: CampfireWorld) {
    this.scene = scene;
    this.player = player;
    this.world = world;
    world.visibility.nearLitFire = () =>
      this.fires.some(
        (fire) => fire.fuel > 0 && this.distanceTo(fire) <= CONFIG.campfire.litRadius,
      );
    world.interactions.add(() => this.interaction());
    scene.onBeforeRenderObservable.add(() => {
      this.update(frameSeconds(scene));
    });
  }

  /** Each fire: where, burning time left and its spit (development). */
  get list(): { at: number[]; fuel: number; crackle: number; spit: string[] }[] {
    return this.fires.map((fire) => ({
      at: fire.model.root.position.asArray().map((value) => Math.round(value * 10) / 10),
      fuel: Math.round(fire.fuel),
      crackle: Math.round((fire.crackle?.volume ?? -1) * 100) / 100,
      spit: fire.slots.map((slot) =>
        slot.state === "cooking" ? `cooking ${slot.seconds.toFixed(1)}s` : slot.state,
      ),
    }));
  }

  /** NBB-147: every fire, for the save. */
  get saved(): SavedFire[] {
    return this.fires.map((fire) => {
      const { x, y, z } = fire.model.root.position;
      return {
        x,
        y,
        z,
        heading: fire.model.root.rotation.y,
        fuel: fire.fuel,
        spit: fire.slots.map((slot) => ({ state: slot.state, seconds: slot.seconds })),
      };
    });
  }

  /** NBB-147: a saved game's fires, with their fuel and what was on the spit. */
  restore(saved: readonly SavedFire[]): void {
    for (const data of saved) {
      this.placeAt(data.x, data.y, data.z, data.heading);
      const fire = this.fires[this.fires.length - 1];
      if (!fire) {
        continue;
      }
      fire.fuel = data.fuel;
      data.spit.forEach((saved, index) => {
        const slot = fire.slots[index];
        if (!slot || saved.state === "empty") {
          return;
        }
        slot.state = saved.state;
        slot.seconds = saved.seconds;
        slot.meat.setCooked(
          saved.state === "cooked" ? 1 : saved.seconds / CONFIG.campfire.cookSeconds,
        );
        slot.meat.flesh.setEnabled(true);
      });
    }
    this.refreshCreatureFires();
  }

  /** True if a fire stands this close to (x, z) (a new one cannot go on top of it). */
  isNearAny(x: number, z: number, radius: number): boolean {
    return this.fires.some((fire) => {
      const at = fire.model.root.position;
      return Math.hypot(at.x - x, at.z - z) < radius;
    });
  }

  /** FG1-A: a new fire, lit, with 5 min of fuel; `y` is the ground or floor under it. */
  placeAt(x: number, y: number, z: number, heading = 0): void {
    const model = createCampfireModel(this.scene, CONFIG.world.defaultSeed + this.nextId);
    model.root.position.set(x, y, z);
    // The spit runs across the player's view, so the meat is seen side by side.
    model.root.rotation.y = heading;
    const light = new PointLight(
      `campfireLight${this.nextId}`,
      model.flameCenter.add(new Vector3(0, 0.2, 0)),
      this.scene,
    );
    light.parent = model.root;
    const { lightColor } = CONFIG.torch;
    light.diffuse = new Color3(lightColor.r, lightColor.g, lightColor.b);
    light.specular = Color3.Black();
    light.range = CONFIG.campfire.lightRange;
    const slots = model.spitSlots.map((spot, index) => {
      const meat = createMeatModel(this.scene, `spitMeat${this.nextId}-${index}`);
      meat.flesh.parent = model.root;
      // Hanging from the bar by its bone.
      meat.flesh.position = spot.add(new Vector3(0, -0.08, 0));
      meat.flesh.rotation.z = Math.PI / 2;
      meat.flesh.rotation.y = (index % 2) * 0.5 - 0.25;
      meat.flesh.setEnabled(false);
      const slot: SpitSlot = { meat, state: "empty", seconds: 0 };
      return slot;
    });
    this.fires.push({
      id: this.nextId++,
      model,
      light,
      slots,
      fuel: CONFIG.campfire.burnSeconds,
      crackle: undefined,
      crackleLevel: 0,
      cracklePending: false,
    });
    this.refreshCreatureFires();
  }

  private distanceTo(fire: Fire): number {
    const at = fire.model.root.position;
    const feet = this.player.feet;
    return Math.hypot(feet.x - at.x, feet.z - at.z);
  }

  /** RF-24: only lit fires keep the creature away. */
  private refreshCreatureFires(): void {
    const list = this.world.creature.fires;
    list.length = 0;
    for (const fire of this.fires) {
      if (fire.fuel > 0) {
        list.push(fire.model.root.position.clone());
      }
    }
  }

  /**
   * E near a fire (FG4): with a branch in hand, more fuel (or lighting it again); otherwise the
   * spit (CZ2-A). Holding E puts a lit fire out (FG3-A).
   */
  private interaction(): Interaction | undefined {
    let nearest: Fire | undefined;
    for (const fire of this.fires) {
      if (this.distanceTo(fire) <= CONFIG.campfire.reach) {
        if (!nearest || this.distanceTo(fire) < this.distanceTo(nearest)) {
          nearest = fire;
        }
      }
    }
    if (!nearest) {
      return undefined;
    }
    const fire = nearest;
    const distance = this.distanceTo(fire);
    const { inventory, equipment } = this.world;
    const lit = fire.fuel > 0;
    const putOut = lit
      ? { holdAct: () => this.putOut(fire), holdLabel: "apagar", id: `fire${fire.id}` }
      : {};

    if (equipment.current === "branch") {
      if (!lit) {
        return {
          label: "Acender (2:00)",
          distance,
          sound: "ignite",
          act: () => this.addFuel(fire),
        };
      }
      if (fire.fuel > CONFIG.campfire.maxSeconds - 1) {
        return { label: `A fogueira está cheia (${clock(fire.fuel)})`, distance, ...putOut };
      }
      return {
        label: `Pôr lenha (${clock(fire.fuel)})`,
        distance,
        sound: "place",
        act: () => this.addFuel(fire),
        ...putOut,
      };
    }
    if (!lit) {
      return { label: "Fogueira apagada: acenda com um galho na mão", distance };
    }
    const cooked = fire.slots.find((slot) => slot.state === "cooked");
    if (cooked) {
      if (inventory.spaceFor("cookedMeat") <= 0) {
        return { label: "Inventário cheio", distance, ...putOut };
      }
      return {
        label: "Pegar carne cozida",
        distance,
        sound: "pickup",
        act: () => {
          this.empty(cooked);
          inventory.add("cookedMeat", 1);
        },
        ...putOut,
      };
    }
    const free = fire.slots.find((slot) => slot.state === "empty");
    if (inventory.count("rawMeat") > 0 && free) {
      return {
        label: "Cozinhar carne",
        distance,
        sound: "pickup",
        act: () => {
          if (!inventory.remove("rawMeat", 1)) {
            return;
          }
          free.state = "cooking";
          free.seconds = 0;
          free.meat.setCooked(0);
          free.meat.flesh.setEnabled(true);
        },
        ...putOut,
      };
    }
    const label =
      inventory.count("rawMeat") > 0 ? "O espeto está cheio" : `Fogueira (${clock(fire.fuel)})`;
    return { label, distance, ...putOut };
  }

  /** RF-55: a branch adds 2 min (up to 10), or lights a cold fire again. */
  private addFuel(fire: Fire): void {
    if (!this.world.inventory.remove("branch", 1)) {
      return;
    }
    const { branchSeconds, maxSeconds } = CONFIG.campfire;
    fire.fuel = Math.min(maxSeconds, fire.fuel + branchSeconds);
    this.refreshCreatureFires();
  }

  /** FG3-A: put out on purpose; what was left burning is lost. */
  private putOut(fire: Fire): void {
    fire.fuel = 0;
    this.world.interactions.say("Fogueira apagada");
    // FX14: heard going out, from where it is.
    this.sounds?.play("fireOut", fire.model.root.position);
    this.refreshCreatureFires();
  }

  /** CH1-B, CH3: the crackle follows the flames; when the fire goes out it fades in 1 s. */
  private crackle(fire: Fire, target: number, seconds: number): void {
    const sounds = this.sounds;
    if (!sounds?.isLoaded) {
      return;
    }
    if (!fire.crackle && !fire.cracklePending) {
      fire.cracklePending = true;
      void sounds.campfireCrackle(fire.model.root).then((sound) => {
        fire.crackle = sound;
      });
    }
    const { volume, fadeSeconds } = CONFIG.campfire.sound;
    const step = seconds / fadeSeconds;
    fire.crackleLevel += Math.max(-step, Math.min(step, target - fire.crackleLevel));
    if (fire.crackle) {
      fire.crackle.volume = volume * fire.crackleLevel;
    }
  }

  private empty(slot: SpitSlot): void {
    slot.state = "empty";
    slot.seconds = 0;
    slot.meat.flesh.setEnabled(false);
  }

  private update(seconds: number): void {
    this.time += seconds;
    const t = this.time;
    const { lightIntensity, flicker, cookSeconds, dyingSeconds } = CONFIG.campfire;
    let changed = false;
    for (const fire of this.fires) {
      const wasLit = fire.fuel > 0;
      fire.fuel = Math.max(0, fire.fuel - seconds);
      const lit = fire.fuel > 0;
      if (wasLit !== lit) {
        changed = true;
      }
      // FG3-A: the flames shrink over the last 30 s; a cold fire shows only stones and ash.
      const strength = Math.min(1, fire.fuel / dyingSeconds);
      const wave = Math.sin(t * 9) * 0.5 + Math.sin(t * 17.3) * 0.3 + Math.sin(t * 5.1) * 0.2;
      fire.light.setEnabled(lit);
      fire.light.intensity = lightIntensity * strength * (1 + wave * flicker);
      fire.model.cores.forEach((core, index) => {
        core.setEnabled(lit);
        const size =
          (0.35 + 0.65 * strength) * (1 + Math.sin(t * (7 + index * 2.3) + index) * 0.12);
        core.scaling.set(size, 1.8 * size, size);
      });
      if (lit && !fire.model.fire.isStarted()) {
        fire.model.fire.start();
      } else if (!lit && fire.model.fire.isStarted()) {
        fire.model.fire.stop();
      }
      fire.model.fire.emitRate = 260 * (0.2 + 0.8 * strength);
      this.crackle(fire, lit ? 0.4 + 0.6 * strength : 0, seconds);

      // CZ2-A: meat only cooks on a lit fire.
      for (const slot of fire.slots) {
        if (slot.state !== "cooking" || !lit) {
          continue;
        }
        slot.seconds += seconds;
        slot.meat.setCooked(slot.seconds / cookSeconds);
        if (slot.seconds >= cookSeconds) {
          slot.state = "cooked";
        }
      }
    }
    if (changed) {
      this.refreshCreatureFires();
    }
  }
}

/** Minutes and seconds ("3:20"). */
function clock(seconds: number): string {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
