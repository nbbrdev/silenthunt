import {
  CreateSoundAsync,
  Vector3,
  type AbstractMesh,
  type Camera,
  type Scene,
  type StaticSound,
  type TransformNode,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";
import type { DayClock } from "../core/dayClock";
import { createRandom, randomRange } from "../core/random";
import { fogVisibility } from "../world/atmosphere";
import type { CreatureBrainBehavior } from "./creatureBrain";

/** Height of the eyes above the creature's feet when standing (meters, at scale 1). */
const EYE_HEIGHT = 2.2;

/**
 * The creature's presence (NBB-135, RF-25): what gives it away before it is seen. Its eyes shine
 * through the fog and fade out just beyond it (OL1-B); its footsteps, breathing and growl are 3D
 * sounds that follow its body (SO2, SO3).
 */
export class CreaturePresence {
  private readonly root: TransformNode;
  private readonly brain: CreatureBrainBehavior;
  private readonly camera: Camera;
  private readonly clock: DayClock;
  private readonly eyes: AbstractMesh[];
  private readonly random: () => number;

  private steps: StaticSound[] = [];
  private breath: StaticSound | undefined;
  private growl: StaticSound | undefined;
  /** Time walked since the last footstep, in animation seconds. */
  private stepClock = 0;
  private breathLevel = 0;
  private breathing = false;

  constructor(
    scene: Scene,
    root: TransformNode,
    brain: CreatureBrainBehavior,
    camera: Camera,
    clock: DayClock,
    seed: number,
  ) {
    this.root = root;
    this.brain = brain;
    this.camera = camera;
    this.clock = clock;
    this.random = createRandom(seed);
    // The eye spheres and their halos ("creatureEye0", "creatureEyeHalo0"...).
    this.eyes = root.getChildMeshes(false, (node) => node.name.startsWith("creatureEye"));

    scene.onBeforeRenderObservable.add(() => {
      this.update(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
    brain.onStateChanged.add((state) => {
      if (state === "attack") {
        // SO3: the growl warns that it is coming, time to raise the torch.
        this.growl?.play();
      }
    });
  }

  /** Loads the sounds (SO1-A files in `public/sounds/creature/`) and ties them to the body. */
  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.creature.sounds;
    const load = async (file: string, loop = false): Promise<StaticSound> => {
      const sound = await CreateSoundAsync(
        file,
        soundUrl(`creature/${file}`),
        {
          loop,
          maxInstances: 2,
          spatialEnabled: true,
          // RF-25: heard up to 25 m, fading linearly.
          spatialDistanceModel: "linear",
          spatialMinDistance: 1,
          spatialMaxDistance: settings.hearingDistance,
          outBus: audio.effects,
        },
        audio.engine,
      );
      sound.spatial.attach(this.root);
      return sound;
    };
    const [steps, breath, growl] = await Promise.all([
      Promise.all(settings.files.steps.map((file) => load(file))),
      load(settings.files.breath, true),
      load(settings.files.growl),
    ]);
    this.steps = steps;
    this.breath = breath;
    this.growl = growl;
    growl.volume = settings.growlVolume;
    breath.volume = 0;
  }

  private update(seconds: number): void {
    this.fadeEyes();
    this.walkSounds(seconds);
    this.breathe(seconds);
  }

  /** OL1-B: full brightness up to the fog distance, gone 30% beyond it. */
  private fadeEyes(): void {
    const eyes = this.root.position.add(new Vector3(0, EYE_HEIGHT * CONFIG.creature.scale, 0));
    const distance = Vector3.Distance(eyes, this.camera.globalPosition);
    const fog = fogVisibility(this.clock.daylight);
    const beyond = fog * CONFIG.creature.eyes.fadeBeyondFog;
    const brightness = Math.min(1, Math.max(0, 1 - (distance - fog) / beyond));
    for (const mesh of this.eyes) {
      mesh.visibility = brightness;
      mesh.isVisible = brightness > 0.01;
    }
  }

  /** SO2: one footstep every half cycle of the walking animation, none while standing still. */
  private walkSounds(seconds: number): void {
    const { animation, speedRatio } = this.brain.gait;
    const settings = CONFIG.creature.sounds;
    if (animation === "Atacar" || speedRatio <= 0) {
      return;
    }
    this.stepClock += seconds * speedRatio;
    if (this.stepClock < settings.stepEvery[animation]) {
      return;
    }
    this.stepClock = 0;
    const step = this.steps[Math.floor(this.random() * this.steps.length)];
    if (!step) {
      return;
    }
    const jitter = settings.pitchJitter;
    step.playbackRate = 1 + randomRange(this.random, -jitter, jitter);
    step.volume = settings.stepVolume[animation];
    step.play();
  }

  /** SO3: slow breathing while it stalks close by, fading in and out. */
  private breathe(seconds: number): void {
    const breath = this.breath;
    if (!breath) {
      return;
    }
    const settings = CONFIG.creature.sounds;
    const close =
      this.brain.state === "stalk" && this.brain.playerDistance < settings.breathDistance;
    const target = close ? settings.breathVolume : 0;
    const change = (settings.breathVolume / settings.breathFade) * seconds;
    this.breathLevel += Math.max(-change, Math.min(change, target - this.breathLevel));
    if (this.breathLevel > 0.001 && !this.breathing) {
      breath.play();
      this.breathing = true;
    } else if (this.breathLevel <= 0.001 && this.breathing) {
      breath.stop();
      this.breathing = false;
    }
    breath.volume = this.breathLevel;
  }
}
