import { CONFIG } from "../config";
import type { GameAudio } from "./audio";

/**
 * The player's options (NBB-150, MN4): mouse sensitivity and the volumes, kept in the browser
 * apart from the world (a new world does not reset them). Each volume scales its group's own
 * volume from CONFIG (SM7); the sensitivity scales the base one.
 */
export interface GameOptions {
  /** 0.25 to 2 (1 = the base sensitivity). */
  sensitivity: number;
  /** 0 to 1 each. */
  master: number;
  effects: number;
  ambience: number;
  music: number;
}

const STORAGE_KEY = "silenthunt.options";
const DEFAULTS: GameOptions = { sensitivity: 1, master: 1, effects: 1, ambience: 1, music: 1 };

export function loadOptions(): GameOptions {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const options = { ...DEFAULTS };
    if (saved && typeof saved === "object") {
      for (const key of Object.keys(DEFAULTS) as (keyof GameOptions)[]) {
        const value = (saved as Record<string, unknown>)[key];
        if (typeof value === "number" && Number.isFinite(value)) {
          options[key] = value;
        }
      }
    }
    return options;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveOptions(options: GameOptions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Without storage (private window, full disk) the options last only for this session.
  }
}

/**
 * NBB-164 (AG14): underwater, the effects and the ambience are muffled to this share (1 = as
 * usual). Set by the swimming system, which calls `applyVolumes` again.
 */
export const muffle = { share: 1 };

/** Sets the volumes of the audio engine and its groups from the options. */
export function applyVolumes(options: GameOptions, audio: GameAudio): void {
  const { masterVolume, groups } = CONFIG.audio;
  audio.engine.volume = masterVolume * options.master;
  audio.effects.volume = groups.effects * options.effects * muffle.share;
  audio.ambience.volume = groups.ambience * options.ambience * muffle.share;
  audio.music.volume = groups.music * options.music;
}
