import { Vector3, type Scene } from "@babylonjs/core";
import { Control, TextBlock, type AdvancedDynamicTexture } from "@babylonjs/gui";
import type { CreatureBrainBehavior } from "../ai/creatureBrain";
import type { PreyManager } from "../ai/preyManager";
import { CONFIG } from "../config";
import type { DayClock } from "../core/dayClock";
import { deleteSave, readSave, writeSave } from "../core/saveStore";
import type { PlayerHealth } from "../player/health";
import type { PlayerHunger } from "../player/hunger";
import type { Inventory, Stack } from "../player/inventory";
import type { Player } from "../player/player";
import type { ShotgunControl } from "../player/shotgunControl";
import type { PlayerTorch } from "../player/torch";
import type { BedManager } from "../world/beds";
import type { CabinManager } from "../world/cabins";
import type { CampfireManager, SavedFire } from "../world/campfires";
import type { ChunkManager } from "../world/chunks";
import type { StructureManager, SavedPiece } from "../world/structures";
import type { StumpField } from "../world/stumps";
import type { InteractionSystem } from "./interactions";

/** SV5: the save's format; a save of any other format is not loaded. */
const FORMAT_VERSION = 1;

/** The saved world (SV1-A). */
interface SaveData {
  version: number;
  seed: number;
  savedAt: string;
  clock: { time: number; elapsed: number };
  player: {
    feet: [number, number, number];
    view: { yaw: number; pitch: number };
    health: number;
    hunger: number;
    stamina: number;
    torchSeconds: number;
    /** When this life began (the clock's elapsed seconds), for the days survived. */
    lifeStart: number;
  };
  inventory: { slots: (Stack | null)[]; selected: number };
  chunks: Record<string, number[]>;
  killed: string[];
  structures: SavedPiece[];
  fires: SavedFire[];
  beds: BedManager["saved"];
  cabins: { opened: string[]; shotgunTaken: boolean };
  shotgunLoaded: number;
}

/** Everything the save reads from and writes back to. */
export interface SaveParts {
  clock: DayClock;
  player: Player;
  health: PlayerHealth;
  hunger: PlayerHunger;
  torch: PlayerTorch;
  inventory: Inventory;
  shotgun: ShotgunControl;
  chunks: ChunkManager;
  stumps: StumpField;
  prey: PreyManager;
  cabins: CabinManager;
  structures: StructureManager;
  campfires: CampfireManager;
  beds: BedManager;
  creature: CreatureBrainBehavior;
  interactions: InteractionSystem;
  /** When this life began (the death screen counts the days survived from it). */
  life: { start: number };
  /** What the mouse holds in the inventory screen, outside the slots. */
  heldByMouse: () => Stack | undefined;
}

/** Puts a stack into saved slots as the inventory would (same item first, then empty slots). */
function mergeInto(slots: (Stack | null)[], held: Stack): void {
  const max = CONFIG.inventory.stack[held.item];
  let left = held.count;
  for (const stack of slots) {
    if (left > 0 && stack?.item === held.item && stack.count < max) {
      const moved = Math.min(left, max - stack.count);
      stack.count += moved;
      left -= moved;
    }
  }
  for (let index = 0; index < slots.length && left > 0; index++) {
    if (!slots[index]) {
      const moved = Math.min(left, max);
      slots[index] = { item: held.item, count: moved };
      left -= moved;
    }
  }
}

/**
 * The save (NBB-147, T3-A, RF-61, SV1-A to SV5). The world is saved every 60 s, when the player
 * wakes up, when the tab is hidden or closed, and right after respawning; never while the death
 * screen is up. Opening the game continues the saved world (SV2-A). A discreet "Salvando..."
 * shows each time (SV4-A).
 */
export class SaveGame {
  private readonly parts: SaveParts;
  private readonly indicator: TextBlock;
  private sinceSave = 0;
  private indicatorLeft = 0;
  /** True once the world is loaded (or there was nothing to load): only then it may be saved. */
  private ready = false;
  /** Set while starting a new world: nothing is saved on the way out. */
  private discarding = false;

