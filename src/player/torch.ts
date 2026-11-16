import { Color3, PointLight, Vector3, type Camera, type Scene } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { Input } from "../core/input";
import { createTorchModel, type TorchModel } from "../models/items/torch";

/**
 * The torch in the player's hand (NBB-132). F lights it or puts it away (G2). It burns for
 * RF-14's 4 minutes while lit, sputters in the last 20 s (TO4) and, once burnt out, F lights a
 * new one (TO1-A: unlimited torches until crafting exists, NBB-144).
 */
export class PlayerTorch {
  private readonly model: TorchModel;
  private readonly light: PointLight;
  private lit = false;
  private secondsLeft: number = CONFIG.torch.burnSeconds;
  private time = 0;

  constructor(scene: Scene, camera: Camera, input: Input) {
    this.model = createTorchModel(scene);
    const { heldOffset } = CONFIG.torch;
    this.model.root.parent = camera;
    this.model.root.position = new Vector3(heldOffset.x, heldOffset.y, heldOffset.z);
    // Tip leaning forward and inward, like a torch held out in front: only the top shows.
    this.model.root.rotation = new Vector3(0.45, 0, -0.25);
    // Drawn after the world with its own depth, so it never sinks into trees or the ground.
    for (const mesh of [this.model.root, this.model.flame]) {
      mesh.renderingGroupId = 1;
    }
    this.model.fire.renderingGroupId = 1;

    this.light = new PointLight("torchLight", Vector3.Zero(), scene);
    this.light.parent = this.model.flame;
    const { lightColor } = CONFIG.torch;
    this.light.diffuse = new Color3(lightColor.r, lightColor.g, lightColor.b);
    this.light.specular = Color3.Black();
    this.light.range = CONFIG.torch.lightRange;

    this.setLit(false);
    scene.onBeforeRenderObservable.add(() => {
      if (input.wasPressed("KeyF")) {
        this.toggle();
      }
      this.update(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
    });
  }

  /** True while the torch is burning (RF-13: the player is seen from much farther away). */
  get isLit(): boolean {
    return this.lit;
  }

  /** Seconds of burning left on the current torch. */
  get remainingSeconds(): number {
    return this.secondsLeft;
  }

  private toggle(): void {
    if (!this.lit && this.secondsLeft <= 0) {
      // TO1-A: the old torch burnt out; take a fresh one.
      this.secondsLeft = CONFIG.torch.burnSeconds;
    }
    this.setLit(!this.lit);
  }

  private setLit(lit: boolean): void {
    this.lit = lit;
    // An unlit torch is put away: nothing in the hand.
    this.model.root.setEnabled(lit);
    this.light.setEnabled(lit);
    if (lit) {
      this.model.fire.start();
    } else {
      this.model.fire.stop();
    }
  }

  private update(seconds: number): void {
    if (!this.lit) {
      return;
    }
    this.time += seconds;
    this.secondsLeft -= seconds;
    if (this.secondsLeft <= 0) {
      this.secondsLeft = 0;
      this.setLit(false);
      return;
    }

    // TO4: 1 while healthy, falling to 0 over the last dyingSeconds.
    const { dyingSeconds, lightIntensity, flicker } = CONFIG.torch;
    const strength = Math.min(1, this.secondsLeft / dyingSeconds);
    // TO3: a soft, irregular tremble (sum of waves); stronger when the torch is dying.
    const t = this.time;
    const wave = Math.sin(t * 13) * 0.5 + Math.sin(t * 23.7) * 0.3 + Math.sin(t * 7.3) * 0.2;
    const tremble = flicker * (1 + (1 - strength) * 3);
    const sputter = strength < 1 && Math.sin(t * 41) > 0.85 ? 0.4 : 1;
    this.light.intensity = Math.max(0, lightIntensity * strength * (1 + wave * tremble) * sputter);

    const flameSize = (0.4 + 0.6 * strength) * (1 + wave * 0.08);
    this.model.flame.scaling.set(flameSize, 1.8 * flameSize, flameSize);
    this.model.fire.emitRate = 120 * (0.3 + 0.7 * strength);
  }
}
