import {
  CreateSoundAsync,
  TransformNode,
  type Scene,
  type StaticSound,
  type Vector3,
} from "@babylonjs/core";
import type { HostileSound } from "../ai/hostileBrain";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";

/** One 3D sound and the point it plays from. */
interface Voice {
  emitter: TransformNode;
  sound: StaticSound;
}

/**
 * NBB-167 (AH2-A, AH8-A, AH9): the hostile animals' sounds, all 3D, played where the animal is:
 * the wolf's howl, growl, bite and yelp; the boar's grunt and squeal; the bear's roar and its
 * growl of pain (lower). The game runs even if they fail to load.
 */
export class HostileSounds {
  private readonly scene: Scene;
  private voices: Partial<Record<HostileSound, Voice>> = {};
  /** Development: how many of each have played. */
  readonly played: Partial<Record<HostileSound, number>> = {};

  constructor(scene: Scene) {
    this.scene = scene;
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    const { files, volume, hearingDistance } = CONFIG.hostile.sounds;
    const names = Object.keys(files) as HostileSound[];
    const loaded = await Promise.all(
      names.map(async (name) => {
        const emitter = new TransformNode(`hostileSound-${name}`, this.scene);
        const sound = await CreateSoundAsync(
          `hostile-${name}`,
          soundUrl(files[name]),
          {
            maxInstances: 3,
            volume: volume[name],
            outBus: audio.effects,
            spatialEnabled: true,
            spatialDistanceModel: "linear",
            spatialMinDistance: 2,
            spatialMaxDistance: hearingDistance[name],
          },
          audio.engine,
        );
        sound.spatial.attach(emitter);
        return [name, { emitter, sound }] as const;
      }),
    );
    this.voices = Object.fromEntries(loaded);
  }

  /** Plays `name` at `at`, its pitch varied a little. */
  play(name: HostileSound, at: Vector3): void {
    this.played[name] = (this.played[name] ?? 0) + 1;
    const voice = this.voices[name];
    if (!voice) {
      return;
    }
    voice.emitter.position.copyFrom(at);
    voice.emitter.position.y += 0.6;
    const rate = name === "bearPain" ? CONFIG.hostile.sounds.rate.bearPain : 1;
    voice.sound.playbackRate = rate * (0.94 + Math.random() * 0.12);
    voice.sound.play();
  }
}
