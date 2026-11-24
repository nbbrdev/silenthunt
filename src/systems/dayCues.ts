import type { Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { DayClock } from "../core/dayClock";
import type { DayMessage } from "../ui/dayMessage";
import type { MusicPlayer } from "./music";

/** What the day's cues look at. */
export interface DayCueParts {
  scene: Scene;
  clock: DayClock;
  music: MusicPlayer;
  message: DayMessage;
  /** In the game (no menu open): a phase the menu's loading brings is no cue. */
  isPlaying: () => boolean;
  isDead: () => boolean;
  /** MF16: the dusk's bell keeps quiet during a chase. */
  isChased: () => boolean;
  /** The victory's screen is up (the rescue's dawn has no cue of its own). */
  isVictory: () => boolean;
}

/**
 * NBB-161 (MF10-B, MF11-A, MF13-B, MF14-B, MF16): the day's turns, heard and read. At dawn, a
 * sudden short piece and "VOCÊ SOBREVIVEU" (the night lived awake) or "AMANHECER" (after sleeping);
 * after a death, nothing (its own screen said it). At dusk, a bell and "A NOITE CHEGA".
 */
export class DayCues {
  private readonly p: DayCueParts;
  /** The clock's time of the cycle on the last frame (to tell a night lived from a skip). */
  private lastTime: number;
  /** A dawn heard this frame, decided on the next (the rescue's victory may have opened). */
  private pendingDawn: "lived" | "slept" | undefined;

  constructor(parts: DayCueParts) {
    this.p = parts;
    this.lastTime = parts.clock.time;
    parts.clock.onDaybreak.add(() => this.onDawn());
    parts.clock.onPhaseChanged.add((phase) => {
      if (phase === "dusk") {
        this.onDusk();
      }
    });
    parts.scene.onBeforeRenderObservable.add(() => this.update());
  }

  /** Development (MF16): the dawn's message as after a night lived. */
  debugDawn(): void {
    this.showDawn("lived");
  }

  private onDawn(): void {
    const p = this.p;
    if (!p.isPlaying() || p.isDead()) {
      return;
    }
    // A night lived ends near the end of the cycle; sleeping jumps over a good part of it.
    const cycle = p.clock.cycleSeconds;
    const skipped = cycle - this.lastTime > CONFIG.dayMessage.skipSeconds;
    this.pendingDawn = skipped ? "slept" : "lived";
  }

  private onDusk(): void {
    const p = this.p;
    if (!p.isPlaying() || p.isDead() || p.isChased()) {
      return;
    }
    p.music.playCue("dusk");
    p.message.show("A noite chega", `Noite ${this.dayNumber()}`);
  }

  private update(): void {
    this.lastTime = this.p.clock.time;
    const dawn = this.pendingDawn;
    if (dawn === undefined) {
      return;
    }
    this.pendingDawn = undefined;
    if (!this.p.isVictory()) {
      this.showDawn(dawn);
    }
  }

  private showDawn(how: "lived" | "slept"): void {
    this.p.music.playCue("dawn");
    const day = this.dayNumber();
    if (how === "lived") {
      this.p.message.show("Você sobreviveu", `Noite ${day - 1}`);
    } else {
      this.p.message.show("Amanhecer", `Dia ${day}`);
    }
  }

  /**
   * The day under way (1 on the first), counted over the whole world: the dawns since the world
   * began, which began in the morning (RF-05), not at dawn.
   */
  private dayNumber(): number {
    const clock = this.p.clock;
    const dawnsSoFar =
      (clock.elapsed - clock.time + CONFIG.dayNight.startSeconds) / clock.cycleSeconds;
    return Math.round(dawnsSoFar) + 1;
  }
}
