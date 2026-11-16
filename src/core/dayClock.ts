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

  constructor(startSeconds = CONFIG.dayNight.startSeconds) {
    this.seconds = startSeconds % cycleLength();
    this.currentPhase = phaseAt(this.seconds);
  }

  /** Seconds since dawn began, within the current cycle. */
  get time(): number {
    return this.seconds;
  }

  get phase(): DayPhase {
    return this.currentPhase;
  }

  /** 1 in full daylight, 0 at night, easing in between during dawn and dusk. */
  get daylight(): number {
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
    this.setTime(this.seconds + realSeconds * this.speed);
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
