/**
 * Every tunable value of the game lives here (ADR-08, G16).
 * Values marked "provisional" will be replaced by later issues.
 */
export const CONFIG = {
  physics: {
    /** Gravity on the Y axis, in m/s². */
    gravity: -9.81,
    /**
     * Longest step the player controller simulates in one frame, in seconds. A very long frame
     * (e.g. coming back from another tab) is cut to this, so the player never tunnels through the
     * ground. Babylon already caps rigid bodies at 0.1 s per step.
     */
    maxPlayerStepSeconds: 1 / 30,
  },
  player: {
    /** Speeds in m/s (J1). */
    walkSpeed: 1.6,
    runSpeed: 4.5,
    crouchSpeed: 0.9,
    /** Eye height above the feet, in meters (J2). */
    eyeHeight: 1.7,
    crouchEyeHeight: 1.0,
    /** Jump height in meters (J2). */
    jumpHeight: 0.6,
    /** Collision capsule: radius, and how far it reaches above the eyes. */
    capsuleRadius: 0.3,
    headroomAboveEyes: 0.1,
    /**
     * Share of the gap between current and desired speed closed each frame (Babylon's controller
     * "acceleration" gain). Higher on the ground for a crisp stop; low in the air so a jump
     * cannot change direction much.
     */
    groundResponse: 0.4,
    airResponse: 0.05,
    /** How far above the ground the player still counts as standing on it, in meters. */
    groundContactTolerance: 0.02,
    /** How fast the view moves between standing and crouching eye heights, in m/s. */
    crouchTransitionSpeed: 4,
    /** Mouse look, in radians per pixel moved (J3). */
    mouseSensitivity: 0.002,
    /** How far up or down the player can look, in radians (about 85°). */
    maxPitch: 1.48,
    /** Where the player starts (inside the clearing around the origin, CONFIG.world). */
    spawn: { x: 0, z: -6 },
    stamina: {
      /** RF-42 (G6). */
      max: 100,
      runCostPerSecond: 15,
      recoveryPerSecond: 20,
    },
    /** RF-40 (G6, NBB-136). */
    health: {
      max: 100,
      /** Healing per second: only by day (VD7-B) and with hunger above `hungerToHeal`. */
      regenPerSecond: 1,
      hungerToHeal: 50,
      /** VD3-B: healing starts this long after the last damage. */
      regenDelaySeconds: 5,
      /** VD2: below this, the screen edges pulse dark red. */
      lowHealth: 30,
    },
    /** RF-41 (G6, NBB-142). */
    hunger: {
      max: 100,
      /** From full to empty in 2 day-night cycles (32 min). */
      emptySeconds: 1920,
      /** With hunger at 0: this much health lost every `starveEverySeconds`. */
      starveDamage: 1,
      starveEverySeconds: 2,
      /** FO4-B: hunger after respawning. */
      respawnValue: 50,
      /** RF-35: what each meat gives. */
      rawMeat: 10,
      cookedMeat: 30,
      /** Q does nothing above this (the player is full). */
      fullAbove: 95,
    },
  },
  /** The infinite forest (NBB-129). */
  world: {
    /** World seed used until the menu/save lets the player pick one (NBB-147, NBB-150). */
    defaultSeed: 2026,
    /** G5: square chunks of this size, loaded in this radius (in chunks) around the player. */
    chunkSize: 64,
    loadRadius: 2,
    /** Chunks with collision (trunks, big rocks, terrain): the player can only reach these. */
    colliderRadius: 1,
    /** Distance between terrain vertices, in meters (MW1). */
    terrainCell: 2,
    /** MW1: gentle hills up to ± this height, about this far apart (meters). */
    hillHeight: 6,
    hillSpacing: 100,
    /** MW4: nothing is drawn beyond this distance (the fog hides it anyway). */
    drawDistance: 90,
    /**
     * Copies farther than this from the player are left out of the GPU lists (small things vanish
     * in the fog sooner). Without it, all 25 loaded chunks were drawn: ~2.8 million triangles.
     */
    copyDistance: { tree: 90, medium: 70, small: 45 },
    /** The lists of nearby copies are rebuilt after the player walks this far (meters). */
    copyRefreshDistance: 8,
    /** MW3-A: variations generated per model at startup, then repeated across the world. */
    variantsPerModel: 8,
    /** Each repeated copy gets a random size within ± this fraction. */
    scaleJitter: 0.15,
    /** MW2: average amounts per chunk (64 × 64 m). */
    perChunk: { trees: 80, bushes: 40, rocks: 15, branches: 30, tufts: 150 },
    /** MW2: share of each tree species. */
    treeMix: { pine: 0.45, oak: 0.35, deadTree: 0.2 },
    /** MW2: regions. Clearings keep this share of trees; dense woods multiply them. */
    clearingTrees: 0.1,
    denseTrees: 1.5,
    /** Size of clearings and dense patches, in meters. */
    regionSpacing: 120,
    /** No trees, rocks or bushes this close to the starting point. */
    spawnClearRadius: 6,
    /** MW5: only rocks at least this big block the player. */
    blockingRockSize: 0.6,
    /** MW6: size of the ground-type patches, in meters. */
    groundPatchSpacing: 35,
    /** MW6: tint of the forest floor per ground type (multiplies the floor texture). */
    groundTints: {
      dirt: { r: 1, g: 1, b: 1 },
      moss: { r: 0.8, g: 1.1, b: 0.75 },
      leaves: { r: 1.05, g: 0.95, b: 0.8 },
      twigs: { r: 0.95, g: 0.88, b: 0.8 },
    },
  },
  /** Day and night cycle (RF-05, G4) and its light and fog (NBB-130). */
  dayNight: {
    /** G4: the day lasts 10 min, including 1 min of dawn at the start and 1 min of dusk at the end. */
    daySeconds: 600,
    nightSeconds: 360,
    dawnSeconds: 60,
    duskSeconds: 60,
    /** RF-05: the game starts in the morning (seconds after dawn begins). */
    startSeconds: 90,
    /** G11: how far the player can see in the fog, in meters. */
    dayVisibility: 40,
    nightVisibility: 15,
    /** DN3: fog (and sky) colors. RGB from 0 to 1. */
    dayFog: { r: 0.5, g: 0.55, b: 0.58 },
    duskFog: { r: 0.52, g: 0.43, b: 0.37 },
    nightFog: { r: 0.05, g: 0.065, b: 0.095 },
    /** Light from the whole sky (soft, from every direction). */
    dayAmbient: { intensity: 0.55, color: { r: 0.9, g: 0.95, b: 1 } },
    nightAmbient: { intensity: 0.22, color: { r: 0.35, g: 0.45, b: 0.75 } },
    /** Direct light: the sun by day, a faint bluish moon by night (DN2). */
    sunIntensity: 0.75,
    sunColor: { r: 1, g: 0.96, b: 0.88 },
    duskSunColor: { r: 1, g: 0.65, b: 0.4 },
    moonIntensity: 0.3,
    moonColor: { r: 0.55, g: 0.65, b: 1 },
    /** DN5: how much faster time runs while the dev key T is on. */
    devFastForward: 20,
  },
  /** Noise (M1-B, NBB-131): every action is a circle of sound; whoever is inside hears it. */
  noise: {
    /** RF-10 (G3): radius in meters per action. */
    radius: {
      crouchStep: 2,
      walkStep: 6,
      runStep: 15,
      landing: 8,
      chop: 25,
      build: 20,
      knife: 3,
      bow: 8,
      shotgun: 150,
    },
    /** RF-11 (G3): the ground multiplies movement noise. Twigs ground = leaves (NO4). */
    groundMultiplier: { moss: 0.7, dirt: 1, leaves: 1.4, twigs: 1.4 },
    /** RF-11: stepping on a visible dry branch snaps it: one loud crack (NO4-B). */
    branchSnapRadius: 12,
    /** NO4-B: the feet step on a branch when this close (meters) to its middle. */
    branchStepDistance: 0.4,
    /** NO3: seconds between footsteps per gait. */
    stepInterval: { crouch: 0.8, walk: 0.55, run: 0.35 },
  },
  /** The torch (NBB-132). */
  torch: {
    /** RF-14 (G11): the light reaches about this far (meters). */
    lightRange: 12,
    lightIntensity: 3.2,
    lightColor: { r: 1, g: 0.62, b: 0.3 },
    /** TO3: how much the light trembles (0 = steady). */
    flicker: 0.12,
    /** RF-14: seconds a torch burns while lit. */
    burnSeconds: 240,
    /** TO4: in the last seconds the flame shrinks and sputters. */
    dyingSeconds: 20,
    /**
     * MA1: the torch is held in the left fist. Where the bottom of its handle sits, relative to
     * the wrist (meters: right, up, forward), and how it leans (radians).
     */
    heldOffset: { x: 0, y: -0.3, z: -0.05 },
    heldTilt: { forward: 0.3, inward: 0.1 },
    /** Flame and fire colors. */
    flameColor: { r: 1, g: 0.55, b: 0.18 },
  },
  /** RF-13 (G11, TO5): how far away the player can be seen. */
  visibility: {
    dark: 8,
    day: 20,
    /** With a lit torch, or next to a lit campfire (NBB-146). */
    lit: 40,
    /** Crouching halves the distance. */
    crouchFactor: 0.5,
  },
  /** The creature's behavior (G12, RF-20 to RF-24, IA1–IA7). Distances in meters, times in seconds. */
  creature: {
    /** TM1-B: size of the whole model (mesh, bones, eyes, animations): ~3 m to the skull. */
    scale: 1.3,
    /** RF-21: how far from the player it wanders. */
    roamDistance: { day: [60, 120], night: [30, 60] },
    /** IA2 (meters per second). Investigating uses the stalking top speed. */
    speed: { roam: 1.2, stalkMax: 3, attack: 7, retreat: 7, backOff: 1.5 },
    /**
     * Speed at which each animation's feet match the ground at scale 1 (the animation speeds up
     * with the body; a bigger creature takes longer strides, so these grow with `scale`).
     */
    animationSpeed: { Andar: 1.2, Espreitar: 1, Recuar: 7 },
    /** AP1-A: by day it flees when the player gets this close (fraction of the fog distance)... */
    dayFleeFogFraction: 0.6,
    /** ...or runs toward it (closing in faster than `chaseSpeed`) within this distance. */
    dayFleeChaseDistance: 30,
    chaseSpeed: 3,
    /** AP2-A: at night it attacks at once when the player comes this close without a lit torch. */
    nightAttackDistance: 8,
    /** IA3: stalks at this fraction of how far the player sees in the fog. */
    stalkFogFraction: 0.9,
    /** IA5: at night, roams this long before it finds the player and starts stalking. */
    nightRoamSeconds: [20, 40],
    /** IA5: by day, stalks from afar every 2–4 min, for 30 s, without attacking. */
    dayStalkEvery: [120, 240],
    dayStalkSeconds: 30,
    /** RF-22: at night, attacks after stalking this long. */
    attackAfterSeconds: [20, 40],
    /** RF-21: after the strike, flees and only roams again after this long. */
    retreatSeconds: [60, 90],
    /** RF-23: health taken by the strike. */
    damage: 40,
    /** Starts the strike at this distance; the hit lands if the player is still this close. */
    strikeDistance: 2,
    hitDistance: 2.5,
    /** IA4-B: the player "looks at" it within this cone (degrees) at the center of the screen. */
    lookConeDegrees: 25,
    /** IA4-B: stared at this long, it backs away into the fog for `backOffSeconds`. */
    stareSeconds: 4,
    backOffSeconds: 6,
    /** IA5: it sees the player inside this cone (degrees), as far as the VisibilitySystem says. */
    viewConeDegrees: 120,
    /** IA5: by day it only investigates noises at least this big (the shotgun). */
    dayNoiseMinRadius: 50,
    /** Looks around this long where the noise was, then goes back to roaming. */
    investigateLookSeconds: 5,
    /** IA6: farther than this from the player, it reappears out of sight at roaming distance. */
    relocateDistance: 150,
    /** RF-24: never closer than this to a lit campfire (NBB-146). */
    fireKeepAway: 8,
    /** RF-24: a lit torch looked at closer than this makes it hesitate, then flee. */
    torchHesitateDistance: 10,
    hesitateSeconds: 1.2,
    /** IA1: obstacle avoidance (body radius, how far ahead it looks for trunks, turn rate). */
    bodyRadius: 0.5,
    avoidDistance: 2.5,
    turnRate: 4,
    /** Avoidance is skipped this far from the player (nobody sees it, chunks may be unloaded). */
    avoidanceRange: 100,
    /** OL1-B: the eyes shine through the fog, fading out this fraction beyond the fog distance. */
    eyes: {
      fadeBeyondFog: 0.3,
      /** Halo around each eye: size (meters), how far in front of the socket, brightness. */
      haloSize: 0.2,
      haloForward: 0.06,
      haloStrength: 0.9,
    },
    /** SO2, SO3 (RF-25): its sounds, all 3D. Volumes go from 0 to 1. */
    sounds: {
      /** SO1-A: files in `public/sounds/creature/` (CC0, from Freesound; see CREDITS.md). */
      files: {
        steps: ["step-1.mp3", "step-2.mp3", "step-3.mp3", "step-4.mp3", "step-5.mp3", "step-6.mp3"],
        breath: "breath.mp3",
        growl: "growl.mp3",
      },
      /** Heard up to this distance (meters), fading linearly. */
      hearingDistance: 25,
      /** One footstep every half cycle of the animation (seconds at normal speed). */
      stepEvery: { Andar: 0.7, Espreitar: 1, Recuar: 0.3 },
      stepVolume: { Andar: 0.7, Espreitar: 0.4, Recuar: 1 },
      /** Each step's pitch varies by up to ±10%, so they do not sound repeated. */
      pitchJitter: 0.1,
      /** SO3: slow raspy breathing while it stalks closer than this (meters). */
      breathDistance: 20,
      breathVolume: 0.6,
      /** Seconds for the breathing to fade in or out. */
      breathFade: 1.5,
      /** SO3: short low growl when the attack begins. */
      growlVolume: 1,
    },
  },
  /** The knife (RF-32, MA2, MA4). Meters and seconds. */
  knife: {
    bladeLength: 0.18,
    handleLength: 0.11,
    /** RF-32: reach, inside a cone at the center of the screen (degrees). */
    reach: 1.5,
    coneDegrees: 30,
    /** MA4: the thrust lasts 0.4 s and lands at its farthest point; a new one after 0.6 s. */
    stabSeconds: 0.4,
    hitAtSeconds: 0.24,
    cooldownSeconds: 0.6,
  },
  /** The bow and arrows (RF-33, AR1–AR8). Meters, seconds, meters per second. */
  bow: {
    /** AR1: provisional arrows until crafting (NBB-144). */
    startArrows: 10,
    /** RF-33 / AR2: full draw in 1 s; releasing before `minDraw` cancels the shot. */
    fullDrawSeconds: 1,
    minDraw: 0.15,
    /** AR3-A: arrow speed from a short pull to a full draw. */
    minSpeed: 15,
    maxSpeed: 45,
    /** Arrows that fly this long without hitting anything are gone. */
    maxFlightSeconds: 5,
    /** AR5: chance of breaking on impact, and how close E picks one up. */
    breakChance: 0.25,
    pickupDistance: 2,
    /** AR4: a missed arrow makes this much noise where it lands; a wounded deer runs slower. */
    impactNoise: 4,
    woundedSpeedFactor: 0.75,
    /** AR2: zoom while aiming (camera field of view, radians; the normal one is 0.8). */
    aimFov: 0.6,
    /** AR6: model sizes. */
    bowLength: 1.2,
    arrowLength: 0.7,
  },
  /** The shotgun (RF-34, ES2, ES3, ES5). Meters and seconds. */
  shotgun: {
    /** RF-34: one shot kills any prey up to here; beyond, it misses. */
    range: 40,
    /** ES3: the spread of the shot (degrees, the whole cone). */
    coneDegrees: 4,
    /** ES2: two barrels; reloading takes 2 s. */
    barrels: 2,
    reloadSeconds: 2,
    /** Time between shots (the second barrel can fire right after the first). */
    shotSeconds: 0.35,
    /** ES3: muzzle flash and recoil. */
    flashSeconds: 0.06,
    recoilSeconds: 0.25,
    aimFov: 0.62,
    /** ES4-A: files in `public/sounds/shotgun/` (CC0, from Freesound; see CREDITS.md). */
    sounds: {
      shot: "shot.mp3",
      reload: "reload.mp3",
      shotVolume: 1,
      reloadVolume: 0.8,
    },
  },
  /** The abandoned cabins (RF-34, ES1, ES5). Meters. */
  cabins: {
    /** ES1: the first cabin, with the shotgun, this far from the start in a seeded direction. */
    firstDistance: 60,
    /** ES1: other cabins, rare: the chance per chunk, and never this close to the start. */
    chancePerChunk: 1 / 12,
    othersMinDistance: 120,
    /** The ground is flat inside `flatRadius` and blends back into the hills by `blendRadius`. */
    flatRadius: 4,
    blendRadius: 8,
    /** No trees, bushes, rocks or branches this close (a small clearing). */
    clearRadius: 6.5,
    /** ES5 / RF-34: what the chests hold. */
    firstCartridges: 4,
    chestCartridgeChance: 0.35,
    chestCartridges: [1, 2],
    /** E reaches the chest, the table or an arrow this close. */
    interactDistance: 1.8,
    /** ES5: how long the "Você encontrou..." message stays. */
    messageSeconds: 3,
  },
  /** NBB-142: cleaning a carcass (RF-35, CA1-B to CA4-A). */
  carcass: {
    /** CA1-B: hold E this long, standing still, with the knife in hand (CA2-A). */
    harvestSeconds: { rabbit: 2, deer: 5 },
    /** RF-30, CA4-A: what each animal gives. */
    meat: { rabbit: 1, deer: 4 },
    leather: { rabbit: 0, deer: 1 },
    /** E reaches a carcass this close (meters, to the middle of its body). */
    reach: { rabbit: 1.5, deer: 2.2 },
  },
  /** NBB-142: the campfire (CZ1-A) and cooking on it (CZ2-A). */
  campfire: {
    /** CZ1-A (provisional): G places it this far ahead (meters). */
    placeDistance: 1.8,
    /** Its light: orange like the torch's, wider and stronger. */
    lightRange: 14,
    lightIntensity: 1.6,
    flicker: 0.12,
    /** RF-13: this close to the lit fire, the player is seen from `visibility.lit`. */
    litRadius: 8,
    /** CZ2-A / RF-35: meat cooks in 10 s, up to 4 at a time. */
    cookSeconds: 10,
    slots: 4,
    /** E reaches the spit this close (meters). */
    reach: 2,
  },
  /** MA5: how much the hands sway (meters): breathing standing still, and with each step. */
  handSway: { still: 0.003, walk: 0.008, run: 0.02, crouch: 0.005 },
  /** The prey (RF-30, RF-31, PR1–PR5). Distances in meters, times in seconds. */
  prey: {
    /** PR1: per chunk, the chance of a few rabbits and of a small group of deer. */
    rabbitChance: 0.4,
    rabbitsPerChunk: [1, 2],
    deerChance: 0.2,
    deerPerGroup: [1, 3],
    /** How far apart the deer of a group graze. */
    groupSpread: 5,
    /** PR1: farther than this from the player they stand still, without thinking or animating. */
    activeDistance: 70,
    /** PR2: the deer is twice as wary: it hears and sees twice as far as the rabbit. */
    senseFactor: { rabbit: 1, deer: 2 },
    /**
     * FA1-A: while grazing they are distracted and hear only this fraction of a noise's radius
     * (a crouched step on leaves, 2.8 m, reaches a grazing rabbit only within 1.4 m).
     */
    grazeHearing: 0.5,
    /** PR2: field of view (degrees): a blind spot of 90° behind them. */
    viewConeDegrees: 270,
    /** PR2: a second noise within this long turns the alert into flight. */
    alertSeconds: 5,
    /** RF-31: they run for 10–15 s, then graze again. */
    fleeSeconds: [10, 15],
    /** PR4 (meters per second); also the speed at which each running animation looks right. */
    fleeSpeed: { rabbit: 7, deer: 9 },
    /** PR5: they run from the creature when it comes this close. */
    creatureFleeDistance: 20,
    /** PR3-A: grazing in place, turning now and then; the rabbit hops to a new spot. */
    turnEvery: [6, 12],
    turnRate: 0.6,
    hopEvery: [10, 20],
    hopSeconds: 0.8,
    hopSpeed: 1.5,
    /** Obstacle avoidance while running (IA1). */
    bodyRadius: { rabbit: 0.15, deer: 0.35 },
  },
  /** SO4: sound. The player's volume control comes with the options menu (NBB-150). */
  audio: {
    masterVolume: 0.8,
  },
  /** HUD (NO1-A: Babylon GUI). */
  hud: {
    /** NO2: the noise meter is full at this radius (meters). */
    noiseMeterMax: 20,
    noiseMeterWidthPx: 220,
    /** How fast a step "pulse" fades, per second. */
    noisePulseFade: 3,
    /** VD1-C: health bar at the bottom left, shown only while health is not full. */
    healthBarWidthPx: 160,
    healthBarHideAfterSeconds: 3,
    healthBarColor: "#9e2b25",
    /** FO3-B: hunger bar next to the health bar, shown only below `hungerBarBelow`; pulses below `hungerBarPulseBelow`. */
    hungerBarColor: "#c8892a",
    hungerBarBelow: 50,
    hungerBarPulseBelow: 20,
    /** FO1-A: the provisional food counter (raw and cooked meat, leather) at the bottom right. */
    counterGapPx: 24,
    /** VD2: red flash on every hit, camera shake, and the slow dark-red pulse at low health. */
    damageFlashSeconds: 0.4,
    damageShakeSeconds: 0.25,
    damageShakeRadians: 0.03,
    lowHealthPulseSeconds: 1.6,
    /** VD4: the death screen fades to black in this long. */
    deathFadeSeconds: 1.5,
  },
  /** DN4 (G14): film grain, darker screen edges, and glow for the creature's eyes and fire. */
  postProcessing: {
    grainIntensity: 8,
    vignetteWeight: 2.5,
    glowIntensity: 0.8,
  },
  /** Base colors of the procedural models (W2, inside the G14 palette). RGB from 0 to 1. */
  palette: {
    bark: { r: 0.3, g: 0.25, b: 0.21 },
    pineNeedles: { r: 0.11, g: 0.2, b: 0.19 },
    oakLeaves: { r: 0.25, g: 0.3, b: 0.16 },
    deadWood: { r: 0.52, g: 0.5, b: 0.47 },
    rock: { r: 0.4, g: 0.4, b: 0.38 },
    moss: { r: 0.22, g: 0.3, b: 0.16 },
    grass: { r: 0.28, g: 0.34, b: 0.19 },
    /** The creature (CR2, CR4): near-black dry skin, bleached deer skull, antlers, eyes (G15). */
    creatureSkin: { r: 0.1, g: 0.09, b: 0.085 },
    creatureBone: { r: 0.76, g: 0.72, b: 0.64 },
    creatureAntler: { r: 0.5, g: 0.44, b: 0.35 },
    creatureEyes: { r: 1, g: 0.94, b: 0.7 },
    /** CO4: the prey. Gray-brown rabbit with a light tail; muted red-brown doe, light belly. */
    rabbitFur: { r: 0.42, g: 0.35, b: 0.28 },
    rabbitLight: { r: 0.78, g: 0.74, b: 0.68 },
    deerFur: { r: 0.5, g: 0.33, b: 0.22 },
    deerLight: { r: 0.78, g: 0.7, b: 0.6 },
    /** Noses, hooves and eyes. */
    animalDark: { r: 0.06, g: 0.05, b: 0.05 },
    /** MA1, MA2: the player's coat sleeves and hands; the knife's steel and handle. */
    coat: { r: 0.16, g: 0.15, b: 0.12 },
    skin: { r: 0.7, g: 0.54, b: 0.44 },
    knifeBlade: { r: 0.56, g: 0.57, b: 0.58 },
    knifeHandle: { r: 0.2, g: 0.13, b: 0.08 },
    /** AR6: the bow's wood and string, the arrow's shaft, stone tip and feathers. */
    bowWood: { r: 0.34, g: 0.23, b: 0.14 },
    bowString: { r: 0.75, g: 0.72, b: 0.64 },
    arrowShaft: { r: 0.55, g: 0.45, b: 0.32 },
    arrowTip: { r: 0.3, g: 0.3, b: 0.3 },
    arrowFeathers: { r: 0.7, g: 0.68, b: 0.62 },
    /** ES1, ES2: weathered cabin logs, the roof, the chest's metal; the shotgun's steel and wood. */
    cabinLogs: { r: 0.42, g: 0.37, b: 0.31 },
    cabinRoof: { r: 0.3, g: 0.27, b: 0.23 },
    chestWood: { r: 0.32, g: 0.22, b: 0.14 },
    darkMetal: { r: 0.16, g: 0.16, b: 0.17 },
    gunSteel: { r: 0.22, g: 0.23, b: 0.25 },
    gunWood: { r: 0.36, g: 0.21, b: 0.12 },
    /** CZ3: raw and cooked meat; the campfire's charred wood and ash; bones of the remains (CA3-B). */
    meatRaw: { r: 0.56, g: 0.17, b: 0.15 },
    meatCooked: { r: 0.36, g: 0.21, b: 0.11 },
    meatFat: { r: 0.86, g: 0.78, b: 0.7 },
    charcoal: { r: 0.08, g: 0.07, b: 0.06 },
    ash: { r: 0.3, g: 0.29, b: 0.27 },
    bone: { r: 0.78, g: 0.74, b: 0.66 },
    blood: { r: 0.25, g: 0.05, b: 0.04 },
    /** Forest floor texture colors (the ground has no vertex colors). */
    groundDirt: { r: 0.2, g: 0.16, b: 0.12 },
    groundLitter: { r: 0.33, g: 0.25, b: 0.15 },
    groundMoss: { r: 0.18, g: 0.24, b: 0.13 },
    /** How much each face's color may drift from the base color (0 = none). */
    variation: 0.08,
  },
  /** Surface textures drawn by code (bark, rock, forest floor), with relief (normal maps). */
  surfaces: {
    /** Size in meters that one repeat of the bark texture covers on a trunk. */
    barkTileMeters: 0.8,
    /** Size in meters that one repeat of the forest floor texture covers. */
    groundTileMeters: 3,
    /** Strength of the relief effect (normal map) per surface. */
    barkRelief: 3,
    rockRelief: 2,
    groundRelief: 2.5,
    furRelief: 1.2,
    /** Size in meters that one repeat of the fur texture covers on an animal. */
    furTileMeters: 0.25,
  },
  /** Size ranges of the procedural models, [min, max] (W1). Lengths in meters. */
  models: {
    /** Conifer: straight trunk, drooping side branches covered in needle cards. */
    pine: { height: [8, 14], branches: [26, 34], needleCardsPerBranch: [6, 9] },
    /** Broadleaf: trunk forks into limbs (recursive), leaf cards at the outer twigs. */
    oak: { height: [6, 10], depth: 3, leafCardsPerTwig: [8, 12] },
    /** Gnarled bare tree with root flares; sometimes a second trunk from the base. */
    deadTree: { height: [5, 9], depth: 3, roots: [4, 6], secondTrunkChance: 0.35 },
    /** Dome of leaf cards around a few twigs. */
    bush: { height: [0.6, 1.2], leafCards: [35, 55] },
    rock: { size: [0.3, 1.5] },
    /** Knobbly stick with 0–2 short forks. */
    groundBranch: { length: [0.5, 1], forks: [0, 2] },
    /** 2–3 crossed grass cards. */
    groundTuft: { height: [0.2, 0.5], cards: [2, 3] },
  },
  /** Foliage sway (W3): sideways offset = strength × height² (meters), so the base stays still. */
  wind: {
    strength: 0.0008,
    speed: 1.2,
  },
  gallery: {
    /** Seed used when the gallery opens. */
    defaultSeed: 1,
    groundSize: 40,
    /**
     * Provisional light setups for reviewing models (GL3). The real day/night lighting comes in
     * NBB-130. Colors are RGB from 0 to 1.
     */
    lightModes: {
      day: {
        sunIntensity: 1,
        ambientIntensity: 0.6,
        ambientColor: { r: 1, g: 1, b: 1 },
        skyColor: { r: 0.62, g: 0.68, b: 0.72 },
        fogDensity: 0.01,
      },
      night: {
        sunIntensity: 0.05,
        ambientIntensity: 0.15,
        ambientColor: { r: 0.45, g: 0.55, b: 0.8 },
        skyColor: { r: 0.03, g: 0.04, b: 0.07 },
        fogDensity: 0.03,
      },
      fog: {
        sunIntensity: 0.6,
        ambientIntensity: 0.5,
        ambientColor: { r: 0.9, g: 0.95, b: 1 },
        skyColor: { r: 0.42, g: 0.47, b: 0.5 },
        fogDensity: 0.08,
      },
    },
  },
  debug: {
    /** Key that toggles the Babylon Inspector (development only, I2-A). */
    inspectorKey: "F9",
    /** How often the FPS counter refreshes, in milliseconds. */
    fpsRefreshMs: 250,
  },
} as const;
