import { Engine, Vector3, type Scene } from "@babylonjs/core";
import { CreatureBrainBehavior, STATE_NAMES } from "./ai/creatureBrain";
import { CreaturePresence } from "./ai/creaturePresence";
import { PreyManager } from "./ai/preyManager";
import { CONFIG } from "./config";
import { createGameAudio } from "./core/audio";
import { Input } from "./core/input";
import { createHavokPlugin } from "./core/physics";
import { creature } from "./models/creature/creature";
import { setupPostProcessing } from "./core/postProcessing";
import { Footsteps } from "./player/footsteps";
import { BowControl } from "./player/bowControl";
import { Equipment } from "./player/equipment";
import { PlayerHands } from "./player/hands";
import { PlayerHealth } from "./player/health";
import { KnifeAttack } from "./player/knifeAttack";
import { Player } from "./player/player";
import { PlayerTorch } from "./player/torch";
import { ArrowSystem } from "./systems/arrows";
import { NoiseSystem } from "./systems/noise";
import { VisibilitySystem } from "./systems/visibility";
import { createDamageEffects } from "./ui/damageEffects";
import { DeathScreen } from "./ui/deathScreen";
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
    // NBB-139: the arms on screen; the knife in the right hand, the torch in the left (MA1).
    const hands = new PlayerHands(scene, player);
    const torch = new PlayerTorch(scene, hands.arms.leftHand, input);
    torch.onLitChanged.add((lit) => hands.showLeftHand(lit));
    const visibility = new VisibilitySystem(world.clock, player, torch);
    const health = new PlayerHealth(world.clock);
    scene.onBeforeRenderObservable.add(() =>
      health.update(Math.min(engine.getDeltaTime() / 1000, 0.1)),
    );
    const hud = createHud(scene, noise, () => footsteps.currentRadius(), health);
    createDamageEffects(hud, scene, health, player);

    // The creature (NBB-133) and its brain (NBB-134).
    const creatureModel = creature.create(scene, CONFIG.world.defaultSeed);
    const creatureBrain = new CreatureBrainBehavior(
      {
        scene,
        player,
        torch,
        clock: world.clock,
        terrain: world.terrain,
        chunks: world.chunks,
        noise,
        visibility,
      },
      creatureModel.animations,
      CONFIG.world.defaultSeed,
    );
    creatureModel.root.addBehavior(creatureBrain);
    // NBB-135: its eyes and sounds. The game runs even if the sounds fail to load.
    const presence = new CreaturePresence(
      scene,
      creatureModel.root,
      creatureBrain,
      player.camera,
      world.clock,
      CONFIG.world.defaultSeed,
    );
    createGameAudio(player.camera)
      .then((audio) => presence.loadSounds(audio))
      .catch((error: unknown) => console.warn("Sons da criatura não carregados:", error));

    // NBB-138: rabbits and deer spread over the chunks (PR1).
    const prey = new PreyManager(
      {
        scene,
        player,
        visibility,
        noise,
        terrain: world.terrain,
        chunks: world.chunks,
        creaturePosition: () => creatureModel.root.position,
      },
      CONFIG.world.defaultSeed,
    );
    // NBB-139: the knife (RF-32, MA4).
    const knife = new KnifeAttack(scene, input, player, hands, noise, {
      prey: () => prey.animals(),
      creature: creatureBrain,
    });
    // NBB-140: the bow and arrows; 1 and 2 switch between knife and bow (AR1, provisional).
    const arrows = new ArrowSystem(
      scene,
      {
        terrain: world.terrain,
        chunks: world.chunks,
        noise,
        prey: () => prey.animals(),
        creature: creatureBrain,
      },
      CONFIG.world.defaultSeed,
    );
    const equipment = new Equipment(scene, input);
    const bow = new BowControl(scene, input, player, hands, arrows, noise, equipment, hud);
    equipment.onChanged.add((tool) => {
      hands.equip(tool);
      knife.enabled = tool === "knife";
      // AR6: no free hand for the torch while holding the bow.
      torch.blocked = tool === "bow";
    });

    // NBB-136: the strike hurts; dying shows the death screen and respawning starts a new life.
    creatureBrain.onPlayerHit.add((damage) => health.damage(damage));
    const gameInput = input;
    let lifeStart = world.clock.elapsed;
    const deathScreen = new DeathScreen(hud, scene, () => {
      // VD5: back at the start, full health, the creature far away; the clock and torch go on.
      player.respawn(feet);
      health.revive();
      creatureBrain.sendAway();
      player.controlsEnabled = true;
      gameInput.pointerLockEnabled = true;
      lifeStart = world.clock.elapsed;
    });
    health.onDied.add(() => {
      player.controlsEnabled = false;
      gameInput.pointerLockEnabled = false;
      creatureBrain.sendAway();
      deathScreen.show(Math.floor((world.clock.elapsed - lifeStart) / world.clock.cycleSeconds));
    });

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
          visibility: () => ({
            seenFrom: Math.round(visibility.visibleDistance() * 10) / 10,
            torchLit: torch.isLit,
            torchSecondsLeft: Math.round(torch.remainingSeconds),
          }),
          branchesNear: (radius: number) =>
            world.chunks.branchesNear(player.position.x, player.position.z, radius),
          stepOnBranchAt: (x: number, z: number) => world.chunks.stepOnBranch(x, z),
          setTime: (seconds: number) => world.clock.setTime(seconds),
          player: () => player.debugState(),
          creature: () => creatureBrain.debugState(),
          /** VD6: health, and a way to take damage without the creature. */
          health: () => Math.round(health.value * 10) / 10,
          damage: (amount: number) => {
            health.damage(amount);
            return Math.round(health.value * 10) / 10;
          },
          faceCreature: () => {
            const { x, z } = creatureModel.root.position;
            player.debugFace(x, z);
          },
          /** PR6: the animals within `radius` meters, nearest first. */
          prey: (radius = 80) => {
            const { x, z } = player.position;
            return prey
              .animals()
              .map((animal) => {
                const position = animal.attachedNode?.position;
                const distance = position ? Math.hypot(position.x - x, position.z - z) : Infinity;
                const at = [position?.x ?? 0, position?.z ?? 0].map(
                  (value) => Math.round(value * 10) / 10,
                );
                const heading = Math.round((animal.attachedNode?.rotation.y ?? 0) * 100) / 100;
                return {
                  id: animal.id,
                  kind: animal.kind,
                  state: animal.state,
                  distance,
                  at,
                  heading,
                };
              })
              .filter((animal) => animal.distance <= radius)
              .sort((a, b) => a.distance - b.distance)
              .map((animal) => ({ ...animal, distance: Math.round(animal.distance * 10) / 10 }));
          },
          /** Thrusts the knife, as a left click would. */
          stab: () => knife.attack(),
          /** Takes the knife or the bow, as 1 and 2 would. */
          equip: (tool: "knife" | "bow") => equipment.equip(tool),
          arrows: () => bow.arrowCount,
          lastArrow: () => arrows.lastLanding,
          /** Holds (true) or releases (false) the draw and aim buttons; no arguments: real mouse. */
          bowButtons: (draw?: boolean, aim?: boolean) => {
            bow.debugButtons = draw === undefined ? undefined : { draw, aim: aim ?? false };
          },
          /** Turns the view toward the point (x, z). */
          face: (x: number, z: number, y?: number) => player.debugFace(x, z, y),
          /** Height of the ground at (x, z). */
          groundAt: (x: number, z: number) => world.terrain.heightAt(x, z),
          /** Puts the player at (x, z) on the ground (to visit an animal or a place). */
          teleport: (x: number, z: number) =>
            player.respawn(new Vector3(x, world.terrain.heightAt(x, z), z)),
          creatureStep: (seconds: number) => {
            creatureBrain.simulate(seconds);
            return creatureBrain.debugState();
          },
          /** IA8: forces a state by its pt-BR name ("rondar", "espreitar", "atacar"...). */
          creatureState: (name: string) => {
            const state = STATE_NAMES[name];
            if (!state) {
              return `Estados: ${Object.keys(STATE_NAMES).join(", ")}`;
            }
            creatureBrain.forceState(state);
            return state;
          },
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
