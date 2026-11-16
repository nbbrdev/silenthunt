import { Engine, Vector3, type Scene } from "@babylonjs/core";
import { CONFIG } from "./config";
import { Input } from "./core/input";
import { createHavokPlugin } from "./core/physics";
import { setupPostProcessing } from "./core/postProcessing";
import { Footsteps } from "./player/footsteps";
import { Player } from "./player/player";
import { NoiseSystem } from "./systems/noise";
import { createHud } from "./ui/hud";
import { createWorld } from "./world/worldScene";
import { attachFpsCounter } from "./ui/fpsCounter";
import "./style.css";

async function start(): Promise<void> {
  const canvas = document.getElementById("game-canvas");
  const fpsElement = document.getElementById("fps-counter");
  if (!(canvas instanceof HTMLCanvasElement) || !fpsElement) {
    throw new Error("index.html must contain #game-canvas and #fps-counter.");
  }

  const engine = new Engine(canvas, true);
  const isGallery = new URLSearchParams(window.location.search).has("galeria");

  let scene: Scene;
  let input: Input | undefined;
  // The gallery is a development tool (G17): in the production build `/?galeria` opens the game.
  if (import.meta.env.DEV && isGallery) {
    const { createGalleryScene } = await import("./ui/gallery");
    scene = createGalleryScene(engine);
  } else {
    const physics = await createHavokPlugin();
    const world = createWorld(engine, physics, CONFIG.world.defaultSeed);
    scene = world.scene;
    input = new Input(canvas);
    const { spawn } = CONFIG.player;
    const feet = new Vector3(spawn.x, world.terrain.heightAt(spawn.x, spawn.z), spawn.z);
    const player = new Player(scene, input, feet);
    setupPostProcessing(scene, player.camera);
    scene.onBeforeRenderObservable.add(() => world.chunks.update(player.position));
    const noise = new NoiseSystem();
    const footsteps = new Footsteps(scene, player, world.terrain, world.chunks, noise);
    createHud(scene, noise, () => footsteps.currentRadius());
    if (import.meta.env.DEV) {
      const devInput = input;
      const { enableNoiseRings } = await import("./core/devNoiseRings");
      enableNoiseRings(scene, noise, devInput);
      const recentNoise: string[] = [];
      noise.onNoise.add((event) => {
        recentNoise.push(`${event.source} ${event.radius.toFixed(1)} m`);
        if (recentNoise.length > 12) {
          recentNoise.shift();
        }
      });
      // DN5: T toggles fast time (development only), to review dusk and night quickly.
      scene.onBeforeRenderObservable.add(() => {
        if (devInput.wasPressed("KeyT")) {
          world.clock.speed = world.clock.speed === 1 ? CONFIG.dayNight.devFastForward : 1;
        }
      });
      // Lets the browser console (and automated checks) read the player state: silentHunt.player().
      Object.assign(window, {
        silentHunt: {
          time: () => ({ phase: world.clock.phase, seconds: Math.round(world.clock.time) }),
          noise: () => ({ current: footsteps.currentRadius(), recent: [...recentNoise] }),
          branchesNear: (radius: number) =>
            world.chunks.branchesNear(player.position.x, player.position.z, radius),
          stepOnBranchAt: (x: number, z: number) => world.chunks.stepOnBranch(x, z),
          setTime: (seconds: number) => world.clock.setTime(seconds),
          player: () => player.debugState(),
          groundType: () => world.terrain.groundTypeAt(player.position.x, player.position.z),
          activeMeshes: () => scene.getActiveMeshes().length,
          trianglesDrawn: () => scene.getActiveIndices() / 3,
          chunksWithColliders: () =>
            scene.transformNodes.filter((node) => node.name.startsWith("chunkPhysics")).length,
        },
      });
    }
  }

  attachFpsCounter(engine, fpsElement);
  // Imported only inside this branch so the Inspector (React + editors, ~28 MB) never reaches the
  // production build: Vite removes the whole branch when DEV is false.
  if (import.meta.env.DEV) {
    const { enableInspectorToggle } = await import("./core/devTools");
    enableInspectorToggle(scene);
  }

  engine.runRenderLoop(() => {
    scene.render();
    input?.endFrame();
  });
  window.addEventListener("resize", () => engine.resize());
}

void start();
