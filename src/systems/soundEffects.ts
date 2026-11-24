import {
  CreateSoundAsync,
  CreateSoundBufferAsync,
  TransformNode,
  type Scene,
  type StaticSound,
  type StaticSoundBuffer,
  type Vector3,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";

/** The short sounds of tools, weapons and actions (NBB-149, FE1–FE7, CH2, AC1), by name. */
export type EffectName = keyof typeof CONFIG.effectSounds.files;

interface Effect {
  sounds: StaticSound[];
  /** Where a 3D effect is heard from (undefined: from the player's own hands). */
  emitter: TransformNode | undefined;
}

/**
 * Plays the short sounds of the tools, weapons and actions (NBB-149): the bow, the knife, the
 * axe, the tree falling, the arrow landing, lighting a fire, eating, picking things up, building,
 * the door and the chest. Those in the player's hands are not 3D; the arrow landing, the tree
 * falling and a hit are heard from where they happen. Some loop while something lasts (cleaning
 * a carcass, the torch burning). Each campfire gets its own 3D crackle. Nothing plays until the
 * sounds are loaded.
 */
export class SoundEffects {
  private readonly scene: Scene;
  private effects: Partial<Record<EffectName, Effect>> = {};
  private audio: GameAudio | undefined;
  private campfireBuffer: StaticSoundBuffer | undefined;
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
        const loop = (settings.loops as readonly EffectName[]).includes(name);
        const emitter = spatial ? new TransformNode(`effect-${name}`, this.scene) : undefined;
        const sounds = await Promise.all(
          settings.files[name].map(async (file) => {
            const sound = await CreateSoundAsync(
              file,
              soundUrl(file),
              {
                loop,
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
    this.campfireBuffer = await CreateSoundBufferAsync(
      soundUrl(CONFIG.campfire.sound.file),
      {},
      audio.engine,
    );
    this.audio = audio;
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
    const { pitchJitter, rates, volume } = CONFIG.effectSounds;
    const rate = (rates as Partial<Record<EffectName, number>>)[name] ?? 1;
    sound.playbackRate = rate * (1 + (Math.random() * 2 - 1) * pitchJitter);
    // Its own volume again (a fade may have lowered it).
    sound.volume = volume[name];
    sound.play();
    this.played[name] = (this.played[name] ?? 0) + 1;
  }

  /** FX15: an effect that is playing fades out over `seconds`, then stops (the helicopter). */
  fadeOut(name: EffectName, seconds: number): void {
    for (const sound of this.effects[name]?.sounds ?? []) {
      sound.setVolume(0, { duration: seconds });
      window.setTimeout(() => sound.stop(), seconds * 1000);
    }
  }

  /** Development (FX15): the effects' names, for `silentHunt.sound()`. */
  get names(): EffectName[] {
    return Object.keys(this.effects) as EffectName[];
  }

  /** Stops an effect that is playing (letting go of the bow, of E, putting the torch away). */
  stop(name: EffectName): void {
    for (const sound of this.effects[name]?.sounds ?? []) {
      sound.stop();
    }
  }

  /**
   * CH1-B: a campfire's own crackle, looping in 3D from `node`, silent at first (the fire sets
   * its volume). Undefined until the sounds are loaded.
   */
  async campfireCrackle(node: TransformNode): Promise<StaticSound | undefined> {
    const { audio, campfireBuffer } = this;
    if (!audio || !campfireBuffer) {
      return undefined;
    }
    const sound = await CreateSoundAsync(
      "campfireCrackle",
      campfireBuffer,
      {
        loop: true,
        volume: 0,
        outBus: audio.effects,
        spatialEnabled: true,
        spatialDistanceModel: "linear",
        spatialMinDistance: 1,
        spatialMaxDistance: CONFIG.campfire.sound.hearingDistance,
      },
      audio.engine,
    );
    sound.spatial.attach(node);
    // Each fire starts at a different point of the loop, so two fires do not crackle in step.
    sound.play({ startOffset: Math.random() * campfireBuffer.duration });
    return sound;
  }

  get isLoaded(): boolean {
    return this.audio !== undefined;
  }
}
