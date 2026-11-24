import { Observable } from "@babylonjs/core";
import { CONFIG } from "../config";

export type DayPhase = "dawn" | "day" | "dusk" | "night";

/**
 * Game time of day (RF-05, G4). The cycle starts at dawn: dawn → day → dusk (all part of the
 * 10-minute day) → night (6 minutes). Other systems listen to `onNightfall` and `onDaybreak`
 * (the creature hunts at night, M5-B; sleeping skips to dawn, RF-62).
 */
export class DayClock {
  readonly onPhaseChanged = new Observable<DayPhase>();
  /** "Anoiteceu": fired when night begins. */
  readonly onNightfall = new Observable<void>();
  /** "Amanheceu": fired when dawn begins. */
  readonly onDaybreak = new Observable<void>();
  /** Time multiplier (1 = normal). The dev key T sets it to CONFIG.dayNight.devFastForward. */
  speed = 1;

  private seconds: number;
  private currentPhase: DayPhase;
  /** Game seconds lived since the start (jumps made with setTime do not count). */
  private elapsedSeconds = 0;

  constructor(startSeconds = CONFIG.dayNight.startSeconds) {
    this.seconds = startSeconds % cycleLength();
    this.currentPhase = phaseAt(this.seconds);
  }

  /** Game seconds since the game started (VD4 counts the days survived with it). */
  get elapsed(): number {
    return this.elapsedSeconds;
  }

  /** Length of a whole day and night cycle (seconds). */
  get cycleSeconds(): number {
    return cycleLength();
  }

  /** Seconds since dawn began, within the current cycle. */
  get time(): number {
    return this.seconds;
  }

  get phase(): DayPhase {
    return this.currentPhase;
  }

  /**
   * NBB-159 (CI5-A): while the main menu's film runs, light, fog and sounds show the night,
   * whatever the saved time (the time itself is not touched).
   */
  presentNight = false;

  /** 1 in full daylight, 0 at night, easing in between during dawn and dusk. */
  get daylight(): number {
    if (this.presentNight) {
      return 0;
    }
    const { daySeconds, dawnSeconds, duskSeconds } = CONFIG.dayNight;
    const t = this.seconds;
    if (t < dawnSeconds) {
      return smooth(t / dawnSeconds);
    }
    if (t < daySeconds - duskSeconds) {
      return 1;
    }
    if (t < daySeconds) {
      return smooth(1 - (t - (daySeconds - duskSeconds)) / duskSeconds);
    }
    return 0;
  }

  /** 0..1, highest in the middle of dawn and dusk: drives the orange tint. */
  get warmth(): number {
    if (this.presentNight) {
      return 0;
    }
    const { daySeconds, dawnSeconds, duskSeconds } = CONFIG.dayNight;
    const t = this.seconds;
    if (t < dawnSeconds) {
      return Math.sin((t / dawnSeconds) * Math.PI);
    }
    if (t >= daySeconds - duskSeconds && t < daySeconds) {
      return Math.sin(((t - (daySeconds - duskSeconds)) / duskSeconds) * Math.PI);
    }
    return 0;
  }

  /** 0 at dawn to 1 at the end of dusk: how far the sun has crossed the sky. */
  get sunProgress(): number {
    return Math.min(this.seconds / CONFIG.dayNight.daySeconds, 1);
  }

  /** Advances the clock by real seconds (multiplied by `speed`). */
  update(realSeconds: number): void {
    this.elapsedSeconds += realSeconds * this.speed;
    this.setTime(this.seconds + realSeconds * this.speed);
  }

  /** NBB-147: back to a saved time of day and time lived. */
  restore(time: number, elapsed: number): void {
    this.elapsedSeconds = elapsed;
    this.setTime(time);
  }

  /**
   * RF-62 / DO1: sleeping skips ahead to the next dawn; the skipped time counts as lived (the
   * days survived, VD4). Returns how many seconds were skipped.
   */
  skipToDawn(): number {
    const skipped = cycleLength() - this.seconds;
    this.elapsedSeconds += skipped;
    this.setTime(0);
    return skipped;
  }

  /** Jumps to a time of the cycle (seconds since dawn began). */
  setTime(seconds: number): void {
    const cycle = cycleLength();
    this.seconds = ((seconds % cycle) + cycle) % cycle;
    const phase = phaseAt(this.seconds);
    if (phase !== this.currentPhase) {
      this.currentPhase = phase;
      this.onPhaseChanged.notifyObservers(phase);
      if (phase === "night") {
        this.onNightfall.notifyObservers();
      } else if (phase === "dawn") {
        this.onDaybreak.notifyObservers();
      }
    }
  }
}

function cycleLength(): number {
  return CONFIG.dayNight.daySeconds + CONFIG.dayNight.nightSeconds;
}

function phaseAt(seconds: number): DayPhase {
  const { daySeconds, dawnSeconds, duskSeconds } = CONFIG.dayNight;
  if (seconds < dawnSeconds) {
    return "dawn";
  }
  if (seconds < daySeconds - duskSeconds) {
    return "day";
  }
  if (seconds < daySeconds) {
    return "dusk";
  }
  return "night";
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
