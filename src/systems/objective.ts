import type { Scene } from "@babylonjs/core";
import {
  Button,
  Control,
  StackPanel,
  TextBlock,
  type AdvancedDynamicTexture,
} from "@babylonjs/gui";
import type { CreatureBrainBehavior } from "../ai/creatureBrain";
import type { CreaturePresence } from "../ai/creaturePresence";
import { CONFIG } from "../config";
import type { DayClock } from "../core/dayClock";
import { frameSeconds } from "../core/gameTime";
import type { Input } from "../core/input";
import { setCreatureEyeRedness } from "../models/creature/creature";
import type { Equipment } from "../player/equipment";
import type { Inventory, Stack } from "../player/inventory";
import { RADIO_PARTS, type ItemId, type Recipe } from "../player/items";
import type { Player } from "../player/player";
import type { InventoryScreen } from "../ui/inventoryScreen";
import type { NotePanel } from "../ui/notePanel";
import type { VictoryScreen } from "../ui/victoryScreen";
import type { Atmosphere } from "../world/atmosphere";
import { objectiveCabins, type CabinSite } from "../world/cabinSites";
import type { CabinManager } from "../world/cabins";
import type { CampfireManager } from "../world/campfires";
import type { InteractionSystem } from "./interactions";
import {
  DIARY,
  INTRO_TEXT,
  NOTES,
  OBJECTIVE_WORDS,
  directionName,
  type NoteText,
} from "./objectiveTexts";

/** NBB-156: the way out, as saved (all optional fields: older saves load without them, MO6-A). */
export interface SavedObjective {
  /** The notes read, by key ("note0" to "note3", "diary0" to "diary2"). */
  notes: string[];
  radioCalled: boolean;
  lastNight: boolean;
  rescued: boolean;
  banished: boolean;
  deaths: number;
  introShown: boolean;
}

/** What the objective works with. */
export interface ObjectiveParts {
  scene: Scene;
  ui: AdvancedDynamicTexture;
  input: Input;
  player: Player;
  inventory: Inventory;
  inventoryScreen: InventoryScreen;
  equipment: Equipment;
  interactions: InteractionSystem;
  cabins: CabinManager;
  campfires: CampfireManager;
  clock: DayClock;
  atmosphere: Atmosphere;
  creature: CreatureBrainBehavior;
  presence: CreaturePresence;
  notes: NotePanel;
  victory: VictoryScreen;
  seed: number;
  /** True while the player is in the game (no menu open). */
  isPlaying: () => boolean;
}

/**
 * The way out (NBB-156; RF-66 to RF-68, OB1 to OB13). Three cabins hold the radio's parts; their
 * notes lead from one to the next and a hunter's diary tells of a ritual. With the radio built
 * and called, the rescue comes at the next dawn, after a last, red night. Burning three deer
 * skulls in a fire at night, with the creature near, banishes it for good. Either way ends with
 * a victory screen, and the game goes on.
 */
export class ObjectiveSystem {
  private readonly p: ObjectiveParts;
  private readonly sites: CabinSite[];
  private readonly read = new Set<string>();
  private radioCalled = false;
  private lastNight = false;
  private rescued = false;
  private banished = false;
  private deaths = 0;
  private introShown = false;
  /** The last night's red, from 0 to 1, easing toward its target. */
  private redness = 0;
  private readonly intro: TextBlock;
  private introLeft = 0;
  private readonly hint: TextBlock;
  private readonly sideList: StackPanel;
  /** Seconds left before the ritual's victory shows (0: none on the way). */
  private banishVictoryIn = 0;

