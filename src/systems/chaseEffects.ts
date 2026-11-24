import { CreateSoundAsync, SoundState, type Scene, type StaticSound } from "@babylonjs/core";
import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import type { CreatureBrainBehavior } from "../ai/creatureBrain";
import type { CreaturePresence } from "../ai/creaturePresence";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";
import { frameSeconds } from "../core/gameTime";
import type { Player } from "../player/player";
import { edgeImage } from "../ui/damageEffects";

/**
 * The chase as the player feels it (NBB-153; PS3, PS4-A, PS6-A, PS7-C). While the creature runs
 * after the player, a heartbeat beats faster as it closes in and the screen edges darken with
 * each beat; at each of its footsteps closer than 10 m the view shakes. When the chase ends the
 * heart calms down over a few seconds. Apart from the chase, the player pants when out of breath.
 */
export class ChaseEffects {
  private readonly player: Player;
  private readonly creature: CreatureBrainBehavior;
  private readonly edges;
  private heartbeat: StaticSound | undefined;
  private panting: StaticSound | undefined;
  /** MT1-C, MT2: the chase music and how loud it is now (0 to 1). */
  private music: StaticSound | undefined;
  private musicLevel = 0;
  private privateMusic = false;
  /** 0 (calm) to 1 (the creature right behind). */
  private intensity = 0;
  private untilBeat = 0;
  /** Each beat's pulse on the edges, fading from 1. */
  private pulse = 0;
  private pantLevel = 0;
  /** GF8: the player was caught: everything stays silent until the respawn. */
  private silenced = false;
  /** FX15: the heart's last beats still to come (seconds after death) and the time since it. */
  private lastBeats: number[] = [];
  private sinceDeath = 0;