  constructor(scene: Scene, parts: SaveParts, ui: AdvancedDynamicTexture) {
    this.parts = parts;
    this.indicator = new TextBlock("savingIndicator", "Salvando...");
    this.indicator.color = "white";
    this.indicator.fontSize = 14;
    this.indicator.width = "160px";
    this.indicator.height = "22px";
    this.indicator.left = "-36px";
    this.indicator.top = "-82px";
    this.indicator.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.indicator.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.indicator.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.indicator.isVisible = false;
    ui.addControl(this.indicator);

    parts.beds.onWoke.add(() => void this.save());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        void this.save();
      }
    });
    window.addEventListener("pagehide", () => void this.save());
    scene.onBeforeRenderObservable.add(() => {
      const seconds = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
      this.indicatorLeft = Math.max(0, this.indicatorLeft - seconds);
      this.indicator.isVisible = this.indicatorLeft > 0;
      this.indicator.alpha = Math.min(1, this.indicatorLeft * 2) * 0.6;
      this.sinceSave += seconds;
      if (this.sinceSave >= CONFIG.save.everySeconds) {
        void this.save();
      }
    });
  }

  /** SV2-A: continues the saved world, if there is one. True if it loaded one. */
  async load(): Promise<boolean> {
    try {
      const data = (await readSave()) as SaveData | undefined;
      if (!data) {
        return false;
      }
      if (data.version !== FORMAT_VERSION) {
        // SV5: a save this version cannot read: a new world, with a warning.
        await deleteSave();
        this.parts.interactions.say("O mundo salvo era de uma versão antiga");
        return false;
      }
      this.apply(data);
      return true;
    } catch (error: unknown) {
      console.warn("O mundo salvo não pôde ser lido:", error);
      return false;
    } finally {
      this.ready = true;
      this.sinceSave = 0;
    }
  }

  /** Saves now (unless the player is dead or sleeping, SV3). */
  async save(): Promise<void> {
    const { health, beds } = this.parts;
    this.sinceSave = 0;
    if (!this.ready || this.discarding || health.isDead || beds.isSleeping) {
      return;
    }
    try {
      await writeSave(this.collect());
      this.indicatorLeft = 1.5;
    } catch (error: unknown) {
      console.warn("O mundo não pôde ser salvo:", error);
    }
  }

  /** Development only (SV2-A): forgets the saved world and starts a new one. */
  async newWorld(): Promise<void> {
    this.discarding = true;
    await deleteSave();
    window.location.reload();
  }

  private collect(): SaveData {
    const p = this.parts;
    const feet = p.player.feet;
    const slots = p.inventory.saved;
    const held = p.heldByMouse();
    if (held) {
      mergeInto(slots, held);
    }
    return {
      version: FORMAT_VERSION,
      seed: CONFIG.world.defaultSeed,
      savedAt: new Date().toISOString(),
      clock: { time: p.clock.time, elapsed: p.clock.elapsed },
      player: {
        feet: [feet.x, feet.y, feet.z],
        view: p.player.view,
        health: p.health.value,
        hunger: p.hunger.value,
        stamina: p.player.stamina,
        torchSeconds: p.torch.remainingSeconds,
        lifeStart: p.life.start,
      },
      inventory: { slots, selected: p.inventory.selected },
      chunks: p.chunks.changes,
      killed: p.prey.killedIds,
      structures: p.structures.saved,
      fires: p.campfires.saved,
      beds: p.beds.saved,
      cabins: p.cabins.state,
      shotgunLoaded: p.shotgun.cartridges.loaded,
    };
  }

  private apply(data: SaveData): void {
    const p = this.parts;
    p.clock.restore(data.clock.time, data.clock.elapsed);
    p.chunks.restoreChanges(data.chunks);
    p.stumps.rebuild(p.chunks);
    p.prey.restoreKilled(data.killed);
    p.cabins.restore(data.cabins);
    p.structures.restore(data.structures);
    p.campfires.restore(data.fires);
    p.beds.restore(data.beds);
    p.inventory.restore(data.inventory.slots, data.inventory.selected);
    p.shotgun.loadedCartridges = data.shotgunLoaded;
    p.health.restore(data.player.health);
    p.hunger.set(data.player.hunger);
    p.player.stamina = data.player.stamina;
    p.torch.restore(data.player.torchSeconds);
    p.life.start = data.player.lifeStart;
    const [x, y, z] = data.player.feet;
    p.player.respawn(new Vector3(x, y, z));
    p.player.view = data.player.view;
    // SV1-A: the creature is not saved: it starts far away.
    p.creature.sendAway();
  }
}
