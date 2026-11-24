import { Engine, Vector3, type Scene } from "@babylonjs/core";
import { CreatureBrainBehavior, STATE_NAMES } from "./ai/creatureBrain";
import { CreaturePresence } from "./ai/creaturePresence";
import { PreyManager } from "./ai/preyManager";
import { CONFIG } from "./config";
import { createGameAudio } from "./core/audio";
import { Input } from "./core/input";
import { createHavokPlugin } from "./core/physics";
import { frameSeconds } from "./core/gameTime";
import { applyVolumes, loadOptions } from "./core/options";
import { GameMenus } from "./ui/menus";
import { applyGameFont } from "./ui/hud";
import { creature } from "./models/creature/creature";
import { setupPostProcessing } from "./core/postProcessing";
import { Footsteps } from "./player/footsteps";
import { BowControl } from "./player/bowControl";
import { ShotgunControl } from "./player/shotgunControl";
import { InteractionSystem } from "./systems/interactions";
import { AmbienceSystem } from "./systems/ambience";
import { MusicPlayer, type MusicCue } from "./systems/music";
import { DayCues } from "./systems/dayCues";
import { DayMessage } from "./ui/dayMessage";
import { uiSounds, type UiSound } from "./ui/uiSounds";
import { PreySounds } from "./systems/preySounds";
import { CaughtSequence } from "./systems/caughtSequence";
import { HidingSystem } from "./systems/hiding";
import { ObjectiveSystem } from "./systems/objective";
import { WorldMap } from "./systems/worldMap";
import { Compass } from "./ui/compass";
import { NotePanel } from "./ui/notePanel";
import { VictoryScreen } from "./ui/victoryScreen";
import { MenuCinema } from "./ui/menuCinema";
import { StoneThrowSystem } from "./systems/stones";
import { ChaseEffects } from "./systems/chaseEffects";
import { SoundEffects } from "./systems/soundEffects";
import { CabinManager } from "./world/cabins";
import { BIOME_NAMES, type Biome } from "./world/biomes";
import { BiomeEffects } from "./systems/biomeEffects";
import { BiomeBanner } from "./ui/biomeBanner";
import { Equipment } from "./player/equipment";
import { PlayerHands } from "./player/hands";
import { PlayerHealth } from "./player/health";
import { PlayerHunger } from "./player/hunger";
import { Crafting } from "./player/crafting";
import { Eating } from "./player/eating";
import { BuildingMode } from "./systems/building";
import { ChoppingSystem } from "./systems/chopping";
import { StructureManager } from "./world/structures";
import { BedManager } from "./world/beds";
import { BackpackManager } from "./world/backpacks";
import { PlacingSystem } from "./systems/placing";
import { StumpField } from "./world/stumps";
import { Inventory, type Stack } from "./player/inventory";
import { KEPT_ON_DEATH, type Held, type ItemId } from "./player/items";
import { PickupSystem } from "./systems/pickups";
import { SaveGame } from "./systems/saveGame";
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
    // MN1-C: the game's font is ready before any text is drawn.
    await document.fonts.load(`20px "${CONFIG.hud.fontFamily}"`).catch(() => undefined);
    const physics = await createHavokPlugin();
    const world = createWorld(engine, physics, CONFIG.world.defaultSeed);
    scene = world.scene;
    input = new Input(canvas);
    const { spawn } = CONFIG.player;
    const feet = new Vector3(spawn.x, world.terrain.heightAt(spawn.x, spawn.z), spawn.z);
    const player = new Player(scene, input, feet);
    // MN4: the player's options (kept in the browser, apart from the world).
    const options = loadOptions();
    player.sensitivityScale = options.sensitivity;
    const pipeline = setupPostProcessing(scene, player.camera);
    // NBB-159: while the main menu's film runs, the world loads around its camera.
    scene.onBeforeRenderObservable.add(() =>
      world.chunks.update(film.isActive ? film.focus : player.position),
    );
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
      const seconds = frameSeconds(scene);
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
    // NBB-163 (BM1, BM8): what the biome where the player stands changes in the play.
    const biomeEffects = new BiomeEffects(scene, world.terrain, world.chunks, player);
    player.groundEffect = (direction) => biomeEffects.groundEffect(direction);
    footsteps.biome = biomeEffects;
    visibility.biomeSight = (distance) => biomeEffects.sightDistance(distance);
    presence.hearingScale = () => biomeEffects.creatureHearingFactor;
    const audio = createGameAudio(player.camera);
    audio
      .then((audio) => presence.loadSounds(audio))
      .catch((error: unknown) => console.warn("Sons da criatura não carregados:", error));
    // NBB-153: the chase as the player feels it (heartbeat, dark edges, shaking, panting).
    const chaseEffects = new ChaseEffects(scene, hud, player, creatureBrain, presence);
    audio
      .then((audio) => chaseEffects.loadSounds(audio))
      .catch((error: unknown) => console.warn("Sons da perseguição não carregados:", error));
    // NBB-155 (GF4-C): "pego", the fatal strike. The view turns to the face, between its eyes.
    const creatureEyes = [0, 1].map((index) => scene.getMeshByName(`creatureEye${index}`));
    const caught = new CaughtSequence(scene, player, () => {
      const [left, right] = creatureEyes;
      if (left && right) {
        return left.getAbsolutePosition().add(right.getAbsolutePosition()).scale(0.5);
      }
      return creatureModel.root.position.add(new Vector3(0, 2.5, 0));
    });
    audio
      .then((audio) => caught.loadSounds(audio))
      .catch((error: unknown) => console.warn("Sons do golpe não carregados:", error));
    audio
      .then((audio) => footsteps.loadSounds(audio))
      .catch((error: unknown) => console.warn("Sons dos passos não carregados:", error));
    // NBB-154: hiding in a bush, from the creature (it may lose the player) and from the prey.
    const hiding = new HidingSystem(scene, hud, {
      player,
      torch,
      chunks: world.chunks,
      clock: world.clock,
      noise,
    });
    visibility.hidden = () => hiding.isHidden;
    creatureBrain.isPlayerHidden = () => hiding.isHidden;
    hiding.onHid.add(() => creatureBrain.playerHid());
    hiding.onSniffed.add(() => creatureBrain.sniffOut());
    audio
      .then((audio) => hiding.loadSounds(audio))
      .catch((error: unknown) => console.warn("Som da moita não carregado:", error));
    // NBB-149: the forest's sound (SM4-A) and the music, by day (SM5-A).
    const ambience = new AmbienceSystem(scene, world.clock, player.camera);
    audio
      .then((audio) => ambience.loadSounds(audio))
      .catch((error: unknown) => console.warn("Sons do ambiente não carregados:", error));
    // NBB-161 (MF4-A): the main menu's theme plays while the main menu is open.
    const music = new MusicPlayer(scene, world.clock, (): boolean => menus.isMainMenu);
    audio
      .then((audio) => music.load(audio))
      .catch((error: unknown) => console.warn("Música não carregada:", error));

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
    // NBB-149: their sounds (alarm, running, the deer's cry).
    const preySounds = new PreySounds(scene, () => prey.animals(), player.camera);
    audio
      .then((audio) => preySounds.loadSounds(audio))
      .catch((error: unknown) => console.warn("Sons dos animais não carregados:", error));
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
    // NBB-158: G throws a stone, to make noise far away (RF-65).
    const stones = new StoneThrowSystem(
      scene,
      {
        input,
        player,
        inventory,
        interactions,
        world: { terrain: world.terrain, chunks: world.chunks, noise, prey: () => prey.animals() },
        say: (text) => interactions.say(text),
      },
      CONFIG.world.defaultSeed,
    );
    // NBB-149: the sounds of the bow, the knife, the arrows and the axe (FE1–FE7).
    const effects = new SoundEffects(scene);
    stones.sounds = effects;
    bow.sounds = effects;
    knife.sounds = effects;
    arrows.sounds = effects;
    chopping.sounds = effects;
    // CH1-B to CH3, AC1: fire, the torch and the actions.
    interactions.sounds = effects;
    eating.sounds = effects;
    building.sounds = effects;
    torch.sounds = effects;
    audio
      .then((audio) => effects.loadSounds(audio))
      .catch((error: unknown) => console.warn("Sons das ferramentas não carregados:", error));
    // NBB-162 (FX14, FX15): hurt, hungry, the backpack, something made; the bush sniffed at.
    health.onDamaged.add(() => {
      effects.play("hurtHit");
      effects.play("hurtBreath");
    });
    hunger.onGrowl.add(() => effects.play("stomach"));
    inventoryScreen.onToggled.add((open) => effects.play(open ? "bagOpen" : "bagClose"));
    crafting.onMade.add(() => effects.play("craft"));
    hiding.onSniffed.add(() => presence.sniffNow());
    // FX12-A: the menus' click follows the options' general and effects volumes.
    uiSounds.setGain(() => options.master * options.effects);
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
      .then((audio) => shotgun.loadSounds(audio))
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
    // NBB-146: campfires and beds, made by crafting and put down from the quick bar (FG1-A).
    const campfires = new CampfireManager(scene, player, {
      creature: creatureBrain,
      visibility,
      inventory,
      equipment,
      interactions,
    });
    const beds = new BedManager(
      scene,
      player,
      {
        clock: world.clock,
        hunger,
        inventory,
        interactions,
        creaturePosition: () => creatureModel.root.position,
      },
      hud,
    );
    const placing = new PlacingSystem(
      scene,
      input,
      player,
      {
        terrain: world.terrain,
        chunks: world.chunks,
        structures,
        campfires,
        beds,
        inventory,
        equipment,
      },
      hud,
    );
    campfires.sounds = effects;
    placing.sounds = effects;
    const onHeld = (tool: Held) => {
      hands.equip(tool);
      knife.enabled = tool === "knife";
      // AR6, ES2: no free hand for the torch while holding the bow or the shotgun.
      torch.blocked = tool === "bow" || tool === "shotgun";
    };
    equipment.onChanged.add(onHeld);
    onHeld(equipment.current);

    // NBB-136: the strike hurts (GF1-A: it kills); dying shows the death screen and respawning
    // starts a new life.
    let hitByCreature = false;
    creatureBrain.onPlayerHit.add((damage) => {
      hitByCreature = true;
      health.damage(damage);
      hitByCreature = false;
    });
    const gameInput = input;
    const life = {
      start: world.clock.elapsed,
      respawnHunger: CONFIG.player.hunger.respawnValue as number,
    };
    const deathScreen = new DeathScreen(hud, scene, () => {
      // VD5: back at the start, full health, the creature far away; the torch goes on.
      // RF-60 / CM1-A: at the bed, if there is one.
      player.respawn(beds.respawnPoint ?? feet);
      health.revive();
      // FO4-B: hungry, but not starving (less after a night skipped, GF5-B).
      hunger.set(life.respawnHunger);
      creatureBrain.sendAway();
      chaseEffects.resume();
      player.controlsEnabled = true;
      gameInput.pointerLockEnabled = true;
      life.start = world.clock.elapsed;
      // SV3: the new life is saved right away.
      void saveGame.save();
    });
    // NBB-148: what the player carried stays in a backpack where they died (RF-60, MO1-A).
    const backpacks = new BackpackManager(scene, player, {
      terrain: world.terrain,
      structures,
      inventory,
      interactions,
    });
    // NBB-156 (RF-66 to RF-68): the way out: the radio's cabins, notes, compass, ritual and the
    // last night, and the victory screen.
    const notePanel = new NotePanel(hud, gameInput, player);
    const compass = new Compass(hud, scene, player);
    const victoryScreen = new VictoryScreen(hud, scene, gameInput, {
      continuePlaying: () => {
        player.controlsEnabled = true;
        gameInput.pointerLockEnabled = true;
        gameInput.capturePointer();
      },
      mainMenu: (): void => menus.goToMain(),
    });
    const objective: ObjectiveSystem = new ObjectiveSystem({
      scene,
      ui: hud,
      input: gameInput,
      player,
      inventory,
      inventoryScreen,
      equipment,
      interactions,
      cabins,
      campfires,
      clock: world.clock,
      atmosphere: world.atmosphere,
      creature: creatureBrain,
      presence,
      notes: notePanel,
      victory: victoryScreen,
      sounds: effects,
      seed: CONFIG.world.defaultSeed,
      isPlaying: (): boolean => menus.isPlaying,
    });
    beds.sleepBlocked = () => objective.isLastNight;
    // NBB-157 (RF-69): M opens the map; its destination shows on the compass.
    const worldMap: WorldMap = new WorldMap(scene, hud, {
      input: gameInput,
      player,
      chunks: world.chunks,
      seed: CONFIG.world.defaultSeed,
      fires: () =>
        campfires.list.map(({ at, fuel }) => ({ x: at[0] ?? 0, z: at[2] ?? 0, lit: fuel > 0 })),
      beds: () => beds.saved.beds.map(({ x, z }) => ({ x, z })),
      knownCabins: () => objective.knownCabins,
      canOpen: (): boolean =>
        menus.isPlaying &&
        !health.isDead &&
        !notePanel.isOpen &&
        !victoryScreen.isOpen &&
        !inventoryScreen.isOpen,
    });
    compass.destination = () => worldMap.destinationPoint;

    // FX14: paper: a note read, the map opened or closed.
    notePanel.onRead.add(() => effects.play("note"));
    worldMap.onToggled.add(() => effects.play("map"));

    health.onDied.add(() => {
      // FX15: the heart beats twice more, slower, and stops.
      chaseEffects.heartStops();
      // Closing the screen puts back whatever the mouse was holding.
      inventoryScreen.close(false);
      // OB7-A, OB12: the radio, its parts and the skulls stay with the player.
      const slots = inventory.saved;
      const keep = (stack: Stack | null) => stack !== null && KEPT_ON_DEATH.includes(stack.item);
      const carried = slots.filter((stack): stack is Stack => stack !== null && !keep(stack));
      const loaded = shotgun.cartridges.loaded;
      if (loaded > 0) {
        carried.push({ item: "cartridge", count: loaded });
        shotgun.loadedCartridges = 0;
      }
      inventory.restore(
        slots.map((stack) => (keep(stack) ? stack : null)),
        inventory.selected,
      );
      const at = player.feet;
      backpacks.drop(at.x, at.y, at.z, player.view.yaw, carried);
      // OB12: counted, and the last night (if it was on) is lost, before the clock skips ahead.
      objective.playerDied();
      const days = Math.floor((world.clock.elapsed - life.start) / world.clock.cycleSeconds);
      // GF5-B: dying at night means waking at dawn. The clock skips ahead now (dawn begins as
      // dark as the night) and hunger drops for the time skipped, as when sleeping (DO1).
      const hungerSettings = CONFIG.player.hunger;
      life.respawnHunger = hungerSettings.respawnValue;
      if (world.clock.phase === "night") {
        const skipped = world.clock.skipToDawn();
        life.respawnHunger = Math.max(
          0,
          life.respawnHunger - (hungerSettings.max / hungerSettings.emptySeconds) * skipped,
        );
      }
      // MO5-A: saved now, as if already respawned.
      void saveGame.saveAfterDeath(beds.respawnPoint ?? feet, life.respawnHunger);
      player.controlsEnabled = false;
      gameInput.pointerLockEnabled = false;
      if (hitByCreature) {
        // GF4-C: "pego": the view turns to its face, then black at once.
        chaseEffects.silence();
        caught.start(() => {
          creatureBrain.sendAway();
          deathScreen.show(days, true);
        });
        return;
      }
      creatureBrain.sendAway();
      deathScreen.show(days);
    });

    // NBB-147: the save in IndexedDB (SV1-A to SV5). Opening the game continues the saved world.
    const saveGame = new SaveGame(
      scene,
      {
        clock: world.clock,
        player,
        health,
        hunger,
        torch,
        inventory,
        shotgun,
        chunks: world.chunks,
        stumps,
        prey,
        cabins,
        structures,
        campfires,
        beds,
        backpacks,
        creature: creatureBrain,
        interactions,
        life,
        heldByMouse: () => inventoryScreen.heldByMouse,
        objective,
        map: worldMap,
      },
      hud,
    );
    const hasSave = await saveGame.load();

    // NBB-159 (CI1-A to CI9): the main menu's film, under the menus.
    const film: MenuCinema = new MenuCinema({
      scene,
      playerCamera: player.camera,
      pipeline,
      clock: world.clock,
      atmosphere: world.atmosphere,
      terrain: world.terrain,
      creature: { root: creatureModel.root, animations: creatureModel.animations },
      presence,
      hearFrom: (camera) => {
        void audio.then((sound) => sound.engine.listener.attach(camera)).catch(() => undefined);
      },
      isMainMenu: (): boolean => menus.isMainMenu,
    });

    // NBB-150: the menus (MN2-A to MN7). The game opens on the main menu, with the world frozen.
    void audio.then((audio) => applyVolumes(options, audio)).catch(() => undefined);
    const menus = new GameMenus(scene, {
      input,
      player,
      hud,
      audio,
      options,
      hasSave,
      // MF15-A: only a private chase track (MT1-C) still comes from the Epidemic Sound folder.
      hasMusic: () => chaseEffects.usesPrivateMusic,
      // Not while a note is open (or just closed with Esc), nor on the victory screen.
      canPause: () =>
        player.controlsEnabled && !health.isDead && !notePanel.justClosed && !victoryScreen.isOpen,
      save: () => saveGame.save(),
      newWorld: () => saveGame.newWorld(),
      progress: () => objective.progress,
    });
    inventoryScreen.canOpen = () =>
      !health.isDead &&
      menus.isPlaying &&
      !notePanel.isOpen &&
      !victoryScreen.isOpen &&
      !worldMap.isOpen;
    // NBB-161 (MF10-B to MF14-B): the dawn's and the dusk's piece and message; the victory's music.
    const dayCues = new DayCues({
      scene,
      clock: world.clock,
      music,
      message: new DayMessage(hud, scene),
      isPlaying: () => menus.isPlaying,
      isDead: () => health.isDead,
      isChased: () => creatureBrain.isChasing,
      // FX6-A: the helicopter's approach comes before the rescue's victory (no dawn message then).
      isVictory: () => victoryScreen.isOpen || objective.rescueArriving,
    });
    biomeEffects.active = () => !menus.isMainMenu;
    // NBB-163 (BM6-A): the biome's name, entering a new one.
    new BiomeBanner(
      hud,
      scene,
      () => biomeEffects.biome,
      () => menus.isPlaying,
    );
    victoryScreen.onRevealed.add(() => void music.startVictory());
    victoryScreen.onClosed.add(() => music.stopVictory());
    // MN1-C: the whole HUD in the game's font, now that it is built.
    applyGameFont(hud);

    if (import.meta.env.DEV) {
      const devInput = input;
      const { enableNoiseRings } = await import("./core/devNoiseRings");
      enableNoiseRings(scene, noise, devInput);
      // EQ2-A: F2 shows the test panel (time, health, hunger, stamina, creature, FPS).
      const { enableDevPanel } = await import("./core/devPanel");
      enableDevPanel(engine, devInput, {
        clock: () => ({
          day: Math.floor(world.clock.elapsed / world.clock.cycleSeconds) + 1,
          phase: world.clock.phase,
          seconds: world.clock.time,
        }),
        health: () => health.value,
        hunger: () => hunger.value,
        stamina: () => player.stamina,
        creature: () => {
          const { state, distance } = creatureBrain.debugState();
          // The state by its pt-BR name ("rondar", "espreitar"...), as in IA8.
          const name = Object.entries(STATE_NAMES).find(([, value]) => value === state)?.[0];
          return { state: name ?? state, distance };
        },
      });
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
          /** NBB-158: the thrown stones (flying, on the ground) and where the last one stopped. */
          stones: () => ({ ...stones.debugCounts, last: stones.lastLanding }),
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
          /** NBB-146: the fires (where, fuel, spit), putting one down, the held item down, beds. */
          campfires: () => campfires.list,
          placeFire: (x: number, z: number) =>
            campfires.placeAt(x, world.terrain.heightAt(x, z), z),
          placeHeld: () => placing.placeNow(),
          bed: () => ({
            respawn: beds.respawnPoint?.asArray().map((value) => Math.round(value * 10) / 10),
            sleeping: beds.isSleeping,
          }),
          /** NBB-149: the music (what plays, seconds to the next, the menu's theme); the next now. */
          music: () => music.debugState(),
          musicNext: () => music.debugNext(),
          /** NBB-161 (MF16): plays one piece ("dawn", "dusk", "victory", "menu"); the dawn's message. */
          musicCue: (cue: MusicCue) => music.debugCue(cue),
          dawnMessage: () => dayCues.debugDawn(),
          /** NBB-162 (FX15): plays an effect by name (no name: lists them); its call; a click. */
          sound: (name?: string) => {
            const names = effects.names;
            const found = names.find((effect) => effect === name);
            if (found) {
              effects.play(found, player.position);
            }
            return found ?? names;
          },
          creatureCall: () => presence.debugCall(),
          click: (kind: UiSound = "confirm") => uiSounds.play(kind),
          /** NBB-153: whether the creature is chasing and how strong the chase feels (0 to 1). */
          chase: () => ({
            chasing: creatureBrain.isChasing,
            distance: Math.round(creatureBrain.playerDistance * 10) / 10,
            intensity: chaseEffects.debugIntensity,
            music: chaseEffects.debugMusic,
          }),
          /** NBB-154: whether the player is hidden in a bush, for how long, and which bush. */
          hidden: () => hiding.debugState(),
          /** NBB-156: the way out (notes, rescue, ritual, deaths, cabins) and the rescue call. */
          objective: () => objective.debugState(),
          callRescue: () => objective.debugCallRescue(),
          /** NBB-159: the film's state, and a jump to a shot (0 to 4) at a moment. */
          film: () => film.debugState(),
          filmShot: (index: number, seconds = 2) => film.debugShot(index, seconds),
          /** NBB-157: the map's state, and a mark at (x, z) (optionally the destination). */
          map: () => worldMap.debugState(),
          mapMark: (x: number, z: number, destination = false) =>
            worldMap.debugMark(x, z, destination),
          /** What E would do now (development). */
          interaction: () => interactions.debugNearest,
          /** NBB-149: how many prey sounds have played (alarm, cry, deer and rabbit running). */
          preySounds: () => ({ ...preySounds.played }),
          /** NBB-149: how many times each tool or weapon sound has played. */
          effects: () => ({ ...effects.played }),
          /** Kills an animal by its id (see `prey()`), as a hit would. */
          killPrey: (id: string) =>
            prey
              .animals()
              .find((animal) => animal.id === id)
              ?.kill(),
          /** NBB-149: the ambience (loop volumes, next lone sound); a lone sound now. */
          ambience: () => ambience.debugState(),
          ambienceOneShot: () => ambience.debugOneShot(),
          /** NBB-148: the backpacks on the ground. */
          backpacks: () => backpacks.list,
          /** NBB-147: saves now; forgets the saved world and starts a new one (SV2-A). */
          save: () => saveGame.save(),
          /** NBB-150: which menu is open ("jogo" if none); leave the menus and play. */
          menu: () => menus.current,
          play: () => menus.debugPlay(),
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
          /** NBB-163 (BM8): the biome where the player stands, and its weights there. */
          biome: () => {
            const { x, z } = player.position;
            const weights = world.terrain.biomeWeightsAt(x, z);
            return {
              biome: BIOME_NAMES[world.terrain.biomeAt(x, z)],
              weights: Object.fromEntries(
                Object.entries(weights).map(([name, value]) => [
                  name,
                  Math.round(value * 100) / 100,
                ]),
              ),
              effects: biomeEffects.debugState(),
              seenAt: Math.round(visibility.visibleDistance() * 10) / 10,
            };
          },
          /**
           * NBB-163 (BM8): to the middle of the nearest patch of a biome ("pinheiral", "bosque",
           * "pântano", "campo" or "serra"), searched in rings around the player.
           */
          goToBiome: (name: string) => {
            const wanted = (Object.keys(BIOME_NAMES) as Biome[]).find((biome) =>
              BIOME_NAMES[biome]
                .toLowerCase()
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .startsWith(name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")),
            );
            if (!wanted) {
              return `Bioma desconhecido: ${name}`;
            }
            const { x, z } = player.position;
            for (let ring = 50; ring <= 5000; ring += 50) {
              for (let angle = 0; angle < Math.PI * 2; angle += 50 / ring) {
                const px = x + Math.cos(angle) * ring;
                const pz = z + Math.sin(angle) * ring;
                if (world.terrain.biomeWeightsAt(px, pz)[wanted] >= 0.99) {
                  player.respawn(new Vector3(px, world.terrain.heightAt(px, pz) + 0.5, pz));
                  return { x: Math.round(px), z: Math.round(pz) };
                }
              }
            }
            return "Não encontrado a até 5 km";
          },
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