  constructor(
    scene: Scene,
    ui: AdvancedDynamicTexture,
    player: Player,
    creature: CreatureBrainBehavior,
    presence: CreaturePresence,
  ) {
    this.player = player;
    this.creature = creature;
    this.edges = edgeImage("chaseEdges", "rgba(0, 0, 0, 1)");
    this.edges.isVisible = false;
    ui.addControl(this.edges);
    presence.onStep.add(() => this.shakeAtStep());
    scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(scene)));
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.chase;
    const [heartbeat, panting] = await Promise.all([
      CreateSoundAsync(
        "heartbeat",
        soundUrl(settings.heartbeatFile),
        { maxInstances: 2, outBus: audio.effects },
        audio.engine,
      ),
      CreateSoundAsync(
        "panting",
        soundUrl(settings.pantingFile),
        { loop: true, volume: 0, outBus: audio.effects },
        audio.engine,
      ),
    ]);
    panting.play();
    this.heartbeat = heartbeat;
    this.panting = panting;
    this.music = await this.loadMusic(audio);
  }

  /** True if the chase plays a track from the private folder (the credits name it, MN5-A). */
  get usesPrivateMusic(): boolean {
    return this.privateMusic;
  }

  /**
   * MT1-C: a track from `assets-private/music/chase/` if there is one (listed at
   * `/music/chase.json`), otherwise the one that comes with the game (CC0).
   */
  private async loadMusic(audio: GameAudio): Promise<StaticSound> {
    const settings = CONFIG.chase;
    let url = soundUrl(settings.musicFile);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}music/chase.json`);
      const list: unknown = response.ok ? await response.json() : [];
      const name = Array.isArray(list) ? list.find((item) => typeof item === "string") : undefined;
      if (typeof name === "string") {
        url = `${import.meta.env.BASE_URL}music/chase/${encodeURIComponent(name)}`;
        this.privateMusic = true;
      }
    } catch {
      // No list: the game's own track.
    }
    return CreateSoundAsync(
      "chaseMusic",
      url,
      { loop: true, volume: 0, outBus: audio.music },
      audio.engine,
    );
  }

  /** Development: how strong the chase feels now (0 to 1). */
  get debugIntensity(): number {
    return Math.round(this.intensity * 100) / 100;
  }

  /** Development: the chase music's level (0 to 1), whether it plays and where it comes from. */
  get debugMusic(): { level: number; playing: boolean; private: boolean } {
    return {
      level: Math.round(this.musicLevel * 100) / 100,
      playing: this.music?.state === SoundState.Started,
      private: this.privateMusic,
    };
  }

  /**
   * GF8 (NBB-155): caught, the heart, the panting and the chase music stop at once (not over
   * 3 s, the exception to MT2) and the edges clear, until `resume()`.
   */
  silence(): void {
    this.silenced = true;
    this.intensity = 0;
    this.pulse = 0;
    this.pantLevel = 0;
    this.musicLevel = 0;
    this.edges.alpha = 0;
    this.edges.isVisible = false;
    this.heartbeat?.stop();
    if (this.panting) {
      this.panting.volume = 0;
    }
    this.music?.stop();
  }

  /** Back to normal when the player respawns. */
  resume(): void {
    this.silenced = false;
    this.lastBeats = [];
  }

  /** FX5-B, FX15: at death the heart beats twice more, slower and slower, and stops. */
  heartStops(): void {
    this.lastBeats = [...CONFIG.chase.lastBeats];
    this.sinceDeath = 0;
  }

  private update(seconds: number): void {
    this.beatLast(seconds);
    if (seconds <= 0 || this.silenced) {
      return;
    }
    const settings = CONFIG.chase;
    // The closer it runs, the stronger; once the chase ends, it calms down slowly.
    let target = 0;
    if (this.creature.isChasing) {
      const closeness = 1 - this.creature.playerDistance / settings.farDistance;
      target = Math.max(0.15, Math.min(1, closeness));
    }
    this.intensity =
      target >= this.intensity
        ? target
        : Math.max(target, this.intensity - seconds / settings.calmSeconds);

    this.untilBeat -= seconds;
    if (this.intensity > 0.02 && this.untilBeat <= 0) {
      this.untilBeat = lerp(settings.beatInterval, this.intensity);
      this.pulse = 1;
      if (this.heartbeat) {
        this.heartbeat.volume = lerp(settings.beatVolume, this.intensity);
        this.heartbeat.play();
      }
    }
    this.pulse = Math.max(0, this.pulse - seconds / settings.pulseSeconds);
    const strength = lerp(settings.edgeAlpha, this.intensity);
    this.edges.alpha = this.intensity > 0.02 ? strength * (0.6 + 0.4 * this.pulse) : 0;
    this.edges.isVisible = this.edges.alpha > 0.01;

    // PS3, PS7-C: out of breath, the player pants (louder as stamina runs out).
    const limit = settings.pantBelowStamina;
    const pantTarget = this.player.stamina < limit ? 1 - this.player.stamina / limit : 0;
    this.pantLevel += Math.max(-seconds, Math.min(seconds, pantTarget - this.pantLevel));
    if (this.panting) {
      this.panting.volume = settings.pantVolume * this.pantLevel;
    }
    this.updateMusic(seconds);
  }

  private beatLast(seconds: number): void {
    const next = this.lastBeats[0];
    if (next === undefined) {
      return;
    }
    this.sinceDeath += seconds;
    if (this.sinceDeath >= next && this.heartbeat) {
      this.lastBeats.shift();
      this.heartbeat.volume = CONFIG.chase.lastBeatVolume;
      this.heartbeat.play();
    }
  }

  /**
   * MT2: the music comes in with the growl (0.5 s) and plays while it attacks (chase, strike or
   * hesitation); when the attack ends it fades out over 3 s and stops, to start over next time.
   */
  private updateMusic(seconds: number): void {
    const music = this.music;
    if (!music) {
      return;
    }
    const settings = CONFIG.chase;
    const attacking = this.creature.state === "attack";
    if (attacking && this.musicLevel <= 0) {
      music.play();
    }
    const step = seconds / (attacking ? settings.musicFadeInSeconds : settings.musicFadeOutSeconds);
    this.musicLevel = Math.max(0, Math.min(1, this.musicLevel + (attacking ? step : -step)));
    music.volume = settings.musicVolume * this.musicLevel;
    if (!attacking && this.musicLevel <= 0) {
      music.stop();
    }
  }

  /** PS4-A: its footsteps shake the view when it runs close behind. */
  private shakeAtStep(): void {
    const settings = CONFIG.chase;
    const distance = this.creature.playerDistance;
    if (!this.creature.isChasing || distance > settings.shakeDistance) {
      return;
    }
    const strength = 1 - distance / settings.shakeDistance;
    this.player.shake(settings.shakeSeconds, settings.shakeRadians * (0.4 + 0.6 * strength));
  }
}

/** From the first value (at 0) to the second (at 1). */
function lerp([from, to]: readonly [number, number], t: number): number {
  return from + (to - from) * t;
}
