import { CreateSoundAsync, type Scene, type StaticSound } from "@babylonjs/core";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import { soundUrl, type GameAudio } from "../core/audio";
import type { BiomeEffects } from "../systems/biomeEffects";
import { movementNoise, type NoiseSystem } from "../systems/noise";
import type { ChunkManager } from "../world/chunks";
import type { GroundType, Terrain } from "../world/terrain";
import type { Player } from "./player";

const GROUNDS: readonly GroundType[] = ["dirt", "moss", "leaves", "twigs", "mud", "grass"];

/**
 * The player's footsteps (NBB-131): each step is a noise event whose radius depends on the gait
 * (RF-10) and on the ground under the feet (RF-11). Steps come at the rhythm of NO3, landings
 * after a jump are noisy too, and stepping on a visible dry branch snaps it (NO4-B). Each one is
 * also heard (NBB-149): a step of that ground, quieter crouched and louder running (PA6-A).
 */
export class Footsteps {
  private readonly player: Player;
  private readonly terrain: Terrain;
  private readonly chunks: ChunkManager;
  private readonly noise: NoiseSystem;
  private stepTimer = 0;
  /** BM1 (NBB-163): the biome's effect on the steps (louder leaves, the mud, the wind). */
  biome: BiomeEffects | undefined;
  private sounds: { steps: Record<GroundType, StaticSound[]>; snaps: StaticSound[] } | undefined;

  constructor(
    scene: Scene,
    player: Player,
    terrain: Terrain,
    chunks: ChunkManager,
    noise: NoiseSystem,
  ) {
    this.player = player;
    this.terrain = terrain;
    this.chunks = chunks;
    this.noise = noise;

    player.onLanded.add(() => {
      this.noise.emit(this.player.feet, this.onGround(CONFIG.noise.radius.landing), "landing");
      const { landingVolume, landingRate } = CONFIG.footstepSounds;
      this.play(this.sounds?.steps.dirt, landingVolume, landingRate);
      this.checkBranch();
    });
    scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(scene)));
  }

  /** Loads the steps of each ground and the branch cracks (PA1–PA5, CC0). */
  async loadSounds(audio: GameAudio): Promise<void> {
    const { stepsPerGround, snaps } = CONFIG.footstepSounds;
    const load = (file: string) =>
      CreateSoundAsync(
        file,
        soundUrl(`player/${file}.mp3`),
        { maxInstances: 2, outBus: audio.effects },
        audio.engine,
      );
    const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);
    const [dirt, moss, leaves, twigs, mud, grass, snapSounds] = await Promise.all([
      ...GROUNDS.map((ground) =>
        Promise.all(range(stepsPerGround).map((n) => load(`step-${ground}-${n}`))),
      ),
      Promise.all(range(snaps).map((n) => load(`snap-${n}`))),
    ]);
    if (dirt && moss && leaves && twigs && mud && grass && snapSounds) {
      this.sounds = { steps: { dirt, moss, leaves, twigs, mud, grass }, snaps: snapSounds };
    }
  }

  /** Radius of the current gait on the current ground: what the HUD meter shows (RF-12). */
  currentRadius(): number {
    const { radius } = CONFIG.noise;
    switch (this.player.gait) {
      case "crouch":
        return this.onGround(radius.crouchStep);
      case "walk":
        return this.onGround(radius.walkStep);
      case "run":
        return this.onGround(radius.runStep);
      default:
        return 0;
    }
  }

  private update(seconds: number): void {
    const gait = this.player.gait;
    if (gait === "still") {
      // The first step comes half an interval after starting to move.
      this.stepTimer = 0.5;
      return;
    }
    const interval = CONFIG.noise.stepInterval[gait];
    this.stepTimer += seconds / interval;
    if (this.stepTimer >= 1) {
      this.stepTimer -= 1;
      this.noise.emit(this.player.feet, this.currentRadius(), "step");
      const settings = CONFIG.footstepSounds;
      const ground = this.groundType();
      this.play(
        this.sounds?.steps[ground],
        settings.volume[gait] * settings.groundVolume[ground],
        gait === "crouch" ? settings.crouchRate : 1,
      );
      this.checkBranch();
    }
  }

  private checkBranch(): void {
    const feet = this.player.feet;
    if (this.chunks.stepOnBranch(feet.x, feet.z)) {
      // RF-11: a single loud crack, even when crouching.
      this.noise.emit(feet, CONFIG.noise.branchSnapRadius, "branch");
      this.play(this.sounds?.snaps, CONFIG.footstepSounds.snapVolume, 1);
    }
  }

  /** One of the sounds, at random, with its pitch varied a little. */
  private play(sounds: readonly StaticSound[] | undefined, volume: number, rate: number): void {
    const sound = sounds?.[Math.floor(Math.random() * sounds.length)];
    if (!sound) {
      return;
    }
    const jitter = CONFIG.footstepSounds.pitchJitter;
    sound.playbackRate = rate * (1 + (Math.random() * 2 - 1) * jitter);
    sound.volume = volume;
    sound.play();
  }

  private groundType(): GroundType {
    const feet = this.player.feet;
    return this.terrain.groundTypeAt(feet.x, feet.z);
  }

  private onGround(baseRadius: number): number {
    const radius =
      movementNoise(baseRadius, this.groundType()) * (this.biome?.stepNoiseFactor ?? 1);
    // BM8: in the marsh's mud each step splashes as loud as a snapping branch.
    return this.biome?.inMud ? Math.max(radius, CONFIG.noise.branchSnapRadius) : radius;
  }
}
