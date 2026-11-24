import { CreateSoundAsync, Observable, type Scene, type StaticSound } from "@babylonjs/core";
import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";
import type { DayClock } from "../core/dayClock";
import { frameSeconds } from "../core/gameTime";
import type { Player } from "../player/player";
import type { PlayerTorch } from "../player/torch";
import { edgeImage } from "../ui/damageEffects";
import type { ChunkManager } from "../world/chunks";
import type { NoiseSystem } from "./noise";

/**
 * Hiding in a bush (NBB-154; RF-64, MI1-A to MI10). Inside a bush, crouched and with the torch
 * out, the player is hidden: the screen edges turn leafy and nobody sees them (the visibility
 * and the creature ask `isHidden`). Going in or out of any bush rustles, which is also a noise.
 * At night, hidden too long in the same bush, the creature sniffs them out (MI5-B).
 */
export class HidingSystem {
  /** Fired when the player becomes hidden (the creature may lose them, MI3-A). */
  readonly onHid = new Observable<void>();
  /** MI5-B: fired once when the player has been hidden too long in the same bush at night. */
  readonly onSniffed = new Observable<void>();

  private readonly player: Player;
  private readonly torch: PlayerTorch;
  private readonly chunks: ChunkManager;
  private readonly clock: DayClock;
  private readonly noise: NoiseSystem;
  private readonly edges;
  private rustle: StaticSound | undefined;
  /** The bush the player is in ("chunk:index"), if any. */
  private bush: string | undefined;
  private hidden = false;
  /** Seconds hidden at night in the current bush (MI5-B); reset when leaving it. */
  private hiddenSeconds = 0;
  private sniffed = false;
  private edgeLevel = 0;

  constructor(
    scene: Scene,
    ui: AdvancedDynamicTexture,
    parts: {
      player: Player;
      torch: PlayerTorch;
      chunks: ChunkManager;
      clock: DayClock;
      noise: NoiseSystem;
    },
  ) {
    this.player = parts.player;
    this.torch = parts.torch;
    this.chunks = parts.chunks;
    this.clock = parts.clock;
    this.noise = parts.noise;
    this.edges = edgeImage("hideEdges", CONFIG.hiding.edgeColor);
    this.edges.isVisible = false;
    ui.addControl(this.edges);
    scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(scene)));
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.hiding;
    this.rustle = await CreateSoundAsync(
      "bushRustle",
      soundUrl(settings.rustleFile),
      { volume: settings.rustleVolume, outBus: audio.effects },
      audio.engine,
    );
  }

  /** MI1-A: inside a bush, crouched, with the torch out. */
  get isHidden(): boolean {
    return this.hidden;
  }

  /** Development: whether the player is hidden, for how long, and in which bush. */
  debugState(): { hidden: boolean; seconds: number; bush: string | undefined } {
    return {
      hidden: this.hidden,
      seconds: Math.round(this.hiddenSeconds * 10) / 10,
      bush: this.bush,
    };
  }

  private update(seconds: number): void {
    if (seconds <= 0) {
      return;
    }
    const settings = CONFIG.hiding;
    const feet = this.player.feet;
    const nearest = this.chunks
      .pickablesNear(feet.x, feet.z, settings.bushRadius)
      .find((pickable) => pickable.kind === "bush");
    // BM1 (NBB-163): the marsh's reeds hide like a bush.
    const reeds = nearest
      ? undefined
      : this.chunks.nearestOf("reeds", feet.x, feet.z, CONFIG.biomes.rules.reedsReach);
    const bush = nearest ? `${nearest.chunkKey}:${nearest.index}` : reeds;
    if (bush !== this.bush) {
      // MI8-B, MI10: going in or out of a bush rustles, and that is a noise.
      if (this.player.controlsEnabled) {
        this.rustle?.play();
        this.noise.emit(feet, settings.rustleNoise, "bush");
      }
      this.bush = bush;
      this.hiddenSeconds = 0;
      this.sniffed = false;
    }

    const hidden = bush !== undefined && this.player.isCrouched && !this.torch.isLit;
    if (hidden && !this.hidden) {
      this.hidden = true;
      this.onHid.notifyObservers();
    }
    this.hidden = hidden;

    // MI5-B: only at night, only in the same bush.
    if (hidden && this.clock.phase === "night") {
      this.hiddenSeconds += seconds;
      if (!this.sniffed && this.hiddenSeconds >= settings.sniffSeconds) {
        this.sniffed = true;
        this.onSniffed.notifyObservers();
      }
    }

    // MI6-A: the leafy edges fade in and out.
    const step = seconds / settings.edgeFadeSeconds;
    this.edgeLevel = Math.max(0, Math.min(1, this.edgeLevel + (hidden ? step : -step)));
    this.edges.alpha = settings.edgeAlpha * this.edgeLevel;
    this.edges.isVisible = this.edgeLevel > 0.01;
  }
}