  constructor(parts: ObjectiveParts) {
    this.p = parts;
    this.sites = objectiveCabins(parts.seed);
    // OB6-A: a new world shows the opening sentence; a loaded one says (restore) whether it did.

    // OB6-A: the opening sentence, high on the screen.
    this.intro = new TextBlock("objectiveIntro", "");
    this.intro.color = "white";
    this.intro.fontSize = 22;
    this.intro.height = "40px";
    this.intro.top = "-140px";
    this.intro.isVisible = false;
    parts.ui.addControl(this.intro);

    // OB13: with the radio in hand, what the left button does.
    this.hint = new TextBlock("radioHint", "");
    this.hint.color = "white";
    this.hint.alpha = 0.7;
    this.hint.fontSize = 16;
    this.hint.height = "24px";
    this.hint.top = "60px";
    this.hint.isVisible = false;
    parts.ui.addControl(this.hint);

    // OB12: the "Anotações" column of the inventory screen.
    const side = parts.inventoryScreen.sidePanel;
    const title = new TextBlock("notesTitle", OBJECTIVE_WORDS.notesTitle);
    title.color = "white";
    title.fontSize = 18;
    title.height = "30px";
    title.top = "12px";
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    side.addControl(title);
    this.sideList = new StackPanel("notesList");
    this.sideList.top = "50px";
    this.sideList.paddingLeft = "16px";
    this.sideList.paddingRight = "16px";
    this.sideList.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    side.addControl(this.sideList);
    parts.inventoryScreen.onToggled.add((open) => {
      if (open) {
        this.fillSidePanel();
      }
    });
    parts.inventoryScreen.recipeVisible = (recipe: Recipe) =>
      recipe.item !== "radio" || this.partsHeld() === RADIO_PARTS.length;

    // OB12: the chests on the way out hold a part, a note and a diary page.
    parts.cabins.extraContents = (site) => this.chestContents(site);
    parts.interactions.add(() => this.ritualInteraction());

    parts.clock.onNightfall.add(() => {
      if (this.radioCalled && !this.lastNight && !this.rescued) {
        this.startLastNight();
      }
    });
    parts.clock.onDaybreak.add(() => {
      if (this.lastNight) {
        this.endLastNight();
        this.rescued = true;
        this.radioCalled = false;
        this.showVictory(OBJECTIVE_WORDS.rescuedTitle);
      }
    });

    parts.scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(parts.scene)));
  }

  /** OB12: where the way out stands, for the pause menu and the "Anotações" column. */
  get progress(): string[] {
    const lines: string[] = [];
    if (!this.rescued) {
      if (this.radioCalled) {
        lines.push("O resgate chega ao amanhecer");
      } else if (this.p.inventory.count("radio") > 0) {
        lines.push("Rádio montado: chame o resgate");
      } else {
        lines.push(`Rádio: ${this.partsHeld()} de ${RADIO_PARTS.length} peças`);
      }
    }
    if (this.read.has("diary1") && !this.banished) {
      const skulls = Math.min(this.p.inventory.count("deerSkull"), CONFIG.objective.ritualSkulls);
      lines.push(`Crânios: ${skulls} de ${CONFIG.objective.ritualSkulls}`);
    }
    return lines;
  }

  /** NBB-157 (MP3-A): the cabins a note read points to (the map shows them before the visit). */
  get knownCabins(): { x: number; z: number }[] {
    const known: { x: number; z: number }[] = [];
    this.sites.forEach((site, step) => {
      const pointedTo = step > 0 && this.read.has(`note${step - 1}`);
      if (pointedTo) {
        known.push({ x: site.x, z: site.z });
      }
    });
    return known;
  }

  /** True while the last night is on (the red, the creature without mercy). */
  get isLastNight(): boolean {
    return this.lastNight;
  }

  /**
   * GF5-B, OB12: the player died. Counted for the victory screen; dying the last night means the
   * rescue does not find them (the radio can call again the next day). Called before the clock
   * skips to dawn.
   */
  playerDied(): void {
    this.deaths++;
    if (this.lastNight) {
      this.endLastNight();
    }
    this.radioCalled = false;
  }

  get saved(): SavedObjective {
    return {
      notes: [...this.read],
      radioCalled: this.radioCalled,
      lastNight: this.lastNight,
      rescued: this.rescued,
      banished: this.banished,
      deaths: this.deaths,
      introShown: this.introShown,
    };
  }

  restore(saved: Partial<SavedObjective>): void {
    for (const key of saved.notes ?? []) {
      this.read.add(key);
    }
    this.radioCalled = saved.radioCalled ?? false;
    this.rescued = saved.rescued ?? false;
    this.deaths = saved.deaths ?? 0;
    this.introShown = saved.introShown ?? true;
    if (saved.banished) {
      this.banished = true;
      this.p.creature.banish(true);
    }
    if (saved.lastNight && this.p.clock.phase === "night") {
      this.startLastNight();
      this.redness = 1;
    }
  }

  /** Development: the state of the way out and where its cabins are. */
  debugState(): object {
    return {
      ...this.saved,
      progress: this.progress,
      cabins: this.sites.map((site) => ({
        step: site.step,
        at: [Math.round(site.x), Math.round(site.z)],
      })),
    };
  }

  /** Development: calls the rescue now, as the radio would. */
  debugCallRescue(): void {
    this.callRescue();
  }

  private update(seconds: number): void {
    // OB6-A: the opening sentence, once, when the new world is first played.
    if (!this.introShown && this.p.isPlaying()) {
      this.introShown = true;
      const first = this.sites[0];
      const { spawn } = CONFIG.player;
      if (first) {
        this.intro.text = INTRO_TEXT.replace(
          "{direção}",
          directionName(spawn.x, spawn.z, first.x, first.z),
        );
        this.introLeft = CONFIG.objective.introSeconds;
      }
    }
    this.introLeft = Math.max(0, this.introLeft - seconds);
    this.intro.isVisible =
      this.introLeft > 0 && !this.p.inventoryScreen.isOpen && !this.p.notes.isOpen;
    this.intro.alpha = Math.min(1, this.introLeft) * 0.9;

    // OB12: the radio in hand calls the rescue with the left button.
    const holdingRadio = this.p.equipment.current === "radio";
    const canCall = holdingRadio && !this.radioCalled && !this.rescued;
    this.hint.isVisible = canCall && this.p.player.controlsEnabled;
    this.hint.text = `Clique: ${OBJECTIVE_WORDS.callRescue}`;
    if (canCall && this.p.player.controlsEnabled && this.p.input.wasPressed("Mouse0")) {
      this.callRescue();
    }

    if (this.banishVictoryIn > 0) {
      this.banishVictoryIn -= seconds;
      if (this.banishVictoryIn <= 0) {
        this.banishVictoryIn = 0;
        this.showVictory(OBJECTIVE_WORDS.banishedTitle);
      }
    }

    // OB4-A, OB12: the red comes in and goes away slowly.
    if (seconds > 0) {
      const target = this.lastNight ? 1 : 0;
      const step = seconds / CONFIG.objective.lastNight.fadeSeconds;
      this.redness += Math.max(-step, Math.min(step, target - this.redness));
      this.p.atmosphere.redness = this.redness;
      setCreatureEyeRedness(this.p.scene, this.redness);
    }
  }

  private callRescue(): void {
    if (this.radioCalled || this.rescued) {
      return;
    }
    this.radioCalled = true;
    this.p.interactions.say(OBJECTIVE_WORDS.rescueComing);
    // At night the current night becomes the last one; by day, the next one will be.
    if (this.p.clock.phase === "night") {
      this.startLastNight();
    }
  }

  private startLastNight(): void {
    this.lastNight = true;
    this.p.creature.lastNight = true;
  }

  private endLastNight(): void {
    this.lastNight = false;
    this.p.creature.lastNight = false;
  }

  private showVictory(title: string): void {
    const { player, input, clock, inventoryScreen } = this.p;
    inventoryScreen.close(false);
    player.controlsEnabled = false;
    input.pointerLockEnabled = false;
    const days = Math.floor(clock.elapsed / clock.cycleSeconds);
    this.p.victory.show(title, days, this.deaths);
  }

  /** How many of the radio's parts the player has (all three once the radio is built). */
  private partsHeld(): number {
    if (this.p.inventory.count("radio") > 0 || this.radioCalled || this.rescued) {
      return RADIO_PARTS.length;
    }
    return RADIO_PARTS.filter((part) => this.p.inventory.count(part) > 0).length;
  }

  /** OB12: what a chest on the way out holds, beyond its cartridges. */
  private chestContents(
    site: CabinSite,
  ): { items: Stack[]; found: string[]; onTaken: () => void } | undefined {
    const step = site.step;
    if (step === undefined) {
      return undefined;
    }
    const part: ItemId | undefined = step > 0 ? RADIO_PARTS[step - 1] : undefined;
    const items: Stack[] = part ? [{ item: part, count: 1 }] : [];
    const notes: { key: string; text: NoteText }[] = [];
    const note = NOTES[step];
    if (note) {
      notes.push({ key: `note${step}`, text: this.fillNote(note, step) });
    }
    const page = DIARY[step];
    if (page) {
      notes.push({ key: `diary${step}`, text: page });
    }
    const found: string[] = [];
    if (part) {
      found.push(PART_WORDS[part] ?? part);
    }
    if (note) {
      found.push("um bilhete");
    }
    if (page) {
      found.push("uma página de diário");
    }
    return {
      items,
      found,
      onTaken: () => {
        for (const { key } of notes) {
          this.read.add(key);
        }
        this.p.notes.show(notes.map(({ text }) => text));
      },
    };
  }

  /** A note with its next cabin's direction and distance (OB3-A, OB12). */
  private fillNote(note: NoteText, step: number): NoteText {
    const here = this.sites[step];
    const next = this.sites[step + 1];
    if (!here || !next) {
      return note;
    }
    const meters = Math.hypot(next.x - here.x, next.z - here.z);
    const rounded = Math.max(
      CONFIG.objective.noteDistanceStep,
      Math.round(meters / CONFIG.objective.noteDistanceStep) * CONFIG.objective.noteDistanceStep,
    );
    const text = note.text
      .replace("{distância}", String(rounded))
      .replace("{direção}", directionName(here.x, here.z, next.x, next.z));
    return { title: note.title, text };
  }

  /** The notes read so far, in the order they were found along the way. */
  private readNotes(): NoteText[] {
    const list: NoteText[] = [];
    for (let step = 0; step < NOTES.length; step++) {
      const note = NOTES[step];
      if (note && this.read.has(`note${step}`)) {
        list.push(this.fillNote(note, step));
      }
      const page = DIARY[step];
      if (page && this.read.has(`diary${step}`)) {
        list.push(page);
      }
    }
    return list;
  }

  /** OB12: the progress lines and a button per note read, to read it again. */
  private fillSidePanel(): void {
    this.sideList.clearControls();
    for (const line of this.progress) {
      const text = new TextBlock(`notesProgress-${line}`, line);
      text.color = "rgba(255, 255, 255, 0.85)";
      text.fontSize = 15;
      text.height = "24px";
      text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      this.sideList.addControl(text);
    }
    const gap = new TextBlock("notesGap", "");
    gap.height = "12px";
    this.sideList.addControl(gap);
    for (const note of this.readNotes()) {
      const button = Button.CreateSimpleButton(`note-${note.title}`, note.title);
      button.height = "34px";
      button.paddingTop = "4px";
      button.color = "rgba(255, 255, 255, 0.85)";
      button.background = "rgba(255, 255, 255, 0.06)";
      button.thickness = 0;
      button.cornerRadius = 4;
      button.fontSize = 15;
      button.onPointerUpObservable.add(() => this.p.notes.show([note]));
      this.sideList.addControl(button);
    }
  }

  /**
   * OB8-A, OB12: the ritual at a lit fire: with the three skulls, at night and with the creature
   * near, holding E burns them. With a skull in hand, the fire says what is missing.
   */
  private ritualInteraction(): ReturnType<Parameters<InteractionSystem["add"]>[0]> {
    if (this.banished) {
      return undefined;
    }
    const { player, inventory, campfires, clock, creature, equipment } = this.p;
    const settings = CONFIG.objective;
    const feet = player.feet;
    let nearest: number | undefined;
    for (const fire of campfires.list) {
      const [x = 0, , z = 0] = fire.at;
      const distance = Math.hypot(x - feet.x, z - feet.z);
      if (fire.fuel > 0 && distance <= CONFIG.campfire.reach && distance < (nearest ?? Infinity)) {
        nearest = distance;
      }
    }
    if (nearest === undefined) {
      return undefined;
    }
    const skullInHand = equipment.current === "deerSkull";
    const enoughSkulls = inventory.count("deerSkull") >= settings.ritualSkulls;
    if (!enoughSkulls) {
      return undefined;
    }
    if (clock.phase !== "night") {
      return skullInHand ? { label: OBJECTIVE_WORDS.onlyAtNight, distance: nearest } : undefined;
    }
    if (creature.playerDistance > settings.ritualCreatureDistance) {
      return skullInHand ? { label: OBJECTIVE_WORDS.needCreature, distance: nearest } : undefined;
    }
    return {
      label: OBJECTIVE_WORDS.burnSkulls,
      // Ahead of the fire's own actions, which are at the same distance.
      distance: nearest - 0.01,
      id: "ritual",
      holdSeconds: settings.ritualHoldSeconds,
      sound: "ignite",
      act: () => this.banish(),
    };
  }

  /** OB10-A, OB12: the skulls burn; it growls, runs off and is gone; the ritual's victory. */
  private banish(): void {
    const { inventory, creature, presence } = this.p;
    if (!inventory.remove("deerSkull", CONFIG.objective.ritualSkulls)) {
      return;
    }
    this.banished = true;
    presence.growlNow();
    creature.banish();
    if (this.lastNight) {
      this.endLastNight();
    }
    // The victory once it has run off (game time: a pause holds it).
    this.banishVictoryIn = CONFIG.objective.banishFleeSeconds;
  }
}

/** OB12: the parts as said in "Você encontrou: ...". */
const PART_WORDS: Partial<Record<ItemId, string>> = {
  battery: "a bateria",
  antenna: "a antena",
  tubes: "as válvulas",
};
