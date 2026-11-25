import { CreateSoundAsync, type Scene, type StaticSound } from "@babylonjs/core";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";
import { frameSeconds, isPaused } from "../core/gameTime";
import { applyVolumes, muffle, type GameOptions } from "../core/options";
import type { PlayerHealth } from "../player/health";
import type { Player } from "../player/player";
import type { PlayerTorch } from "../player/torch";
import { fogConditions } from "../world/atmosphere";
import type { NoiseSystem } from "./noise";
import type { SoundEffects } from "./soundEffects";

/** The water's own sounds, loaded once. */
interface WaterSounds {
  enter: StaticSound;
  swim: StaticSound;
  underwater: StaticSound;
}

/**
 * What the water does around the player (NBB-164, AG14 to AG17): the splash going in and out,
 * the strokes and their noise, the muffled world and the murk underwater, drowning, the torch put
 * out, and a long fall's damage (BM1, which deep water breaks).
 */
export class SwimmingSystem {
  private readonly player: Player;
  private readonly health: PlayerHealth;
  private readonly torch: PlayerTorch;
  private readonly noise: NoiseSystem;
  private readonly effects: SoundEffects;
  private readonly options: GameOptions;
  private audio: GameAudio | undefined;
  private sounds: WaterSounds | undefined;
  /** Drowning's damage gathered until it makes a whole chunk. */
  private drowning = 0;
  private strokeIn = 0;
  private swimPlaying = false;
  private underwaterPlaying = false;

  constructor(
    scene: Scene,
    parts: {
      player: Player;
      health: PlayerHealth;
      torch: PlayerTorch;
      noise: NoiseSystem;
      effects: SoundEffects;
      options: GameOptions;
    },
  ) {
    this.player = parts.player;
    this.health = parts.health;
    this.torch = parts.torch;
    this.noise = parts.noise;
    this.effects = parts.effects;
    this.options = parts.options;
    const settings = CONFIG.swimming;
    this.torch.canLight = () => this.player.waterAboveFeet <= settings.torchLightDepth;

    this.player.onWaterChanged.add((state) => this.waterChanged(state));
    this.player.onSurfaced.add((seconds) => {
      // FX13: a long time under, the player comes up gasping.
      if (seconds >= settings.gaspAfterSeconds && !this.health.isDead) {
        this.effects.play("hurtBreath");
      }
    });
    this.player.onHurt.add((damage) => {
      this.drowning += damage;
    });
    this.player.onHardLanding.add((damage) => {
      if (!this.health.isDead) {
        this.health.damage(damage);
      }
    });
    scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(scene)));
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    const { files, volume, muffled } = CONFIG.swimming;
    const make = (name: string, file: string, options: object) =>
      CreateSoundAsync(name, soundUrl(file), options, audio.engine);
    const [enter, swim, underwater] = await Promise.all([
      make("waterEnter", files.enter, { volume: volume.enter, outBus: audio.effects }),
      make("waterSwim", files.swim, { loop: true, volume: volume.swim, outBus: audio.effects }),
      // It plays while the ambience is muffled: its volume makes up for it.
      make("waterUnder", files.underwater, {
        loop: true,
        volume: volume.underwater / muffled,
        outBus: audio.ambience,
      }),
    ]);
    this.sounds = { enter, swim, underwater };
    this.audio = audio;
  }

  private waterChanged(state: "dry" | "wading" | "swimming"): void {
    const settings = CONFIG.swimming;
    const enter = this.sounds?.enter;
    if (state === "swimming") {
      // Falling into deep water is loud.
      if (enter) {
        enter.volume = settings.volume.enter;
        enter.play();
      }
      this.noise.emit(this.player.feet, settings.splashNoise, "splash");
    } else if (enter && this.player.waterState !== "swimming") {
      // Climbing out: the same splash, softer (AG14).
      enter.volume = settings.volume.exit;
      enter.play();
    }
  }

  private update(seconds: number): void {
    const player = this.player;
    const settings = CONFIG.swimming;
    const paused = isPaused();

    // AG4-A: the water at the chest puts the torch out.
    if (player.waterAboveFeet > settings.torchOutDepth && this.torch.isLit) {
      this.torch.putOut();
    }

    // Underwater: the murk and the muffled world.
    if (fogConditions.underwater !== player.underwater) {
      fogConditions.underwater = player.underwater;
      muffle.share = player.underwater ? settings.muffled : 1;
      if (this.audio) {
        applyVolumes(this.options, this.audio);
      }
    }

    if (!paused) {
      // Drowning hurts in whole chunks (one "hurt" a second, not one every frame).
      if (this.drowning >= settings.drownDamage && !this.health.isDead) {
        this.health.damage(this.drowning);
        this.drowning = 0;
      }
      if (!player.underwater) {
        this.drowning = 0;
      }
      // Each stroke at the surface is heard 8 m away; none underwater.
      const stroking = player.swimMoving && !player.underwater;
      if (stroking) {
        this.strokeIn -= seconds;
        if (this.strokeIn <= 0) {
          this.strokeIn = settings.strokeSeconds;
          this.noise.emit(player.feet, settings.strokeNoise, "swim");
        }
      } else {
        this.strokeIn = 0;
      }
    }

    const sounds = this.sounds;
    if (!sounds) {
      return;
    }
    const swimming = player.swimMoving && !player.underwater && !this.health.isDead;
    if (swimming !== this.swimPlaying) {
      this.swimPlaying = swimming;
      if (swimming) {
        sounds.swim.play();
      } else {
        sounds.swim.stop();
      }
    }
    const under = player.underwater && !this.health.isDead;
    if (under !== this.underwaterPlaying) {
      this.underwaterPlaying = under;
      if (under) {
        sounds.underwater.play();
      } else {
        sounds.underwater.stop();
      }
    }
  }
}
