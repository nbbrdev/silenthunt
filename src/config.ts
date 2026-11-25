import type { ItemId, Recipe } from "./player/items";

/** NBB-159 (CI9): one shot of the main menu's film. Points are [x, height above ground, z]. */
export interface CinematicShot {
  name: string;
  camera?: { from: number[]; to: number[] };
  target?: { from: number[]; to: number[] };
  /** Circles `center` at `radius` and `height`, from one angle to another (radians). */
  orbit?: { center: number[]; radius: number; height: number; from: number; to: number };
  creature?: {
    at: number[];
    to?: number[];
    heading: number;
    animation: "Andar" | "Espreitar";
    goneAt?: number;
  };
  /** The camera looks at the creature (the walking shot). */
  follow?: boolean;
  breath?: boolean;
  growlAt?: number;
  /** A dying fire, only to be seen, at [x, z]. */
  fire?: number[];
}

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
    /** Speeds in m/s (J1; AJ2-A raised them from 1.6, 4.5 and 0.9; PS9-A, run 5.5 → 5.8). */
    walkSpeed: 2.4,
    runSpeed: 5.8,
    crouchSpeed: 1.3,
    /** Eye height above the feet, in meters (J2). */
    eyeHeight: 1.7,
    crouchEyeHeight: 1.0,
    /** Jump height in meters (J2). */
    jumpHeight: 0.6,
    /** BM1 (NBB-163): falling more than `safeDrop` m hurts this much per meter beyond it. */
    fall: { safeDrop: 4, damagePerMeter: 12 },
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
      /** PS2, PS9-A: ~17 s of running (it was 15, ~7 s; then 10, ~10 s). */
      runCostPerSecond: 6,
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
      /** FX14: below a quarter, the stomach growls every 40–80 s. */
      growlBelow: 0.25,
      growlEvery: [40, 80] as const,
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
    perChunk: { trees: 80, bushes: 40, rocks: 15, branches: 30, tufts: 150, looseStones: 20 },
    /** AJ1-A: size of the loose small stones (meters); all can be picked up (below MW5's 0.6). */
    looseStoneSize: [0.2, 0.45] as const,
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
      /** NBB-163: the marsh's dark wet mud and the field's dry grass. */
      mud: { r: 0.75, g: 0.72, b: 0.65 },
      grass: { r: 1.05, g: 1.05, b: 0.9 },
    },
  },
  /**
   * NBB-163 (BI1, BI2-A, BM2-A, BM3-A, BM8): the biomes, in irregular cells of 400–800 m drawn
   * from the seed, blending over 40 m. The start and the cabins keep firm, wooded ground.
   */
  biomes: {
    /** BM2-A: each cell's chance of being each biome. */
    shares: { pineForest: 0.4, broadleaf: 0.15, marsh: 0.15, field: 0.15, ridge: 0.15 },
    /** The grid the cells' centers are scattered on (meters): cells of about 400–800 m. */
    cellSize: 600,
    /** The cells' borders wander this far (meters), so they are not straight lines. */
    borderWarp: 90,
    /** BM8: two biomes blend over this width at their border (meters). */
    blendMeters: 40,
    /** BM8: always pine forest this close to the start (the menu's film, the first cabins). */
    startRadius: 200,
    /** BM3-A: around each cabin, pine forest or broadleaf wood (no mud, no cliffs). */
    cabinRadius: 40,
    /** Over this distance (meters) a forced biome blends back into the cell's own. */
    forceBlend: 30,
    /**
     * BM8: the land of each biome. The field's hills are flatter; the marsh lies lower and almost
     * flat; the ridge rises up to `ridgeHeight` m in steps of `stepHeight` m, the last
     * `stepSharpness` of each step a steep face (where the rock walls go).
     */
    /**
     * BM8: what grows in each biome. `treeShare` scales the trees (1 = as the pine forest);
     * `treeMix` is each species' share. The extras are tried per chunk and kept where the biome is.
     */
    vegetation: {
      treeShare: { pineForest: 1, broadleaf: 1, marsh: 0.4, field: 0.1, ridge: 0.35 },
      treeMix: {
        broadleaf: { pine: 0.15, oak: 0.45, deadTree: 0, birch: 0.4 },
        marsh: { pine: 0.15, oak: 0, deadTree: 0.65, birch: 0.2 },
        field: { pine: 0.45, oak: 0.35, deadTree: 0.2, birch: 0 },
        ridge: { pine: 0.7, oak: 0, deadTree: 0.3, birch: 0 },
      },
      /** Tries per chunk of each extra (BM1: twice the bushes in the wood, twice the stones in the field). */
      extraBushes: 40,
      reeds: 70,
      puddles: 14,
      tallGrass: 160,
      extraStones: 20,
      boulders: 12,
      cliffs: 40,
      /** Reeds and tall grass grow in patches: where this noise (0–1) is above the line. */
      patchSpacing: 25,
      patchAbove: 0.45,
      /** Rock walls go where the ridge's ground is steeper than this (rise per meter), 9 m apart. */
      cliffSlope: 0.6,
      cliffSpacing: 9,
    },
    /** BM1, BM8: how each biome changes the play (see BiomeEffects). */
    rules: {
      /** Broadleaf wood: the steps' noise radius is multiplied by this. */
      broadleafStepNoise: 1.5,
      /** Marsh: speed in the mud (off the trails); the fog's reach is multiplied by `marshFog`. */
      mudSpeed: 0.5,
      marshFog: 0.6,
      /** Marsh: reeds hide a crouching player this close (meters), like a bush. */
      reedsReach: 1.5,
      /** Open field: standing, the distance the player is seen at is multiplied by this. */
      fieldSight: 1.5,
      /** Open field: crouched within this of tall grass, the player is seen only within `tallGrassSeen`. */
      tallGrassReach: 1,
      tallGrassSeen: 15,
      /** Ridge: climbing steeper than this (degrees) is slower and tiring, as running is. */
      climbDegrees: 15,
      climbSpeed: 0.7,
      /** Ridge: the player's steps and the creature's carry this much as far. */
      ridgeNoise: 0.7,
    },
    /** BM8: the marsh's trails of firm ground: about 3 m wide, winding (a noise of this scale). */
    marsh: { trailSpacing: 70, trailBand: 0.025 },
    /** BM8: the ground's tint in each biome (multiplies the forest floor's). */
    groundTints: {
      pineForest: { r: 1, g: 1, b: 1 },
      broadleaf: { r: 1.12, g: 0.95, b: 0.75 },
      marsh: { r: 0.72, g: 0.78, b: 0.62 },
      field: { r: 1.2, g: 1.12, b: 0.78 },
      ridge: { r: 0.78, g: 0.8, b: 0.86 },
    },
    relief: {
      fieldHills: 0.5,
      marshHills: 0.15,
      marshDrop: -2,
      ridgeHeight: 25,
      ridgeSpacing: 160,
      stepHeight: 4,
      stepSharpness: 0.3,
    },
  },
  /**
   * NBB-164 (AG1-A, BI5): the water simulated over the land. The world is computed in square
   * regions with a margin shared with the neighbors (so rivers can carry on across); each cell of
   * the grid drains to its lowest neighbor; where much water gathers is a river, where it pools
   * is a lake.
   */
  water: {
    /** Rivers: about this far apart (the noise's scale, meters), winding by up to `riverWarp`. */
    riverSpacing: 750,
    riverWarp: 220,
    /** Half the river's width, from narrow to wide along it (meters), and its depth. */
    riverHalfWidth: [3, 7] as const,
    riverDepth: 2.2,
    /** AG9-A: shallow fords where a noise of this scale rises above the line (~every 80–150 m). */
    fordSpacing: 60,
    fordAbove: 0.66,
    fordDepth: 0.5,
    /** Lakes: basins where a noise of this scale rises above the line; deeper away from shore. */
    lakeSpacing: 260,
    lakeAbove: 0.74,
    lakeDepth: 3.5,
    lakeRamp: 10,
    /** AG2-A: in the marsh, many more lakes and shallow ones. */
    marshLakeAbove: 0.58,
    marshLakeDepth: 0.8,
    /** The water's surface lies this far below the land's broad shape (meters). */
    below: 0.8,
    /** The low bank along the water: this wide, this high above the water. */
    bankWidth: 10,
    bankRise: 0.3,
    /** AG10-A: no water this close to the start or a cabin; it fades in over `clearBlend`. */
    clearStart: 200,
    clearCabins: 40,
    clearBlend: 30,
    /** Nothing is placed in the water, but reeds where it is at most this deep. */
    reedsDepth: 0.4,
    /**
     * NBB-165 (CC1-A): finding the waterfalls. Regions of `region` m are searched on a grid of
     * `sample` m (with `margin` m more around them); a drop of the river's surface of at least
     * `minDrop` m between two neighbors is a waterfall; drops in a chain, each within `gather` m of
     * the next and about as high, are the same one.
     */
    falls: {
      region: 128,
      sample: 4,
      minDrop: 1.5,
      gather: 6,
      margin: 24,
      /** CC2-A: the pool at the foot (meters); its bed deepens over `poolRamp` from its rim. */
      poolRadius: 6,
      poolDepth: 3,
      poolRamp: 3,
    },
  },
  /** NBB-164 (BI3-B, AG3-B, AG14): wading, swimming and diving. Meters, seconds. */
  swimming: {
    /** Water up to this above the feet slows the walk (wading); from `swimDepth` on, the player swims. */
    wadeDepth: 0.3,
    wadeSpeed: 0.6,
    swimDepth: 1.3,
    /** Surface swimming; Shift is faster and tires like running; swimming slowly tires half as much. */
    swimSpeed: 1.6,
    sprintSpeed: 2.4,
    slowCost: 0.5,
    /** Treading water still tires this much (a share of running's cost). */
    floatCost: 0.25,
    /** Diving (C held) and coming up (Space); underwater the player swims where they look. */
    verticalSpeed: 1.2,
    underwaterSpeed: 1.4,
    /** At the surface the eyes float this far above the water. */
    floatEyes: 0.15,
    /** Out of stamina, the player sinks this fast. */
    sinkSpeed: 0.5,
    /** The air: seconds underwater; refills in `refillSeconds`; then drowning hurts this much per second. */
    airSeconds: 20,
    refillSeconds: 2,
    drownDamage: 10,
    /** AG4-A: the torch goes out with the water at the chest; it will not light above the waist. */
    torchOutDepth: 1.2,
    torchLightDepth: 1,
    /** Noise: each stroke at the surface (every `strokeSeconds`), falling into deep water. */
    strokeNoise: 8,
    strokeSeconds: 0.9,
    splashNoise: 15,
    /** Wading steps are this much louder than walking. */
    wadeNoise: 1.5,
    /** No fall damage landing in water at least this deep. */
    softLandingDepth: 1.5,
    /** Underwater: green-blue fog, seeing this far; outside sounds muffled to this share. */
    underwaterFog: { r: 0.05, g: 0.12, b: 0.11 },
    underwaterVisibility: 6,
    muffled: 0.4,
    /** After this long underwater, coming up gasps (FX13's caught breath). */
    gaspAfterSeconds: 3,
    files: {
      enter: "player/water-enter.mp3",
      swim: "player/swim.mp3",
      underwater: "ambience/underwater.mp3",
    },
    volume: { enter: 0.9, exit: 0.45, swim: 0.5, underwater: 0.6 },
  },
  /**
   * NBB-165: the waterfalls in the world. Particles only within `particleDistance` m (CC3-A);
   * the roar (CC4-A, CC10-1) heard up to `hearingDistance` m, from at most `roarCount` of them;
   * within `maskDistance` m, noise carries `maskFactor` of its reach (CC5-A). The curtain is
   * `extraWidth` m wider than the river's lip, so its sides tuck into the banks.
   */
  waterfalls: {
    particleDistance: 60,
    sound: "ambience/waterfall.mp3",
    volume: 0.8,
    hearingDistance: 40,
    roarCount: 3,
    maskDistance: 15,
    maskFactor: 0.5,
    extraWidth: 2,
  },
  /** NBB-164 (BI6-B, AG8-A): the water's surface, drawn with Babylon's water material. */
  waterSurface: {
    /** Grid of the surface sheet (meters). */
    cell: 2,
    /** AG8-A: the reflection's image (pixels). */
    reflectionSize: 512,
    windForce: -4,
    bumpHeight: 0.25,
    waveLength: 0.08,
    /** Dark, cold water; how much of that color shows over the reflection. */
    color: { r: 0.05, g: 0.08, b: 0.09 },
    colorBlend: 0.45,
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
    /** BM10-C, BM11-B (NBB-163): the marsh's mud and the field's dry tall grass. */
    groundMultiplier: { moss: 0.7, dirt: 1, leaves: 1.4, twigs: 1.4, mud: 1.2, grass: 1.1 },
    /** RF-11: stepping on a visible dry branch snaps it: one loud crack (NO4-B). */
    branchSnapRadius: 12,
    /** NO4-B: the feet step on a branch when this close (meters) to its middle. */
    branchStepDistance: 0.4,
    /** NO3: seconds between footsteps per gait. */
    stepInterval: { crouch: 0.8, walk: 0.55, run: 0.35 },
  },
  /**
   * NBB-149 (PA1–PA6): the sound of the player's own steps, from `public/sounds/player/` (CC0, see
   * CREDITS.md). Each ground has 6 steps; the same steps are quieter or louder by gait (PA6-A).
   */
  footstepSounds: {
    stepsPerGround: 6,
    snaps: 4,
    /** Volume by gait (0 to 1); crouched steps are also a little lower in pitch (muffled). */
    volume: { crouch: 0.22, walk: 0.45, run: 0.75 },
    crouchRate: 0.9,
    /** Soft ground sounds softer (RF-11). */
    groundVolume: { dirt: 1, moss: 0.75, leaves: 0.9, twigs: 0.9, mud: 0.9, grass: 0.8 },
    /** Each step's pitch varies by up to ±8%, so they do not sound repeated. */
    pitchJitter: 0.08,
    /** NO4-B: the branch cracking underfoot, loud even when crouching. */
    snapVolume: 0.9,
    /** Landing after a jump: a heavy dirt step, lower in pitch. */
    landingVolume: 0.85,
    landingRate: 0.75,
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
  /**
   * NBB-154 (RF-64; MI1-A to MI10): hiding in a bush. Within `bushRadius` of a bush's center,
   * crouched and with the torch out, the player is hidden: nobody sees them, except the creature
   * within `findDistance`. Going in or out rustles (and makes noise). At night, after
   * `sniffSeconds` hidden in the same bush, the creature sniffs them out.
   */
  hiding: {
    bushRadius: 0.7,
    findDistance: 2,
    sniffSeconds: 60,
    rustleFile: "player/rustle.mp3",
    rustleVolume: 0.5,
    rustleNoise: 4,
    /** MI6-A: dark green leafy screen edges while hidden. */
    edgeColor: "rgba(16, 30, 12, 1)",
    edgeAlpha: 0.55,
    edgeFadeSeconds: 0.3,
  },
  /**
   * NBB-158 (RF-65; PD1-B to PD8): G throws a stone from the inventory. It leaves the eyes at
   * `speed` along the view and falls with gravity (like arrows, AR3-A); where it lands it makes
   * `landingNoise`. The throw itself makes `throwNoise`. Thrown stones stay on the ground (at most
   * `maxOnGround`, not saved) and can be picked up again.
   */
  stoneThrow: {
    speed: 14,
    cooldownSeconds: 0.8,
    throwNoise: 3,
    landingNoise: 20,
    /** Size of the thrown stone (meters). */
    size: 0.15,
    maxOnGround: 30,
    maxFlightSeconds: 5,
    /**
     * TR1-A to TR6: holding G shows the path as dots (every `dotSpacing`, `dotSize` wide) and a
     * ring (`ringRadius`) where the stone will stop; they glow and ignore the fog (TR4-A).
     */
    preview: {
      dotSpacing: 0.5,
      dotSize: 0.05,
      /** No dots this close to the eyes: up close they cover the middle of the view. */
      firstDotDistance: 2,
      ringRadius: 0.3,
      color: { r: 0.95, g: 0.95, b: 0.9 },
      alpha: 0.5,
    },
  },
  /**
   * NBB-156 (RF-66 to RF-68; OB1 to OB13): the way out. Three cabins hold the radio's parts at
   * `cabinDistances` from the start (± `distanceJitter`); notes give the next one's direction and
   * distance (rounded to `noteDistanceStep`). The ritual burns 3 deer skulls in a lit fire, at
   * night, with the creature within `ritualCreatureDistance`. The last night turns red.
   */
  objective: {
    cabinDistances: [150, 300, 500],
    distanceJitter: 0.1,
    noteDistanceStep: 50,
    /** OB6-A: the opening sentence stays this long. */
    introSeconds: 6,
    ritualSkulls: 3,
    ritualCreatureDistance: 20,
    ritualHoldSeconds: 2,
    /** OB12: banished, it runs off for this long before it is gone. */
    banishFleeSeconds: 3,
    /** FX6-A, FX15: the rescue's helicopter is heard this long before its victory; then fades. */
    helicopterSeconds: 10,
    helicopterFadeSeconds: 1.5,
    /** FX15: the radio's static before the voice answers (and the message shows). */
    radioStaticSeconds: 3,
    /** OB12: the screen darkens over this long before a victory. */
    victoryFadeSeconds: 2,
    /** OB4-A, OB11-B, OB12: the last night. */
    lastNight: {
      fog: { r: 0.12, g: 0.02, b: 0.02 },
      ambient: { r: 0.7, g: 0.18, b: 0.15 },
      eyes: { r: 1, g: 0.15, b: 0.1 },
      /** The red comes in (and goes) over this long. */
      fadeSeconds: 8,
      searchSeconds: [40, 60] as [number, number],
    },
  },
  /**
   * NBB-157 (RF-69; MP1-A to MP8): the map. The world is split into `cellSize` squares; those
   * within `revealRadius` of the player become explored (checked every `revealSeconds`). The sheet
   * is `width` × `height` pixels, north up, with `metersPerPixel` zoom levels.
   */
  map: {
    cellSize: 8,
    revealRadius: 40,
    revealSeconds: 1,
    width: 760,
    height: 560,
    metersPerPixel: [0.5, 1, 2],
    startZoom: 1,
    maxMarks: 12,
    /** A click this close (pixels) to a mark picks the mark. */
    markPickPixels: 12,
    cabinVisitDistance: 15,
    destinationReachDistance: 5,
    colors: {
      explored: "#d6cdb9",
      unexplored: "#5d5446",
      ink: "#2f281f",
      tree: "rgba(47, 40, 31, 0.55)",
      mark: "#8c2a1e",
      fireLit: "#d9762b",
      fireOut: "#7d766b",
      /** NBB-164 (AG14): lakes and rivers. */
      water: "#8fa3ad",
      /** NBB-165 (CC6-A): the waterfalls' strokes. */
      waterfall: "#3f5f70",
    },
    /**
     * BM5-A, BM8 (NBB-163): the explored paper's tone in each biome: dark green, ocher, gray-green,
     * straw yellow and gray (light enough for the ink).
     */
    biomeColors: {
      pineForest: "#c3c8a6",
      broadleaf: "#d9c49a",
      marsh: "#b7bfaa",
      field: "#e2d7a4",
      ridge: "#c6c3bd",
    },
  },
  /**
   * NBB-159 (CI1-A to CI9): the main menu's film. Shots near the start (the seed is always the
   * same), each `shotSeconds` long, with a fade through black of `fadeSeconds`; heights are above
   * the ground. The fog is lighter and bluish (`fogColor`, `fogBlend`) so her silhouette shows.
   */
  cinematic: {
    shotSeconds: 8,
    fadeSeconds: 0.3,
    /** Going into the game: to black and back in this long. */
    exitSeconds: 0.3,
    fogColor: { r: 0.1, g: 0.12, b: 0.17 },
    fogBlend: 1,
    /** CI4-A: the handheld sway (radians and meters). */
    swayAngle: 0.004,
    swayMeters: 0.012,
    /** CI7-A: the black bars' height (share of the screen) and the dark edges. */
    barShare: 0.09,
    edgeAlpha: 0.6,
    breathVolume: 0.6,
    /**
     * CI9: the shots. Camera and target move from `from` to `to` ([x, height, z]); `creature`
     * places her ([x, z], facing `heading` radians) with an animation, optionally walking to `to`
     * or gone at `goneAt` seconds; `growlAt` growls; `fire` lights a dying fire at [x, z].
     */
    shots: [
      {
        name: "Clareira",
        camera: { from: [-14, 0.9, -12], to: [-9, 1, -9] },
        target: { from: [0, 1, -6], to: [0, 1.1, -6] },
      },
      {
        name: "Olhos",
        camera: { from: [2, 1.5, -2], to: [2, 1.5, 0] },
        target: { from: [3, 2.9, 7], to: [3, 2.9, 7] },
        creature: { at: [3, 7], heading: Math.PI + 0.14, animation: "Espreitar", goneAt: 5 },
        breath: true,
      },
      {
        name: "Cabana",
        orbit: { center: [56.46, -26.3], radius: 10, height: 2, from: 2.5, to: 2.15 },
        fire: [53.56, -24.95],
      },
      {
        name: "Silhueta",
        camera: { from: [-15, 1.4, 5], to: [-12, 1.4, 5] },
        target: { from: [-13.5, 2.2, 14], to: [-12, 2.2, 14] },
        creature: { at: [-12, 14], heading: Math.PI / 2, animation: "Espreitar" },
        breath: true,
        growlAt: 7,
      },
      {
        name: "Passagem",
        camera: { from: [10, 1.6, -34], to: [10, 1.6, -34] },
        creature: { at: [0, -24], to: [20, -24], heading: Math.PI / 2, animation: "Andar" },
        follow: true,
        breath: true,
      },
    ] as CinematicShot[],
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
    speed: { roam: 1.2, stalkMax: 3, attack: 6, retreat: 7, backOff: 1.5 },
    /** PS1-A, PS9-A (NBB-153): the attack is a chase, a little faster than the player's run (5.8), that gives up after this long. */
    chaseGiveUpSeconds: 25,
    /**
     * NBB-164 (AG5-A): it does not go into water deeper than this; kept from the player by the
     * water, it circles the shore and gives up after `giveUpSeconds`.
     */
    water: { maxDepth: 1, giveUpSeconds: 40 },
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
    /** RF-23, GF1-A (NBB-155): health taken by the strike: all of it (it was 40). */
    damage: 100,
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
    /**
     * MI4-A, MI10 (NBB-154): having lost the hidden player, it searches for `seconds` at `speed`
     * (stalking gait), through spots `pointDistance` away from where it lost them, then retreats.
     */
    search: {
      seconds: [20, 30] as [number, number],
      speed: 3,
      pointDistance: [4, 10] as [number, number],
    },
    /** RF-24: never closer than this to a lit campfire (NBB-146). */
    fireKeepAway: 8,
    /** RF-24, GF2-B: a lit torch looked at closer than this holds it off (it does not flee). */
    torchHoldDistance: 10,
    /**
     * GF2-B, GF8 (NBB-155): held off by the torch, it keeps about `distance` from the player,
     * circles sideways at `circleSpeed` and growls every `growlEvery` seconds.
     */
    torchHold: { distance: 7, circleSpeed: 1.5, growlEvery: [4, 7] as [number, number] },
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
        /** FX7-A, FX8-A, FX14 (NBB-162). */
        call: "call.mp3",
        scream: "scream.mp3",
        sniff: "sniff.mp3",
      },
      /**
       * FX4-A, FX15: its call from afar, 1 or 2 times a night, only while it roams 60–100 m away
       * (heard from where it really is), never in the first minute of the night.
       */
      callsPerNight: [1, 2] as const,
      callDistance: [60, 100] as const,
      callQuietSeconds: 60,
      callHearingDistance: 140,
      callVolume: 1,
      /** FX15: its scream when fire sends it back (and in the ritual), at most every 20 s. */
      screamHearingDistance: 60,
      screamVolume: 1,
      screamEverySeconds: 20,
      /** FX14: sniffing at the bush, lower and slower than a dog's. */
      sniffVolume: 0.8,
      sniffRate: 0.8,
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
      /** SO3: short low growl when the attack begins (and while the torch holds it off, GF2-B). */
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
      /** FX14: the trigger pulled with both barrels empty. */
      dryFire: "dry-fire.mp3",
      shotVolume: 1,
      reloadVolume: 0.8,
      dryFireVolume: 0.7,
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
  /** NBB-143: the inventory (RF-57, IN1-A) and picking things up by hand (RF-58, CL1). */
  inventory: {
    /** IN1-A: the quick bar (1–6) and the backpack. */
    hotbarSlots: 6,
    backpackSlots: 18,
    /** IN1-A: how many of each item fit in one slot. */
    stack: {
      knife: 1,
      axe: 1,
      /** TC1-A. */
      torch: 5,
      bow: 1,
      shotgun: 1,
      arrow: 20,
      cartridge: 10,
      branch: 20,
      /** MC2. */
      wood: 20,
      stone: 20,
      fiber: 20,
      fat: 20,
      leather: 20,
      rawMeat: 10,
      cookedMeat: 10,
      /** FG1-A: bulky, one per slot. */
      campfire: 1,
      bed: 1,
      /** NBB-156 (OB12): the radio, its parts and the deer skulls (3 for the ritual). */
      battery: 1,
      antenna: 1,
      tubes: 1,
      radio: 1,
      deerSkull: 3,
    },
    /** PG1-A (RF-56): the player starts with nothing (the provisional kit, IN5-A, is gone). */
    starterKit: [] as { item: ItemId; count: number; slot: number }[],
    /** CL1: E reaches a branch, a stone or a bush this close (meters). */
    pickupReach: 1.6,
    /** CL1: holding E on a bush this long gives this many fibers. */
    fiberSeconds: 1.5,
    fiberPerBush: 2,
    /** The item's name shows above the quick bar this long after switching. */
    nameSeconds: 1.6,
    /** Size of a slot on screen (pixels) and of its icon (IN7-A). */
    slotPx: 52,
    iconPx: 96,
  },
  /** NBB-144: crafting (RF-51, RF-59, CF1-A, CF2-B). Fire and bed come with NBB-146 (CF3-A). */
  crafting: {
    recipes: [
      {
        item: "axe",
        count: 1,
        seconds: 3,
        cost: [
          ["branch", 2],
          ["stone", 2],
          ["fiber", 1],
        ],
      },
      {
        item: "knife",
        count: 1,
        seconds: 2,
        cost: [
          ["branch", 1],
          ["stone", 1],
          ["fiber", 1],
        ],
      },
      {
        item: "torch",
        count: 1,
        seconds: 2,
        cost: [
          ["branch", 1],
          ["fiber", 1],
          ["fat", 1],
        ],
      },
      {
        item: "bow",
        count: 1,
        seconds: 3,
        cost: [
          ["branch", 3],
          ["fiber", 3],
        ],
      },
      {
        item: "arrow",
        count: 5,
        seconds: 2,
        cost: [
          ["branch", 3],
          ["stone", 1],
        ],
      },
      // CF3-A (NBB-146): the campfire and the bed.
      {
        item: "campfire",
        count: 1,
        seconds: 3,
        cost: [
          ["branch", 4],
          ["stone", 4],
        ],
      },
      {
        item: "bed",
        count: 1,
        seconds: 3,
        cost: [
          ["fiber", 4],
          ["leather", 2],
        ],
      },
      // OB12 (NBB-156): the radio, shown only once the three parts are there.
      {
        item: "radio",
        count: 1,
        seconds: 3,
        cost: [
          ["battery", 1],
          ["antenna", 1],
          ["tubes", 1],
        ],
      },
    ] as Recipe[],
  },
  /** NBB-144: the axe (RF-59, MC1-A, MC2, MC3-A). Meters and seconds. */
  axe: {
    reach: 2,
    swingSeconds: 0.8,
    /** The blow lands this long into the swing. */
    hitAt: 0.3,
    /** MC2: blows to fell or break, and what it gives. */
    hits: { pine: 6, oak: 6, deadTree: 4, birch: 5, rock: 5, boulder: 8 },
    wood: { pine: 4, oak: 4, deadTree: 2, birch: 3 },
    stones: 3,
    /** BM1 (NBB-163): a boulder of the ridge gives more stones. */
    boulderStones: 5,
    /** MC1-A: the tree tips over in this long, then disappears. */
    fallSeconds: 1.5,
    /** Height of the stump left behind (meters). */
    stumpHeight: 0.35,
  },
  /** NBB-145: building on the 2 m grid (RF-52 to RF-54, CN1-A to CN6). Meters and seconds. */
  building: {
    cell: 2,
    /** RF-52: what each piece costs in wood. */
    cost: { foundation: 4, wall: 3, door: 4, roof: 3 },
    /** CN3: pieces go where the player looks, this far at most. */
    reach: 6,
    /** RF-52: a foundation accepts this much difference in the ground under it. */
    maxSlope: 1,
    /** The floor stands this high above the highest ground under it. */
    floorLift: 0.12,
    wallHeight: 2.4,
    wallThickness: 0.26,
    doorWidth: 1,
    doorHeight: 2.05,
    /** CN6: the door swings open in this long. */
    doorSeconds: 0.5,
    /** CN2-A: hold the right button this long to take a piece apart. */
    dismantleSeconds: 1,
    /** CN5-A: blocked by walls this long while attacking, the creature gives up. */
    creatureGiveUpSeconds: 8,
  },
  /** NBB-142: cleaning a carcass (RF-35, CA1-B to CA4-A). */
  carcass: {
    /** CA1-B: hold E this long, standing still, with the knife in hand (CA2-A). */
    harvestSeconds: { rabbit: 2, deer: 5 },
    /** RF-30, CA4-A: what each animal gives. */
    meat: { rabbit: 1, deer: 4 },
    leather: { rabbit: 0, deer: 1 },
    /** OB8-A, OB12 (NBB-156): the deer's skull, for the ritual. */
    skull: { rabbit: 0, deer: 1 },
    /** PG2-A: fat, for torches. */
    fat: { rabbit: 1, deer: 3 },
    /** E reaches a carcass this close (meters, to the middle of its body). */
    reach: { rabbit: 1.5, deer: 2.2 },
  },
  /** NBB-142: the campfire (CZ1-A) and cooking on it (CZ2-A). */
  campfire: {
    /** FG1-A: the campfire and the bed go down this far ahead of the player (meters). */
    placeDistance: 1.8,
    /** RF-55 / PG4-A: it burns 5 min; a branch adds 2 min, up to 10. */
    burnSeconds: 300,
    branchSeconds: 120,
    maxSeconds: 600,
    /** FG3-A: the flames shrink over the last 30 s. */
    dyingSeconds: 30,
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
    /**
     * NBB-149 (CH1-B, CH3): each lit fire crackles in 3D, softer as the flames shrink; put out
     * or burnt out, the crackle fades in `fadeSeconds`.
     */
    sound: { file: "fire/campfire.mp3", volume: 0.6, hearingDistance: 25, fadeSeconds: 1 },
  },
  /**
   * NBB-149 (SM4-A, AM1–AM7): the forest's sound, from `public/sounds/ambience/` (CC0, see
   * CREDITS.md). Volumes go from 0 to 1, under the ambience group's volume.
   */
  ambience: {
    files: {
      wind: "wind.mp3",
      birds: "birds.mp3",
      crickets: "crickets.mp3",
      owls: ["owl.mp3"],
      crows: ["crow-1.mp3", "crow-2.mp3", "crow-3.mp3"],
      /** AM6: the distant crack is one of the footsteps' snaps, lower and quieter. */
      snaps: ["snap-1.mp3", "snap-2.mp3", "snap-3.mp3", "snap-4.mp3"],
      /** FX14: a tree creaking (night), a gust (day and night), a branch falling (night). */
      creaks: ["tree-creak.mp3"],
      gusts: ["wind-gust.mp3"],
      branchFalls: ["branch-fall.mp3"],
    },
    volume: {
      wind: 0.5,
      birds: 0.45,
      crickets: 0.5,
      owl: 0.9,
      crow: 0.8,
      snap: 0.7,
      creak: 0.8,
      gust: 0.7,
      branchFall: 0.9,
    },
    /** FX14: how often the lone sound is one of the new ones (a creak, a gust, a branch). */
    extraChance: { day: 0.2, night: 0.35 },
    snapRate: 0.8,
    /** AM6: a lone sound every 20–60 s, 30–60 m away, heard up to 80 m. */
    oneShotEvery: [20, 60],
    oneShotDistance: [30, 60],
    hearingDistance: 80,
    /** AM6: how often the lone sound is a branch cracking (more often at night). */
    snapChance: { day: 0.25, night: 0.4 },
  },
  /**
   * NBB-149 (FE1–FE7, CH2, CH3, AC1): the tools', weapons' and actions' sounds, from
   * `public/sounds/` (CC0, see CREDITS.md). Volumes from 0 to 1.
   */
  effectSounds: {
    files: {
      bowDraw: ["tools/bow-draw.mp3"],
      bowRelease: ["tools/bow-release.mp3"],
      knifeSwing: ["tools/knife-swing.mp3"],
      knifeHit: ["tools/knife-hit.mp3"],
      chop: ["tools/chop-1.mp3", "tools/chop-2.mp3", "tools/chop-3.mp3", "tools/chop-4.mp3"],
      stoneHit: ["tools/stone-hit.mp3"],
      treeFall: ["tools/tree-fall.mp3"],
      arrowHit: ["tools/arrow-hit.mp3"],
      /** PD7-C (NBB-158): a thrown stone landing. */
      stoneLand: ["tools/stone-land.mp3"],
      /** CH2-A: lighting the torch or a fire. */
      ignite: ["fire/ignite.mp3"],
      /** CH3, FX9-B: the torch in hand burns with its own loop. */
      torchCrackle: ["fire/torch.mp3"],
      /** FX14: picking something up (it was a leaves footstep, AC1). */
      pickup: ["actions/pickup.mp3"],
      /** FX14: putting out the torch (higher and softer) or a campfire (where it is). */
      torchOut: ["fire/fire-out.mp3"],
      fireOut: ["fire/fire-out.mp3"],
      /** FX14: the skulls burning in the ritual. */
      fireBurst: ["fire/fire-burst.mp3"],
      /** FX14: paper: a note read, the map opened or closed. */
      note: ["objective/note.mp3"],
      map: ["objective/map.mp3"],
      /** FX10, FX15: calling the rescue: static, then a voice answers. */
      radioStatic: ["objective/radio-static.mp3"],
      radioVoice: ["objective/radio-voice.mp3"],
      /** FX6-A, FX11-A: the rescue's helicopter coming. */
      helicopter: ["objective/helicopter.mp3"],
      /** FX5-B, FX13: hurt, with no voice: a dull thud and a caught breath. */
      hurtHit: ["player/hit.mp3"],
      hurtBreath: ["player/breath.mp3"],
      /** FX14: hungry. */
      stomach: ["player/stomach.mp3"],
      /** FX14: the inventory (the backpack) opening and closing; something made. */
      bagOpen: ["actions/bag-open.mp3"],
      bagClose: ["actions/bag-close.mp3"],
      craft: ["actions/craft.mp3"],
      /** FX14: a stone thrown is the knife's swing, lower. */
      throw: ["tools/knife-swing.mp3"],
      /** FX14: the arrow flying off the bow. */
      arrowFly: ["tools/arrow-fly.mp3"],
      eat: ["actions/eat.mp3"],
      carcass: ["actions/carcass.mp3"],
      place: ["actions/place.mp3"],
      dismantle: ["actions/dismantle.mp3"],
      door: ["actions/door.mp3"],
      chest: ["actions/chest.mp3"],
    },
    volume: {
      bowDraw: 0.5,
      bowRelease: 0.8,
      knifeSwing: 0.5,
      knifeHit: 0.8,
      chop: 0.9,
      stoneHit: 0.8,
      treeFall: 1,
      arrowHit: 0.8,
      stoneLand: 0.8,
      ignite: 0.7,
      torchCrackle: 0.35,
      pickup: 0.5,
      eat: 0.6,
      carcass: 0.6,
      place: 0.7,
      dismantle: 0.7,
      door: 0.6,
      chest: 0.7,
      torchOut: 0.5,
      fireOut: 0.8,
      fireBurst: 0.8,
      note: 0.6,
      map: 0.6,
      radioStatic: 0.6,
      radioVoice: 0.7,
      helicopter: 1,
      /** FX15: hurt, 0.8. */
      hurtHit: 0.8,
      hurtBreath: 0.8,
      stomach: 0.5,
      bagOpen: 0.5,
      bagClose: 0.5,
      craft: 0.7,
      throw: 0.5,
      arrowFly: 0.6,
    },
    /** Pitch of some effects (1 = as recorded). */
    rates: { torchOut: 1.2, throw: 0.75 },
    /** Heard from where they happen (3D); the others come from the player's hands. */
    spatial: ["knifeHit", "treeFall", "arrowHit", "stoneLand", "fireOut"],
    /** These loop until stopped (while cleaning a carcass, while the torch burns). */
    loops: ["carcass", "torchCrackle"],
    hearingDistance: 50,
    /** Each play's pitch varies by up to ±5%. */
    pitchJitter: 0.05,
  },
  /**
   * NBB-149 (SM5-A, MU2) and NBB-161 (MF1-A to MF16): the music, CC0 and CC-BY tracks that come
   * with the game (`public/sounds/music/`, credited in CREDITS.md).
   */
  music: {
    /** MF9: the day tracks, in random order without repeating. */
    dayTracks: ["music/day-1.mp3", "music/day-2.mp3", "music/day-3.mp3", "music/day-4.mp3"],
    /** The first track 1–3 min after the game opens; then 5–10 min of silence between them. */
    firstDelay: [60, 180] as const,
    gap: [300, 600] as const,
    /** MF16: the tracks' own volume, under the music group. */
    volume: 0.45,
    fadeInSeconds: 3,
    fadeOutSeconds: 5,
    /** Only by day: below this daylight none starts, and the one playing fades out. */
    minDaylight: 0.5,
    duskFadeSeconds: 10,
    /** MF4-A, MF8-A: the main menu's theme, in a loop; it starts over each time. */
    menuFile: "music/menu.mp3",
    menuFadeInSeconds: 2,
    menuFadeOutSeconds: 1.5,
    /** MF10-B, MF11-A: the short pieces at dawn and dusk, a little louder (they are short). */
    dawnFile: "music/dawn.mp3",
    duskFile: "music/dusk.mp3",
    cueVolume: 0.6,
    /** MF12-A: the victory's track, once. */
    victoryFile: "music/victory.mp3",
    victoryFadeInSeconds: 2,
    victoryFadeOutSeconds: 1.5,
  },
  /**
   * NBB-162 (FX3-A, FX12-A, FX15): the menus' wooden click: higher and soft passing over, lower
   * and fuller confirming, lower and softer going back.
   */
  uiSounds: {
    file: "ui/click.mp3",
    /** Clicks that can overlap. */
    voices: 4,
    hover: { volume: 0.25, rate: 1.25 },
    confirm: { volume: 0.5, rate: 0.8 },
    back: { volume: 0.35, rate: 0.7 },
  },
  /** NBB-163 (BM6-A, BM8): the biome's name, entering it, at the top of the screen. */
  biomeBanner: {
    size: 26,
    /** From the top of the screen (share of its height). */
    top: 0.12,
    /** Only after this long in the new biome (no flicker at a border). */
    afterSeconds: 5,
    fadeInSeconds: 0.6,
    holdSeconds: 2.5,
    fadeOutSeconds: 1,
  },
  /** NBB-161 (MF13-B, MF14-B, MF16): the message at dawn and dusk, at the top of the screen. */
  dayMessage: {
    titleSize: 56,
    lineSize: 20,
    /** From the top of the screen (share of its height). */
    top: 0.18,
    fadeInSeconds: 1,
    holdSeconds: 3,
    fadeOutSeconds: 1.5,
    /** A jump of the clock larger than this (seconds) is a sleep or a death, not a night lived. */
    skipSeconds: 5,
  },
  /**
   * NBB-153 (PS3, PS4-A, PS6-A, PS7-C): the chase as the player feels it. The heartbeat beats faster
   * as the creature closes in; the screen edges darken with each beat; the view shakes at its
   * close footsteps; the player pants when out of breath.
   */
  chase: {
    heartbeatFile: "player/heartbeat.mp3",
    pantingFile: "player/panting.mp3",
    /** The heartbeat: seconds between beats, from the creature far (30 m) to close (2 m). */
    beatInterval: [0.85, 0.38] as const,
    /** VL3-A: louder than the rest (it was 0.45 to 1). */
    beatVolume: [0.9, 1.8] as const,
    farDistance: 30,
    /** After the chase ends, the heartbeat calms down over this long. */
    calmSeconds: 3,
    /** Dark screen edges: strength from far to close, and how fast each beat's pulse fades. */
    edgeAlpha: [0.25, 0.75] as const,
    pulseSeconds: 0.3,
    /** The view shakes at each of its steps closer than this (meters). */
    shakeDistance: 10,
    shakeSeconds: 0.15,
    shakeRadians: 0.012,
    /** Panting starts below this much stamina, louder as it runs out. */
    pantBelowStamina: 40,
    /** VL3-A: it was 0.6. */
    pantVolume: 1,
    /**
     * MT1-C, MT2, MT3-D: the chase music ("Orchestral Suspense Loop 1", CC0), unless the private
     * folder has one. It plays in the music group (its slider in the options counts).
     */
    musicFile: "music/chase.mp3",
    musicVolume: 1,
    musicFadeInSeconds: 0.5,
    musicFadeOutSeconds: 3,
    /** FX5-B, FX15: at death, two last beats, slower and slower (seconds after it), then none. */
    lastBeats: [0.6, 1.5],
    lastBeatVolume: 0.9,
  },
  /**
   * GF4-C, GF7-A, GF8 (NBB-155): "pego". The view turns to the creature's face in `turnSeconds`,
   * the growl and the strike ("monster bite", CC0) play, the screen goes black at once and "Você
   * morreu" shows after `blackSeconds`.
   */
  caught: {
    turnSeconds: 0.15,
    blackSeconds: 1.5,
    strikeFile: "creature/strike.mp3",
    strikeVolume: 1,
    growlFile: "creature/growl.mp3",
    growlVolume: 1,
  },
  /** NBB-149 (AN1-B to AN3): the prey's 3D sounds (CC0, see CREDITS.md). Volumes from 0 to 1. */
  preySounds: {
    files: {
      alarm: ["animals/deer-alarm-1.mp3", "animals/deer-alarm-2.mp3", "animals/deer-alarm-3.mp3"],
      cry: ["animals/deer-cry-1.mp3", "animals/deer-cry-2.mp3"],
      /** AN2-A: running is made of the footsteps' leaves and twigs. */
      deerRun: [1, 2, 3, 4, 5, 6].flatMap((n) => [
        `player/step-leaves-${n}.mp3`,
        `player/step-twigs-${n}.mp3`,
      ]),
      rabbitRun: [1, 2, 3, 4, 5, 6].map((n) => `player/step-leaves-${n}.mp3`),
      /** FX14: a startled rabbit thumps the ground as it bolts. */
      rabbitThump: ["animals/rabbit-thump.mp3"],
    },
    /** FX14: a rabbit dying cries with the deer's cry, higher and softer. */
    volume: { alarm: 1, cry: 0.8, deer: 0.7, rabbit: 0.35, rabbitThump: 0.8, rabbitCry: 0.4 },
    /** Running pitch: the deer heavier, the rabbit lighter. */
    rate: { deer: 0.8, rabbit: 1.4, rabbitCry: 1.6 },
    /** Seconds between beats, repeating: a gallop (three quick beats and a pause) and hops. */
    rhythm: { deer: [0.09, 0.09, 0.26], rabbit: [0.07, 0.22] },
    /** A deer group barks once; another bark only after this long (seconds). */
    alarmEvery: 4,
    hearingDistance: { alarm: 70, cry: 40, deerRun: 40, rabbitRun: 18, rabbitThump: 25 },
  },
  /** NBB-148: the backpack left where the player died (RF-60, MO1-A to MO3-A). */
  backpack: {
    /** E reaches it this close (meters). */
    reach: 2,
  },
  /** NBB-147: the save (RF-61, SV3). */
  save: {
    /** It saves on its own this often (seconds). */
    everySeconds: 60,
  },
  /** NBB-146: the bed (RF-60, RF-62, CM1-A, CM2, DO1). */
  bed: {
    /** E reaches it this close (meters). */
    reach: 2,
    /** RF-62: no sleeping with the creature closer than this (meters). */
    safeDistance: 30,
    /** DO1: the screen fades out and back in, this long each way (seconds). */
    fadeSeconds: 1.5,
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
    /**
     * NBB-164 (AG6-B): they keep out of water deeper than `maxDepth`. Grazing within
     * `drinkDistance` of water, now and then (`drinkChance` at each turn) they walk to the shore
     * and drink there for `drinkSeconds` (grazing).
     */
    water: {
      maxDepth: 0.4,
      drinkDistance: 15,
      drinkChance: 0.3,
      drinkSeconds: [4, 8],
      walkSpeed: 1.2,
    },
  },
  /** SO4: sound. The player's volume control comes with the options menu (NBB-150). */
  audio: {
    /** VL1-A (NBB-155): everything a little lower (it was 0.8). */
    masterVolume: 0.6,
    /**
     * SM7: each group's volume, under the master volume. VL2-A: music at 0.8 (it was 0.3) so the
     * chase music is heard; the day music has its own volume (`music.volume`).
     */
    groups: { effects: 1, ambience: 0.7, music: 0.8 },
  },
  /** HUD (NO1-A: Babylon GUI). */
  /** NBB-150 (MN6): the menus, on the left over the forest. */
  menu: {
    textColor: "rgba(236, 230, 218, 0.85)",
    /** EM3-A: the only accent, the fire's orange, on the chosen option. */
    hoverColor: "#ff9a3c",
    /** EM2-A: the options not chosen. */
    dimColor: "rgba(236, 230, 218, 0.5)",
    shade: "rgba(0, 0, 0, 0.45)",
    titleSize: 84,
    headingSize: 44,
    /** The new world's question. */
    questionSize: 30,
    optionSize: 26,
    textSize: 20,
    /** Distance from the left edge (pixels). */
    left: 96,
    /** MN4: the mouse sensitivity can go from 0.25× to 2×. */
    sensitivityRange: [0.25, 2] as const,
    /** EM1-A: the titles' cold glow. */
    titleGlow: { color: "rgba(150, 180, 220, 0.55)", blur: 28 },
    /** EM1-A: the main title fails like a lamp now and then (seconds between, its dimmest). */
    flicker: { everySeconds: [6, 12] as const, low: 0.65, blinkSeconds: 0.1, gapSeconds: 0.08 },
    /** EM10: a shadow under every other text, to read over the film. */
    shadow: { color: "black", blur: 8, offsetY: 2 },
    /** EM2-A: the chosen option's dash (pixels) and the room left for it. */
    dash: { width: 20, height: 2 },
    optionIndent: 30,
    /** The chosen option's text slides right this far, this fast. */
    slidePixels: 10,
    slideSeconds: 0.12,
    /** EM7-A: each screen comes out of black; each line starts a little after the one above. */
    revealSeconds: 0.4,
    revealStagger: 0.06,
    /** EM6-A: one press of ←/→ moves a slider this much (volumes and sensitivity). */
    sliderStep: 0.05,
    sliderLabelSize: 18,
    sliderTrack: "rgba(236, 230, 218, 0.25)",
    /** EM5-A: changed at each milestone. */
    version: "v1.2.0",
    versionSize: 14,
    versionColor: "rgba(236, 230, 218, 0.35)",
    versionMargin: 24,
    /** EM8-A: the victory screens. */
    victoryTitleSize: 56,
    victoryLineColor: "rgba(236, 230, 218, 0.6)",
  },
  hud: {
    /** MN1-C: the game's font (public/fonts, OFL), for the HUD, the menus and the credits. */
    fontFamily: "Crimson Pro",
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
    /** NBB-164 (AG14): the air bar, just above the health bar, shown only underwater. */
    airBarColor: "#8fc3d6",
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
    /** IN6-B: plant fiber, animal fat, tanned leather and the cartridge's shell and brass. */
    fiber: { r: 0.6, g: 0.58, b: 0.4 },
    fat: { r: 0.92, g: 0.86, b: 0.72 },
    /** NBB-144: freshly cut wood (the axe handle, split wood, the top of a stump). */
    cutWood: { r: 0.72, g: 0.6, b: 0.42 },
    axeStone: { r: 0.36, g: 0.36, b: 0.35 },
    leather: { r: 0.44, g: 0.3, b: 0.18 },
    /** MO4-A, MO7: the backpack's light canvas, easy to spot on the dark ground. */
    canvas: { r: 0.74, g: 0.68, b: 0.52 },
    cartridgeShell: { r: 0.55, g: 0.12, b: 0.1 },
    brass: { r: 0.72, g: 0.58, b: 0.3 },
    /** NBB-156 (OB12): the radio's olive case, the battery's black casing, the tubes' glass. */
    radioCase: { r: 0.29, g: 0.31, b: 0.22 },
    batteryCase: { r: 0.12, g: 0.12, b: 0.12 },
    batteryLabel: { r: 0.62, g: 0.18, b: 0.12 },
    tubeGlass: { r: 0.62, g: 0.66, b: 0.62 },
    /** Forest floor texture colors (the ground has no vertex colors). */
    groundDirt: { r: 0.2, g: 0.16, b: 0.12 },
    groundLitter: { r: 0.33, g: 0.25, b: 0.15 },
    groundMoss: { r: 0.18, g: 0.24, b: 0.13 },
    /** BM4-A (NBB-163): the birch's white bark and its dark marks, its light yellow-green leaves. */
    birchBark: { r: 0.8, g: 0.78, b: 0.72 },
    birchMarks: { r: 0.13, g: 0.12, b: 0.11 },
    birchLeaves: { r: 0.42, g: 0.45, b: 0.2 },
    /** BM4-A: the marsh's reeds, the field's dry tall grass, the mud of the puddles. */
    reeds: { r: 0.33, g: 0.36, b: 0.2 },
    tallGrass: { r: 0.52, g: 0.49, b: 0.29 },
    mud: { r: 0.2, g: 0.16, b: 0.12 },
    /** BM4-A: the ridge's cliffs and boulders: colder, darker stone, lichen on top. */
    cliffRock: { r: 0.34, g: 0.34, b: 0.34 },
    cliffStreak: { r: 0.22, g: 0.22, b: 0.23 },
    lichen: { r: 0.4, g: 0.42, b: 0.3 },
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
    /** NBB-164: the water's ripples. */
    waterRelief: 2,
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
    /** MI2-A (NBB-154): tall enough to hide a crouching player's eyes (1.0 m); it was 0.6–1.2. */
    bush: { height: [1.1, 1.6], leafCards: [35, 55] },
    rock: { size: [0.3, 1.5] },
    /** Knobbly stick with 0–2 short forks. */
    groundBranch: { length: [0.5, 1], forks: [0, 2] },
    /** 2–3 crossed grass cards. */
    groundTuft: { height: [0.2, 0.5], cards: [2, 3] },
    /** BM4-A (NBB-163): slender white trunk that keeps going up (a leader), a light crown. */
    birch: { height: [9, 15], depth: 3, leafCardsPerTwig: [6, 10] },
    /** Marsh reeds: tall crossed cards, taller than a crouching player's eyes (1.0 m). */
    reeds: { height: [1.2, 1.8], cards: [4, 6] },
    /** The field's tall grass: up to a crouching player's eyes. */
    tallGrass: { height: [0.9, 1.3], cards: [5, 7] },
    /** The ridge's rock walls (up to 600 triangles) and boulders (up to 300). */
    cliff: { width: [7, 11], height: [4, 8], depth: [2.5, 4] },
    boulder: { size: [2.2, 3.6] },
    /** A shallow puddle of mud, flat on the ground. */
    puddle: { radius: [0.8, 2] },
    /**
     * NBB-165 (CC3-A): the waterfall. The curtain starts `lipBack` m above the lip, flat, and
     * curves out `throwBase + throwPerMeter × height` m as it falls; its streaks run down at
     * `streakSpeed` (texture repeats per second). Foam at the foot and mist rising from it, so many
     * particles per meter of width.
     */
    waterfall: {
      lipBack: 2,
      throwBase: 0.4,
      throwPerMeter: 0.08,
      spread: 0.15,
      streakSpeed: 0.9,
      tint: { r: 0.78, g: 0.84, b: 0.86 },
      alpha: 0.75,
      foamPerMeter: 14,
      /** CC9-B: more mist, and less clear, so it shows. */
      mistPerMeter: 3,
      mistAlpha: 0.3,
    },
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
