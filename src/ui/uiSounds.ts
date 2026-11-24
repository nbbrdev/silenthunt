import { CONFIG } from "../config";
import { soundUrl } from "../core/audio";

/** FX3-A, FX12-A, FX15: what the menus' click says. */
export type UiSound = "hover" | "confirm" | "back";

/**
 * The menus' click (NBB-162; FX3-A, FX12-A, FX15): one small wooden click, higher and soft when
 * passing over an option, lower and fuller when confirming, lower and softer when going back. It
 * plays apart from the game's sound engine, which the pause stops: the clicks are heard in every
 * menu while the world stays silent. Its volume follows the options' general and effects volumes.
 */
class UiSounds {
  private readonly pool: HTMLAudioElement[] = [];
  private next = 0;
  /** The options' general × effects volume (set by the game once the options are read). */
  private gain: () => number = () => 1;

  setGain(gain: () => number): void {
    this.gain = gain;
  }

  play(kind: UiSound): void {
    const settings = CONFIG.uiSounds;
    if (this.pool.length === 0) {
      for (let i = 0; i < settings.voices; i++) {
        const audio = new Audio(soundUrl(settings.file));
        audio.preload = "auto";
        // The pitch follows the speed (an old record), so the click sounds higher or lower.
        audio.preservesPitch = false;
        this.pool.push(audio);
      }
    }
    const audio = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    if (!audio) {
      return;
    }
    const { volume, rate } = settings[kind];
    audio.volume = Math.max(0, Math.min(1, volume * this.gain()));
    audio.playbackRate = rate;
    audio.currentTime = 0;
    // Before the first click on the page the browser may refuse: nothing to hear then.
    void audio.play().catch(() => undefined);
  }
}

export const uiSounds = new UiSounds();
