import {
  CreateSoundAsync,
  TransformNode,
  Vector3,
  type Node,
  type Scene,
  type StaticSound,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import { soundUrl, type GameAudio } from "../core/audio";
import type { DayClock } from "../core/dayClock";

interface OneShot {
  sound: StaticSound;
  volume: number;
  rate: number;
}

/**
 * The forest around the player (NBB-149, SM4-A, AM1–AM7): wind all the time, birds by day and
 * crickets by night, crossing over with the daylight at dawn and dusk; now and then a lone 3D
 * sound far away in a random direction: a crow by day, an owl by night, a branch cracking. They
 * make no noise for the creature or the animals.
 */
export class AmbienceSystem {
  private readonly clock: DayClock;
  private readonly ears: Node;
  private readonly emitter: TransformNode;
  private loops: { wind: StaticSound; birds: StaticSound; crickets: StaticSound } | undefined;
  private oneShots:
    | {
        owls: OneShot[];
        crows: OneShot[];
        snaps: OneShot[];
        creaks: OneShot[];
        gusts: OneShot[];
        branchFalls: OneShot[];
      }
    | undefined;
  private nextOneShot = 0;

  constructor(scene: Scene, clock: DayClock, ears: Node) {
    this.clock = clock;
    this.ears = ears;
    this.emitter = new TransformNode("ambienceEmitter", scene);
    this.nextOneShot = this.randomWait();
    scene.onBeforeRenderObservable.add(() => {
      this.update(frameSeconds(scene));
    });
  }

  /** Loads the loops and the lone sounds (AM1–AM5, CC0; the cracks are the footsteps' ones). */
  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.ambience;
    const loop = async (file: string) => {
      const sound = await CreateSoundAsync(
        file,
        soundUrl(`ambience/${file}`),
        { loop: true, volume: 0, outBus: audio.ambience },
        audio.engine,
      );
      sound.play();
      return sound;
    };
    const far = async (path: string, volume: number, rate = 1): Promise<OneShot> => {
      const sound = await CreateSoundAsync(
        path,
        soundUrl(path),
        {
          outBus: audio.ambience,
          spatialEnabled: true,
          spatialDistanceModel: "linear",
          spatialMinDistance: 1,
          spatialMaxDistance: settings.hearingDistance,
        },
        audio.engine,
      );
      sound.spatial.attach(this.emitter);
      return { sound, volume, rate };
    };
    const { files, volume } = settings;
    const [wind, birds, crickets, owls, crows, snaps, creaks, gusts, branchFalls] =
      await Promise.all([
        loop(files.wind),
        loop(files.birds),
        loop(files.crickets),
        Promise.all(files.owls.map((file) => far(`ambience/${file}`, volume.owl))),
        Promise.all(files.crows.map((file) => far(`ambience/${file}`, volume.crow))),
        Promise.all(
          files.snaps.map((file) => far(`player/${file}`, volume.snap, settings.snapRate)),
        ),
        Promise.all(files.creaks.map((file) => far(`ambience/${file}`, volume.creak))),
        Promise.all(files.gusts.map((file) => far(`ambience/${file}`, volume.gust))),
        Promise.all(files.branchFalls.map((file) => far(`ambience/${file}`, volume.branchFall))),
      ]);
    this.loops = { wind, birds, crickets };
    this.oneShots = { owls, crows, snaps, creaks, gusts, branchFalls };
  }

  /** Development: the loops' volumes now and when the next lone sound comes. */
  debugState(): { loaded: boolean; volumes: number[]; nextOneShot: number } {
    const loops = this.loops;
    return {
      loaded: loops !== undefined,
      volumes: loops
        ? [loops.wind, loops.birds, loops.crickets].map((s) => Math.round(s.volume * 100) / 100)
        : [],
      nextOneShot: Math.round(this.nextOneShot),
    };
  }

  /** Development: plays a lone sound now. */
  debugOneShot(): void {
    this.nextOneShot = 0;
  }

  private update(seconds: number): void {
    const loops = this.loops;
    if (!loops) {
      return;
    }
    // AM7: birds fade out over dusk and crickets take their place; the other way round at dawn.
    const { volume } = CONFIG.ambience;
    const daylight = this.clock.daylight;
    loops.wind.volume = volume.wind;
    loops.birds.volume = volume.birds * daylight;
    loops.crickets.volume = volume.crickets * (1 - daylight);

    this.nextOneShot -= seconds;
    if (this.nextOneShot <= 0) {
      this.nextOneShot = this.randomWait();
      this.playOneShot(daylight > 0.5);
    }
  }

  /** AM6: a crow by day or an owl by night, or a branch cracking, 30–60 m away. */
  private playOneShot(isDay: boolean): void {
    const oneShots = this.oneShots;
    if (!oneShots) {
      return;
    }
    const { snapChance, extraChance } = CONFIG.ambience;
    const useSnap = Math.random() < (isDay ? snapChance.day : snapChance.night);
    // FX14: now and then a gust (any time), a creaking tree or a falling branch (at night).
    const useExtra = !useSnap && Math.random() < (isDay ? extraChance.day : extraChance.night);
    const extras = isDay
      ? [oneShots.gusts]
      : [oneShots.gusts, oneShots.creaks, oneShots.branchFalls];
    const extra = extras[Math.floor(Math.random() * extras.length)] ?? oneShots.gusts;
    const pool = useSnap
      ? oneShots.snaps
      : useExtra
        ? extra
        : isDay
          ? oneShots.crows
          : oneShots.owls;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) {
      return;
    }
    const [near, far] = CONFIG.ambience.oneShotDistance;
    const distance = near + Math.random() * (far - near);
    const angle = Math.random() * Math.PI * 2;
    const ears = this.ears.getWorldMatrix().getTranslation();
    this.emitter.position = new Vector3(
      ears.x + Math.cos(angle) * distance,
      ears.y + (useSnap ? -1.5 : 4),
      ears.z + Math.sin(angle) * distance,
    );
    pick.sound.volume = pick.volume;
    pick.sound.playbackRate = pick.rate * (0.95 + Math.random() * 0.1);
    pick.sound.play();
  }

  private randomWait(): number {
    const [shortest, longest] = CONFIG.ambience.oneShotEvery;
    return shortest + Math.random() * (longest - shortest);
  }
}
