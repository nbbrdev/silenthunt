import {
  CreateSoundAsync,
  TransformNode,
  type Scene,
  type StaticSound,
  type Vector3,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";

/** The tools' and weapons' sounds (NBB-149, FE1–FE7), by name. */
export type EffectName = keyof typeof CONFIG.effectSounds.files;

interface Effect {
  sounds: StaticSound[];
  /** Where a 3D effect is heard from (undefined: from the player's own hands). */
  emitter: TransformNode | undefined;
}

/**
 * Plays the short sounds of the tools and weapons (NBB-149, FE1–FE7): the bow, the knife, the
 * axe on wood and stone, the tree falling and the arrow landing. Those in the player's hands are
 * not 3D; the arrow landing and the tree falling are heard from where they happen. Nothing plays
 * until the sounds are loaded.
 */
export class SoundEffects {
  private readonly scene: Scene;
  private effects: Partial<Record<EffectName, Effect>> = {};
  /** Development: how many times each effect has played. */
  readonly played: Partial<Record<EffectName, number>> = {};

  constructor(scene: Scene) {
    this.scene = scene;
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.effectSounds;
    const names = Object.keys(settings.files) as EffectName[];
    const loaded = await Promise.all(
      names.map(async (name): Promise<[EffectName, Effect]> => {
        const spatial = (settings.spatial as readonly EffectName[]).includes(name);
        const emitter = spatial ? new TransformNode(`effect-${name}`, this.scene) : undefined;
        const sounds = await Promise.all(
          settings.files[name].map(async (file) => {
            const sound = await CreateSoundAsync(
              file,
              soundUrl(`tools/${file}`),
              {
                maxInstances: 2,
                volume: settings.volume[name],
                outBus: audio.effects,
                spatialEnabled: spatial,
                spatialDistanceModel: "linear",
                spatialMinDistance: 1,
                spatialMaxDistance: settings.hearingDistance,
              },
              audio.engine,
            );
            if (emitter) {
              sound.spatial.attach(emitter);
            }
            return sound;
          }),
        );
        return [name, { sounds, emitter }];
      }),
    );
    this.effects = Object.fromEntries(loaded);
  }

  /** Plays one of the effect's sounds (at random), at `position` if it is a 3D one. */
  play(name: EffectName, position?: Vector3): void {
    const effect = this.effects[name];
    const sound = effect?.sounds[Math.floor(Math.random() * effect.sounds.length)];
    if (!effect || !sound) {
      return;
    }
    if (effect.emitter && position) {
      effect.emitter.position.copyFrom(position);
    }
    const jitter = CONFIG.effectSounds.pitchJitter;
    sound.playbackRate = 1 + (Math.random() * 2 - 1) * jitter;
    sound.play();
    this.played[name] = (this.played[name] ?? 0) + 1;
  }

  /** Stops an effect that is playing (letting go of the bow before shooting). */
  stop(name: EffectName): void {
    for (const sound of this.effects[name]?.sounds ?? []) {
      sound.stop();
    }
  }
}
