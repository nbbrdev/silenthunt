import { CreateSoundAsync, type Scene, type StaticSound, type Vector3 } from "@babylonjs/core";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";
import { frameSeconds } from "../core/gameTime";
import type { Player } from "../player/player";

/**
 * "Pego" (NBB-155; GF4-C, GF8): the creature's fatal strike. The controls lock and the view
 * turns to the creature's face; then its growl and the strike play, right in the player's ears,
 * and the screen goes black (the caller shows the death screen).
 */
export class CaughtSequence {
  private readonly player: Player;
  private readonly face: () => Vector3;
  private strike: StaticSound | undefined;
  private growl: StaticSound | undefined;
  private turn: { seconds: number; yaw: number; pitch: number; onBlack: () => void } | undefined;

  /** @param face where the creature's face is now (between its eyes). */
  constructor(scene: Scene, player: Player, face: () => Vector3) {
    this.player = player;
    this.face = face;
    scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(scene)));
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.caught;
    const load = (name: string, file: string, volume: number) =>
      CreateSoundAsync(name, soundUrl(file), { volume, outBus: audio.effects }, audio.engine);
    [this.strike, this.growl] = await Promise.all([
      load("caughtStrike", settings.strikeFile, settings.strikeVolume),
      load("caughtGrowl", settings.growlFile, settings.growlVolume),
    ]);
  }

  /** True from the strike until the screen goes black. */
  get isRunning(): boolean {
    return this.turn !== undefined;
  }

  /** Starts the sequence; `onBlack` runs when the view has turned and the screen must go black. */
  start(onBlack: () => void): void {
    this.player.controlsEnabled = false;
    const { yaw, pitch } = this.player.view;
    this.turn = { seconds: 0, yaw, pitch, onBlack };
  }

  private update(seconds: number): void {
    const turn = this.turn;
    if (!turn) {
      return;
    }
    turn.seconds += seconds;
    const t = Math.min(1, turn.seconds / CONFIG.caught.turnSeconds);
    const target = this.viewToFace();
    // The shortest way around for the yaw.
    const yawChange = Math.atan2(Math.sin(target.yaw - turn.yaw), Math.cos(target.yaw - turn.yaw));
    this.player.view = {
      yaw: turn.yaw + yawChange * t,
      pitch: turn.pitch + (target.pitch - turn.pitch) * t,
    };
    if (t >= 1) {
      this.turn = undefined;
      this.growl?.play();
      this.strike?.play();
      turn.onBlack();
    }
  }

  /** The yaw and pitch that look straight at the creature's face (positive pitch looks down). */
  private viewToFace(): { yaw: number; pitch: number } {
    const eyes = this.player.camera.globalPosition;
    const face = this.face();
    const dx = face.x - eyes.x;
    const dz = face.z - eyes.z;
    return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(eyes.y - face.y, Math.hypot(dx, dz)) };
  }
}
