import { Engine, type Scene } from "@babylonjs/core";
import { createDemoScene } from "./core/demoScene";
import { Input } from "./core/input";
import { createHavokPlugin } from "./core/physics";
import { Player } from "./player/player";
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
    scene = createDemoScene(engine, physics);
    input = new Input(canvas);
    const player = new Player(scene, input);
    if (import.meta.env.DEV) {
      // Lets the browser console (and automated checks) read the player state: silentHunt.player().
      Object.assign(window, { silentHunt: { player: () => player.debugState() } });
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
