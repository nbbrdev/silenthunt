import type { Scene } from "@babylonjs/core";
import { Control, type AdvancedDynamicTexture, type TextBlock } from "@babylonjs/gui";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import { BIOME_NAMES, type Biome } from "../world/biomes";
import { glowingTitle, spaced } from "./menuStyle";

/**
 * BM6-A, BM8 (NBB-163): entering a new biome, its name shows quietly at the top of the screen, in
 * the menus' style: only after 5 s in it (no flicker at a border), never at the start, and not
 * the same name twice in a row.
 */
export class BiomeBanner {
  private readonly text: TextBlock;
  private readonly biome: () => Biome;
  private readonly isPlaying: () => boolean;
  /** The last name shown (or the biome the game started in). */
  private shown: Biome | undefined;
  /** The biome the player is in now, and for how long. */
  private current: Biome | undefined;
  private inCurrent = 0;
  /** Seconds since the name appeared (undefined when hidden). */
  private time: number | undefined;

  constructor(
    ui: AdvancedDynamicTexture,
    scene: Scene,
    biome: () => Biome,
    isPlaying: () => boolean,
  ) {
    this.biome = biome;
    this.isPlaying = isPlaying;
    const settings = CONFIG.biomeBanner;
    this.text = glowingTitle("", settings.size);
    this.text.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.text.top = `${settings.top * 100}%`;
    this.text.isHitTestVisible = false;
    this.text.isVisible = false;
    ui.addControl(this.text);
    scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(scene)));
  }

  private update(seconds: number): void {
    if (seconds <= 0 || !this.isPlaying()) {
      return;
    }
    const settings = CONFIG.biomeBanner;
    const here = this.biome();
    // The game's start counts as seen: its biome is never announced.
    this.shown ??= here;
    if (here !== this.current) {
      this.current = here;
      this.inCurrent = 0;
    }
    this.inCurrent += seconds;
    if (here !== this.shown && this.inCurrent >= settings.afterSeconds) {
      this.shown = here;
      this.text.text = spaced(BIOME_NAMES[here]);
      this.time = 0;
      this.text.alpha = 0;
      this.text.isVisible = true;
    }

    if (this.time === undefined) {
      return;
    }
    const { fadeInSeconds, holdSeconds, fadeOutSeconds } = settings;
    this.time += seconds;
    const t = this.time;
    if (t < fadeInSeconds) {
      this.text.alpha = t / fadeInSeconds;
    } else if (t < fadeInSeconds + holdSeconds) {
      this.text.alpha = 1;
    } else if (t < fadeInSeconds + holdSeconds + fadeOutSeconds) {
      this.text.alpha = 1 - (t - fadeInSeconds - holdSeconds) / fadeOutSeconds;
    } else {
      this.time = undefined;
      this.text.isVisible = false;
    }
  }
}
