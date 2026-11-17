import { Color3, PointLight, Vector3, type Scene } from "@babylonjs/core";
import type { CreatureBrainBehavior } from "../ai/creatureBrain";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import { createMeatModel, type MeatModel } from "../models/items/meat";
import { createCampfireModel, type CampfireModel } from "../models/structures/campfire";
import type { Player } from "../player/player";
import type { Provisions } from "../player/provisions";
import type { Interaction, InteractionSystem } from "../systems/interactions";
import type { VisibilitySystem } from "../systems/visibility";
import type { Terrain } from "./terrain";

interface SpitSlot {
  meat: MeatModel;
  state: "empty" | "cooking" | "cooked";
  seconds: number;
}

/** What the campfire touches in the rest of the game. */
export interface CampfireWorld {
  terrain: Terrain;
  creature: CreatureBrainBehavior;
  visibility: VisibilitySystem;
  provisions: Provisions;
  interactions: InteractionSystem;
}

/**
 * The campfire (NBB-142, CZ1-A). Provisional until crafting (NBB-146): G places one a little
 * ahead, free, one at a time (placing another moves it) and it never goes out until the
 * progression round (PG) decides. It lights the area, the creature keeps 8 m away (RF-24) and
 * the player next to it is seen from far away (RF-13). Raw meat goes on its spit with E, up to
 * 4 pieces; each one darkens and is ready in 10 s (CZ2-A, RF-35).
 */
export class CampfireManager {
  private readonly scene: Scene;
  private readonly player: Player;
  private readonly world: CampfireWorld;
  private model: CampfireModel | undefined;
  private light: PointLight | undefined;
  private slots: SpitSlot[] = [];
  private time = 0;

  constructor(scene: Scene, input: Input, player: Player, world: CampfireWorld) {
    this.scene = scene;
    this.player = player;
    this.world = world;
    world.visibility.nearLitFire = () => this.isNear(CONFIG.campfire.litRadius);
    world.interactions.add(() => this.spitInteraction());
    scene.onBeforeRenderObservable.add(() => {
      if (player.controlsEnabled && input.wasPressed("KeyG")) {
        this.placeAhead();
      }
      this.update(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  /** Where the fire is, if there is one (development). */
  get position(): Vector3 | undefined {
    return this.model?.root.position;
  }

  /** The state of each spit slot (development). */
  get spit(): string[] {
    return this.slots.map((slot) =>
      slot.state === "cooking" ? `cooking ${slot.seconds.toFixed(1)}s` : slot.state,
    );
  }

  /** CZ1-A: G puts the fire on the ground a little ahead of the player. */
  placeAhead(): void {
    const forward = this.player.camera.getDirection(Vector3.Forward());
    const flat = new Vector3(forward.x, 0, forward.z).normalize();
    const spot = this.player.feet.add(flat.scale(CONFIG.campfire.placeDistance));
    this.placeAt(spot.x, spot.z, Math.atan2(flat.x, flat.z));
  }

  placeAt(x: number, z: number, heading = 0): void {
    if (!this.model) {
      this.build();
    }
    const model = this.model;
    if (!model) {
      return;
    }
    // Moving the fire hands back what was on the spit, as it was.
    for (const slot of this.slots) {
      if (slot.state === "cooking") {
        this.world.provisions.add("rawMeat");
      } else if (slot.state === "cooked") {
        this.world.provisions.add("cookedMeat");
      }
      this.empty(slot);
    }
    model.root.position.set(x, this.world.terrain.heightAt(x, z), z);
    // The spit runs across the player's view, so the meat is seen side by side.
    model.root.rotation.y = heading;
    model.root.setEnabled(true);
    const fires = this.world.creature.fires;
    fires.length = 0;
    fires.push(model.root.position.clone());
  }

  private build(): void {
    const model = createCampfireModel(this.scene, CONFIG.world.defaultSeed);
    this.model = model;
    const light = new PointLight(
      "campfireLight",
      model.flameCenter.add(new Vector3(0, 0.2, 0)),
      this.scene,
    );
    light.parent = model.root;
    const { lightColor } = CONFIG.torch;
    light.diffuse = new Color3(lightColor.r, lightColor.g, lightColor.b);
    light.specular = Color3.Black();
    light.range = CONFIG.campfire.lightRange;
    this.light = light;
    this.slots = model.spitSlots.map((spot, index) => {
      const meat = createMeatModel(this.scene, `spitMeat${index}`);
      meat.flesh.parent = model.root;
      // Hanging from the bar by its bone.
      meat.flesh.position = spot.add(new Vector3(0, -0.08, 0));
      meat.flesh.rotation.z = Math.PI / 2;
      meat.flesh.rotation.y = (index % 2) * 0.5 - 0.25;
      const slot: SpitSlot = { meat, state: "empty", seconds: 0 };
      this.empty(slot);
      return slot;
    });
  }

  private empty(slot: SpitSlot): void {
    slot.state = "empty";
    slot.seconds = 0;
    slot.meat.flesh.setEnabled(false);
  }

  private isNear(radius: number): boolean {
    const fire = this.model?.root.position;
    if (!fire) {
      return false;
    }
    const feet = this.player.feet;
    return Math.hypot(feet.x - fire.x, feet.z - fire.z) <= radius;
  }

  /** CZ2-A: E takes a cooked piece if there is one, or puts a raw one on the spit. */
  private spitInteraction(): Interaction | undefined {
    const fire = this.model?.root.position;
    if (!fire || !this.isNear(CONFIG.campfire.reach)) {
      return undefined;
    }
    const feet = this.player.feet;
    const distance = Math.hypot(feet.x - fire.x, feet.z - fire.z);
    const cooked = this.slots.find((slot) => slot.state === "cooked");
    if (cooked) {
      return {
        label: "Pegar carne cozida",
        distance,
        act: () => {
          this.empty(cooked);
          this.world.provisions.add("cookedMeat");
        },
      };
    }
    if (this.world.provisions.count("rawMeat") <= 0) {
      return undefined;
    }
    const free = this.slots.find((slot) => slot.state === "empty");
    if (!free) {
      return { label: "O espeto está cheio", distance };
    }
    return {
      label: "Cozinhar carne",
      distance,
      act: () => {
        if (!this.world.provisions.take("rawMeat")) {
          return;
        }
        free.state = "cooking";
        free.seconds = 0;
        free.meat.setCooked(0);
        free.meat.flesh.setEnabled(true);
      },
    };
  }

  private update(seconds: number): void {
    const model = this.model;
    const light = this.light;
    if (!model || !light) {
      return;
    }
    // The flames breathe, like the torch's (TO3), only slower.
    this.time += seconds;
    const t = this.time;
    const wave = Math.sin(t * 9) * 0.5 + Math.sin(t * 17.3) * 0.3 + Math.sin(t * 5.1) * 0.2;
    const { lightIntensity, flicker, cookSeconds } = CONFIG.campfire;
    light.intensity = lightIntensity * (1 + wave * flicker);
    model.cores.forEach((core, index) => {
      const size = 1 + Math.sin(t * (7 + index * 2.3) + index) * 0.12;
      core.scaling.set(size, 1.8 * size, size);
    });

    for (const slot of this.slots) {
      if (slot.state !== "cooking") {
        continue;
      }
      slot.seconds += seconds;
      slot.meat.setCooked(slot.seconds / cookSeconds);
      if (slot.seconds >= cookSeconds) {
        slot.state = "cooked";
      }
    }
  }
}
