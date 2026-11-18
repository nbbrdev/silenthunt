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
import { ShotgunControl } from "./player/shotgunControl";
import { InteractionSystem } from "./systems/interactions";
import { CabinManager } from "./world/cabins";
import { Equipment } from "./player/equipment";
import { PlayerHands } from "./player/hands";
import { PlayerHealth } from "./player/health";
import { PlayerHunger } from "./player/hunger";
import { Crafting } from "./player/crafting";
import { Eating } from "./player/eating";
import { BuildingMode } from "./systems/building";
import { ChoppingSystem } from "./systems/chopping";
import { StructureManager } from "./world/structures";
import { StumpField } from "./world/stumps";
import { Inventory } from "./player/inventory";
import type { Held, ItemId } from "./player/items";
import { PickupSystem } from "./systems/pickups";
import { createItemIcons } from "./ui/itemIcons";
import { InventoryScreen } from "./ui/inventoryScreen";
import { CarcassSystem } from "./systems/carcasses";
import { CampfireManager } from "./world/campfires";
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
    // NBB-143: the inventory and quick bar (RF-57); the player starts with nothing (PG1-A).
    const inventory = new Inventory();
    for (const { item, count, slot } of CONFIG.inventory.starterKit) {
      inventory.setSlot(slot, { item, count });
    }
    // TC1-A: F lights a torch from the inventory.
    const torch = new PlayerTorch(scene, hands.arms.leftHand, input, inventory, (text) =>
      interactions.say(text),
    );
    torch.onLitChanged.add((lit) => hands.showLeftHand(lit));
    const visibility = new VisibilitySystem(world.clock, player, torch);
    // NBB-136 / NBB-142: health heals by day only above 50 hunger; hunger at 0 starves.
    const health: PlayerHealth = new PlayerHealth(world.clock, (): number => hunger.value);
    const hunger: PlayerHunger = new PlayerHunger(health);
    scene.onBeforeRenderObservable.add(() => {
      const seconds = Math.min(engine.getDeltaTime() / 1000, 0.1);
      health.update(seconds);
      hunger.update(seconds);
    });
    const hud = createHud(scene, noise, () => footsteps.currentRadius(), health, hunger);
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
    const audio = createGameAudio(player.camera);
    audio
      .then((engine) => presence.loadSounds(engine))
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
    const interactions = new InteractionSystem(scene, input, player, hud);
    const equipment = new Equipment(scene, input, inventory);
    // NBB-144: crafting in the inventory screen, and the axe (felled trees leave stumps).
    const crafting = new Crafting(scene, inventory, (text) => interactions.say(text));
    const inventoryScreen = new InventoryScreen(scene, input, player, inventory, crafting, hud);
    const stumps = new StumpField(scene, world.chunks);
    const chopping = new ChoppingSystem(scene, input, player, equipment, hands, {
      chunks: world.chunks,
      stumps,
      noise,
      inventory,
      interactions,
    });
    // NBB-145: the player's buildings and the building mode (B). Walls stop the creature's strike.
    const structures = new StructureManager(scene, world.terrain, world.chunks, interactions);
    creatureBrain.wallBetween = (ax, az, bx, bz) => structures.blocksLine(ax, az, bx, bz);
    const building = new BuildingMode(
      scene,
      input,
      player,
      {
        structures,
        terrain: world.terrain,
        chunks: world.chunks,
        inventory,
        equipment,
        inventoryScreen,
        noise,
        interactions,
      },
      hud,
    );
    inventoryScreen.canOpen = () => !health.isDead;
    createItemIcons(engine)
      .then((icons) => inventoryScreen.setIcons(icons))
      .catch((error: unknown) => console.warn("Ícones dos itens não desenhados:", error));
    new PickupSystem(player, world.chunks, inventory, interactions);
    const eating = new Eating(scene, input, player, equipment, inventory, hunger, interactions);
    const bow = new BowControl(
      scene,
      input,
      player,
      hands,
      arrows,
      noise,
      equipment,
      hud,
      interactions,
      inventory,
    );
    // NBB-141: the cabins (the first one has the shotgun) and the shotgun itself (ES2).
    const shotgun = new ShotgunControl(
      scene,
      input,
      player,
      hands,
      equipment,
      {
        prey: () => prey.animals(),
        creature: creatureBrain,
        terrain: world.terrain,
        chunks: world.chunks,
        noise,
        inventory,
      },
      hud,
    );
    audio
      .then((engine) => shotgun.loadSounds(engine))
      .catch((error: unknown) => console.warn("Sons da espingarda não carregados:", error));
    const cabins = new CabinManager(
      scene,
      world.terrain,
      world.chunks,
      interactions,
      inventory,
      CONFIG.world.defaultSeed,
    );
    // NBB-142: carcasses (meat, fat, leather) and the campfire (G, CZ1-A).
    const carcasses = new CarcassSystem(
      scene,
      () => prey.animals(),
      world.chunks,
      equipment,
      inventory,
      interactions,
      CONFIG.world.defaultSeed,
    );
    const campfires = new CampfireManager(scene, input, player, {
      terrain: world.terrain,
      creature: creatureBrain,
      visibility,
      inventory,
      interactions,
    });
    const onHeld = (tool: Held) => {
      hands.equip(tool);
      knife.enabled = tool === "knife";
      // AR6, ES2: no free hand for the torch while holding the bow or the shotgun.
      torch.blocked = tool === "bow" || tool === "shotgun";
    };
    equipment.onChanged.add(onHeld);
    onHeld(equipment.current);

    // NBB-136: the strike hurts; dying shows the death screen and respawning starts a new life.
    creatureBrain.onPlayerHit.add((damage) => health.damage(damage));
    const gameInput = input;
    let lifeStart = world.clock.elapsed;
    const deathScreen = new DeathScreen(hud, scene, () => {
      // VD5: back at the start, full health, the creature far away; the clock and torch go on.
      player.respawn(feet);
      health.revive();
      // FO4-B: hungry, but not starving.
      hunger.set(CONFIG.player.hunger.respawnValue);
      creatureBrain.sendAway();
      player.controlsEnabled = true;
      gameInput.pointerLockEnabled = true;
      lifeStart = world.clock.elapsed;
    });
    health.onDied.add(() => {
      inventoryScreen.close(false);
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
          /** Selects the quick-bar slot holding this item, as 1 to 6 would. */
          equip: (item: Held) => equipment.equip(item),
          /** NBB-143: the inventory's slots, adding items, picking a slot, and Tab. */
          inventory: () =>
            Array.from({ length: inventory.size }, (_, index) => inventory.slot(index)),
          give: (item: ItemId, count = 1) => inventory.add(item, count),
          select: (slot: number) => inventory.select(slot),
          setSlot: (slot: number, item?: ItemId, count = 1) =>
            inventory.setSlot(slot, item ? { item, count } : undefined),
          toggleInventory: () => devInput.onKeyDownNow.notifyObservers("Tab"),
          inventoryOpen: () => inventoryScreen.isOpen,
          /** Eats the meat in hand, as the left button would. */
          eat: () => eating.eat(),
          /** NBB-144: swings the axe; starts a recipe by the item it makes; trees in reach. */
          swing: () => chopping.swing(),
          /** NBB-145: building mode on/off, pick a piece (0–3), place it, and what stands. */
          build: () => {
            building.toggle();
            return building.isActive;
          },
          buildPiece: (index: number) => building.select(index),
          place: () => building.placeNow(),
          dismantleHold: (hold?: boolean) => {
            building.debugHold = hold;
          },
          pieces: () => structures.list(),
          wallBetween: (ax: number, az: number, bx: number, bz: number) =>
            structures.blocksLine(ax, az, bx, bz),
          craft: (item: ItemId) => {
            const recipe = crafting.recipes.find((candidate) => candidate.item === item);
            if (recipe) {
              crafting.start(recipe);
            }
            return crafting.progress?.recipe.item;
          },
          choppables: (radius = 4) =>
            world.chunks
              .choppablesNear(player.feet.x, player.feet.z, radius)
              .map(({ kind, x, z, radius: size }) => ({
                kind,
                at: [Math.round(x * 10) / 10, Math.round(z * 10) / 10],
                radius: Math.round(size * 100) / 100,
              })),
          torch: () => ({ lit: torch.isLit, secondsLeft: Math.round(torch.remainingSeconds) }),
          /** CL1: branches, small stones and bushes within `radius` of the player. */
          pickables: (radius = 6) =>
            world.chunks
              .pickablesNear(player.feet.x, player.feet.z, radius)
              .map(({ kind, x, z }) => ({
                kind,
                at: [Math.round(x * 10) / 10, Math.round(z * 10) / 10],
              })),
          arrows: () => bow.arrowCount,
          lastArrow: () => arrows.lastLanding,
          /** NBB-142: hunger (a value sets it), what the player carries, and the campfire. */
          hunger: (value?: number) => {
            if (value !== undefined) {
              hunger.set(value);
            }
            return Math.round(hunger.value * 10) / 10;
          },
          food: () => ({
            rawMeat: inventory.count("rawMeat"),
            cookedMeat: inventory.count("cookedMeat"),
            fat: inventory.count("fat"),
            leather: inventory.count("leather"),
            cleaned: carcasses.cleanedCount,
          }),
          giveMeat: (amount = 1) => inventory.add("rawMeat", amount),
          campfire: () => ({
            at: campfires.position?.asArray().map((value) => Math.round(value * 10) / 10),
            spit: campfires.spit,
          }),
          placeFire: (x: number, z: number) => campfires.placeAt(x, z),
          /** The cabins around and the shotgun's cartridges (development). */
          cabins: () => cabins.sites,
          cartridges: () => shotgun.cartridges,
          /** Shotgun: fire, reload, and hold the aim button (no argument: real mouse). */
          fire: () => shotgun.debugFire(),
          reload: () => shotgun.debugReload(),
          shotgunAim: (aim?: boolean) => {
            shotgun.debugButtons = aim === undefined ? undefined : { aim };
          },
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
