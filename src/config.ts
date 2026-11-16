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
    /** TO2: where the torch is held, relative to the camera (meters: right, up, forward). */
    heldOffset: { x: 0.3, y: -0.62, z: 0.75 },
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
  /** HUD (NO1-A: Babylon GUI). */
  hud: {
    /** NO2: the noise meter is full at this radius (meters). */
    noiseMeterMax: 20,
    noiseMeterWidthPx: 220,
    /** How fast a step "pulse" fades, per second. */
    noisePulseFade: 3,
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
