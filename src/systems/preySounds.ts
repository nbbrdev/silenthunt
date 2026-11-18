import {
  CreateSoundAsync,
  TransformNode,
  type Node,
  type Scene,
  type StaticSound,
} from "@babylonjs/core";
import type { PreyBrainBehavior, PreyKind, PreyState } from "../ai/preyBrain";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";

/** One 3D sound set that follows an animal. */
interface Voice {
  emitter: TransformNode;
  sounds: StaticSound[];
}

/**
 * The prey's sounds (NBB-149; SA1-B, AN1-B to AN3), all 3D: a deer barks in alarm when it
 * notices the player (one bark for the group); the nearest fleeing deer gallops and the nearest
 * fleeing rabbit hops away, both made of the footsteps' leaves and twigs (AN2-A); a deer bleats
 * when it dies. The rabbit dies silently.
 */
export class PreySounds {
  private readonly animals: () => PreyBrainBehavior[];
  private readonly ears: Node;
  private readonly lastState = new Map<PreyBrainBehavior, PreyState>();
  private voices: { alarm: Voice; cry: Voice; run: Record<PreyKind, Voice> } | undefined;
  private sinceAlarm = Infinity;
  /** Development: how many of each sound have played. */
  readonly played = { alarm: 0, cry: 0, deer: 0, rabbit: 0 };
  /** Where each kind is in its running rhythm (index of the beat, seconds to the next one). */
  private readonly rhythm: Record<PreyKind, { beat: number; wait: number }> = {
    deer: { beat: 0, wait: 0 },
    rabbit: { beat: 0, wait: 0 },
  };

  constructor(scene: Scene, animals: () => PreyBrainBehavior[], ears: Node) {
    this.animals = animals;
    this.ears = ears;
    scene.onBeforeRenderObservable.add(() => {
      this.update(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.preySounds;
    const voice = async (name: string, paths: readonly string[], hearing: number) => {
      const emitter = new TransformNode(`preySound-${name}`);
      const sounds = await Promise.all(
        paths.map(async (path) => {
          const sound = await CreateSoundAsync(
            path,
            soundUrl(path),
            {
              maxInstances: 2,
              outBus: audio.effects,
              spatialEnabled: true,
              spatialDistanceModel: "linear",
              spatialMinDistance: 1,
              spatialMaxDistance: hearing,
            },
            audio.engine,
          );
          sound.spatial.attach(emitter);
          return sound;
        }),
      );
      return { emitter, sounds };
    };
    const { files, hearingDistance } = settings;
    const [alarm, cry, deerRun, rabbitRun] = await Promise.all([
      voice("alarm", files.alarm, hearingDistance.alarm),
      voice("cry", files.cry, hearingDistance.cry),
      voice("deerRun", files.deerRun, hearingDistance.deerRun),
      voice("rabbitRun", files.rabbitRun, hearingDistance.rabbitRun),
    ]);
    this.voices = { alarm, cry, run: { deer: deerRun, rabbit: rabbitRun } };
  }

  private update(seconds: number): void {
    const voices = this.voices;
    if (!voices) {
      return;
    }
    const settings = CONFIG.preySounds;
    this.sinceAlarm += seconds;
    const ears = this.ears.getWorldMatrix().getTranslation();
    const nearestFleeing: Partial<Record<PreyKind, { animal: PreyBrainBehavior; d: number }>> = {};

    for (const animal of this.animals()) {
      const body = animal.attachedNode;
      if (!body || !animal.isActive) {
        continue;
      }
      const state = animal.state;
      const before = this.lastState.get(animal);
      this.lastState.set(animal, state);
      if (animal.kind === "deer" && before === "graze" && (state === "alert" || state === "flee")) {
        // AN1-B: one bark for the whole group.
        if (this.sinceAlarm >= settings.alarmEvery) {
          this.sinceAlarm = 0;
          this.play(voices.alarm, body, settings.volume.alarm, 1);
          this.played.alarm++;
        }
      }
      if (animal.kind === "deer" && state === "dead" && before !== undefined && before !== "dead") {
        this.play(voices.cry, body, settings.volume.cry, 1);
        this.played.cry++;
      }
      if (state === "flee") {
        const d = body.position.subtract(ears).length();
        const nearest = nearestFleeing[animal.kind];
        if (!nearest || d < nearest.d) {
          nearestFleeing[animal.kind] = { animal, d };
        }
      }
    }

    // AN2-A: the nearest fleeing animal of each kind is heard running, in its own rhythm.
    for (const kind of ["deer", "rabbit"] as const) {
      const runner = nearestFleeing[kind]?.animal.attachedNode;
      const rhythm = this.rhythm[kind];
      if (!runner) {
        rhythm.wait = 0;
        continue;
      }
      rhythm.wait -= seconds;
      if (rhythm.wait > 0) {
        continue;
      }
      const beats = settings.rhythm[kind];
      rhythm.beat = (rhythm.beat + 1) % beats.length;
      rhythm.wait = beats[rhythm.beat] ?? 0.3;
      this.play(voices.run[kind], runner, settings.volume[kind], settings.rate[kind]);
      this.played[kind]++;
    }
  }

  /** One of the voice's sounds, at random, where the animal is, its pitch varied a little. */
  private play(voice: Voice, body: TransformNode, volume: number, rate: number): void {
    const sound = voice.sounds[Math.floor(Math.random() * voice.sounds.length)];
    if (!sound) {
      return;
    }
    voice.emitter.position.copyFrom(body.position);
    sound.volume = volume;
    sound.playbackRate = rate * (0.94 + Math.random() * 0.12);
    sound.play();
  }
}
