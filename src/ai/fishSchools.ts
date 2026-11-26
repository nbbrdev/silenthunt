import {
  Color3,
  CreateSoundAsync,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type Mesh,
  type StaticSound,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";
import { frameSeconds } from "../core/gameTime";
import { createRandom, randomInt } from "../core/random";
import { createFish, type FishRig } from "../models/animals/smallAnimals";
import type { ChunkInfo } from "../world/chunks";
import { chunkRandom, flatDistance, turnToward, type WildlifeSenses } from "./wildlifeCommon";

interface Fish {
  rig: FishRig;
  heading: number;
  target: { x: number; z: number };
  tailPhase: number;
  /** AV10-A+B: leaping out of the water (seconds into the leap, from where to where). */
  leap: { time: number; fromX: number; fromZ: number; toX: number; toZ: number } | undefined;
}

/** A ring spreading on the water's surface. */
interface Ring {
  mesh: Mesh;
  material: StandardMaterial;
  /** Seconds since it started (it is free when past the ring's time). */
  age: number;
}

interface School {
  /** The middle the fish wander around (it moves when they flee). */
  x: number;
  z: number;
  fish: Fish[];
  /** Seconds of fleeing left (0: calm). */
  fleeing: number;
  shown: boolean;
}

/**
 * NBB-166 (AV4-A): small schools of fish in the deep rivers and lakes. They wander slowly around
 * their spot; when the player comes within 4 m, or goes into the water near them, they dart away.
 * Only to look at: there is no fishing. AV10-A+B: grey-olive, seen through the clearer shallows
 * and underwater; from the shore, a fish leaps now and then with a splash, and leaping and
 * fleeing leave rings on the surface.
 */
export class FishSchools {
  private readonly senses: WildlifeSenses;
  private readonly seed: number;
  private readonly random: () => number;
  private readonly schools = new Map<string, School[]>();
  private readonly rings: Ring[] = [];
  private splash: { sound: StaticSound; emitter: TransformNode } | undefined;
  /** Development: how many times a school has fled, and how many fish have leapt. */
  private flights = 0;
  private leaps = 0;

  constructor(senses: WildlifeSenses, seed: number) {
    this.senses = senses;
    this.seed = seed;
    this.random = createRandom(seed + 266);
    senses.scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(senses.scene)));
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.wildlife.fish;
    const emitter = new TransformNode("fishSplash", this.senses.scene);
    const sound = await CreateSoundAsync(
      "fishSplash",
      soundUrl(CONFIG.wildlife.frogs.plop),
      {
        maxInstances: 2,
        volume: settings.splashVolume,
        outBus: audio.effects,
        spatialEnabled: true,
        spatialDistanceModel: "linear",
        spatialMinDistance: 1,
        spatialMaxDistance: settings.splashHearing,
      },
      audio.engine,
    );
    sound.spatial.attach(emitter);
    this.splash = { sound, emitter };
  }

  load(chunk: ChunkInfo): void {
    const settings = CONFIG.wildlife.fish;
    const { terrain, scene } = this.senses;
    const random = chunkRandom(chunk, 32, this.seed);
    const { chunkSize } = CONFIG.world;
    const cells = Math.max(1, Math.round(chunkSize / settings.spacing));
    const cell = chunkSize / cells;
    const schools: School[] = [];
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        // A few tries in each cell (a river is narrow), the first deep enough.
        const count = randomInt(random, settings.perSchool);
        let x = 0;
        let z = 0;
        let found = false;
        for (let i = 0; i < settings.tries && !found; i++) {
          x = chunk.cx * chunkSize + (col + random()) * cell;
          z = chunk.cz * chunkSize + (row + random()) * cell;
          found = terrain.waterAt(x, z).depth >= settings.minDepth;
        }
        if (!found) {
          continue;
        }
        const fish: Fish[] = [];
        for (let i = 0; i < count; i++) {
          const rig = createFish(scene, `fish-${chunk.key}-${schools.length}-${i}`);
          for (const mesh of rig.root.getChildMeshes()) {
            this.senses.showUnderWater(mesh);
          }
          const angle = random() * Math.PI * 2;
          const fx = x + Math.sin(angle) * random() * settings.roam;
          const fz = z + Math.cos(angle) * random() * settings.roam;
          const heading = random() * Math.PI * 2;
          rig.root.position.set(fx, this.swimHeight(fx, fz), fz);
          rig.root.rotation.y = heading;
          fish.push({
            rig,
            heading,
            target: { x: fx, z: fz },
            tailPhase: random() * 6,
            leap: undefined,
          });
        }
        const school: School = { x, z, fish, fleeing: 0, shown: true };
        this.show(school, false);
        schools.push(school);
      }
    }
    if (schools.length > 0) {
      this.schools.set(chunk.key, schools);
    }
  }

  unload(key: string): void {
    for (const school of this.schools.get(key) ?? []) {
      for (const fish of school.fish) {
        fish.rig.root.dispose();
      }
    }
    this.schools.delete(key);
  }

  /** Development: the schools around and the nearest one to (x, z). */
  debugState(x: number, z: number): object {
    const nearest = this.nearest(x, z);
    return {
      schools: [...this.schools.values()].flat().length,
      flights: this.flights,
      leaps: this.leaps,
      nearest: nearest && {
        x: Math.round(nearest.x),
        z: Math.round(nearest.z),
        fish: nearest.fish.length,
        fleeing: nearest.fleeing > 0,
        shown: nearest.shown,
        distance: Math.round(flatDistance(nearest, { x, z })),
      },
    };
  }

  /** Development: a fish of the nearest school to (x, z) leaps now. */
  debugLeap(x: number, z: number): boolean {
    const fish = this.nearest(x, z)?.fish.find((candidate) => !candidate.leap);
    if (fish) {
      this.startLeap(fish);
    }
    return Boolean(fish?.leap);
  }

  /** Development: the nearest school to (x, z). */
  nearest(x: number, z: number): School | undefined {
    let best: School | undefined;
    for (const school of [...this.schools.values()].flat()) {
      if (!best || flatDistance(school, { x, z }) < flatDistance(best, { x, z })) {
        best = school;
      }
    }
    return best;
  }

  /** Just under the surface, but never into the bed. */
  private swimHeight(x: number, z: number): number {
    const { terrain } = this.senses;
    const water = terrain.waterAt(x, z);
    const bed = terrain.heightAt(x, z) + 0.1;
    return Math.max(bed, water.level - CONFIG.wildlife.fish.swimDepth);
  }

  private deepEnough(x: number, z: number): boolean {
    return this.senses.terrain.waterAt(x, z).depth >= CONFIG.wildlife.fish.roamDepth;
  }

  private show(school: School, shown: boolean): void {
    if (school.shown === shown) {
      return;
    }
    school.shown = shown;
    for (const fish of school.fish) {
      fish.rig.root.setEnabled(shown);
    }
  }

  private update(seconds: number): void {
    if (seconds <= 0) {
      return;
    }
    const settings = CONFIG.wildlife.fish;
    const { player } = this.senses;
    const feet = player.feet;
    const inWater = player.waterState !== "dry";
    this.updateRings(seconds);
    for (const school of [...this.schools.values()].flat()) {
      const distance = flatDistance(school, feet);
      this.show(school, distance < CONFIG.wildlife.activeDistance);
      if (!school.shown) {
        continue;
      }
      // AV4-A: the player close, or in the water near them: they dart away.
      const near = school.fish.some(
        (fish) => flatDistance(fish.rig.root.position, feet) < settings.playerDistance,
      );
      if (school.fleeing <= 0 && (near || (inWater && distance < settings.wadingDistance))) {
        this.flee(school, feet);
      }
      school.fleeing = Math.max(0, school.fleeing - seconds);
      // AV10-A+B: now and then, one of a calm school leaps.
      if (
        school.fleeing <= 0 &&
        distance < settings.jumpDistance &&
        this.random() < settings.jumpChance * seconds
      ) {
        const leaper = school.fish[Math.floor(this.random() * school.fish.length)];
        if (leaper && !leaper.leap) {
          this.startLeap(leaper);
        }
      }
      for (const fish of school.fish) {
        if (fish.leap) {
          this.updateLeap(fish, seconds);
        } else {
          this.swim(school, fish, seconds);
        }
      }
      if (school.fleeing <= 0 && school.fish.length > 0 && this.random() < seconds * 0.2) {
        // Calm again: their spot is where they are now.
        school.x =
          school.fish.reduce((sum, fish) => sum + fish.rig.root.position.x, 0) / school.fish.length;
        school.z =
          school.fish.reduce((sum, fish) => sum + fish.rig.root.position.z, 0) / school.fish.length;
      }
    }
  }

  /** Each fish darts to a deep spot away from `threat`. */
  private flee(school: School, threat: { x: number; z: number }): void {
    const settings = CONFIG.wildlife.fish;
    this.flights++;
    school.fleeing = settings.fleeSeconds;
    // AV10-A+B: the water stirs where they were.
    for (const fish of school.fish.slice(0, settings.fleeRings)) {
      this.ring(fish.rig.root.position.x, fish.rig.root.position.z);
    }
    for (const fish of school.fish) {
      const here = fish.rig.root.position;
      const away = Math.atan2(here.x - threat.x, here.z - threat.z);
      for (let i = 0; i < 6; i++) {
        const angle = away + (this.random() - 0.5) * (1 + i * 0.5);
        const x = here.x + Math.sin(angle) * settings.fleeDistance;
        const z = here.z + Math.cos(angle) * settings.fleeDistance;
        if (this.deepEnough(x, z)) {
          fish.target = { x, z };
          break;
        }
      }
    }
  }

  /** AV10-A+B: out of the water ahead, in an arc, with a splash and a ring at each end. */
  private startLeap(fish: Fish): void {
    const settings = CONFIG.wildlife.fish;
    const here = fish.rig.root.position;
    const toX = here.x + Math.sin(fish.heading) * settings.jumpLength;
    const toZ = here.z + Math.cos(fish.heading) * settings.jumpLength;
    if (!this.deepEnough(toX, toZ)) {
      return;
    }
    fish.leap = { time: 0, fromX: here.x, fromZ: here.z, toX, toZ };
    this.leaps++;
    this.ring(here.x, here.z);
    this.splashAt(here.x, here.z);
  }

  private updateLeap(fish: Fish, seconds: number): void {
    const leap = fish.leap;
    if (!leap) {
      return;
    }
    const settings = CONFIG.wildlife.fish;
    const { root, tail } = fish.rig;
    leap.time += seconds;
    const t = Math.min(1, leap.time / settings.jumpSeconds);
    const x = leap.fromX + (leap.toX - leap.fromX) * t;
    const z = leap.fromZ + (leap.toZ - leap.fromZ) * t;
    const level = this.senses.terrain.waterAt(x, z).level;
    const under = this.swimHeight(x, z);
    // From its swimming depth up over the surface and back down.
    const top = (Number.isFinite(level) ? level : under) + settings.jumpHeight;
    root.position.set(x, under + (top - under) * Math.sin(t * Math.PI), z);
    // Nose up as it rises, down as it falls.
    root.rotation.x = -Math.cos(t * Math.PI) * 0.9;
    fish.tailPhase += settings.fleeTailRate * seconds;
    tail.rotation.y = Math.sin(fish.tailPhase) * 0.5;
    if (t >= 1) {
      fish.leap = undefined;
      root.rotation.x = 0;
      this.ring(x, z);
      this.splashAt(x, z);
    }
  }

  private splashAt(x: number, z: number): void {
    const splash = this.splash;
    if (!splash) {
      return;
    }
    const level = this.senses.terrain.waterAt(x, z).level;
    splash.emitter.position.set(x, Number.isFinite(level) ? level : 0, z);
    splash.sound.play();
  }

  /** A ring spreading from (x, z) on the water's surface (a free one from the pool). */
  private ring(x: number, z: number): void {
    const settings = CONFIG.wildlife.fish.ring;
    const level = this.senses.terrain.waterAt(x, z).level;
    if (!Number.isFinite(level)) {
      return;
    }
    let ring = this.rings.find((candidate) => candidate.age >= settings.seconds);
    if (!ring) {
      if (this.rings.length >= settings.pool) {
        return;
      }
      const { scene } = this.senses;
      const mesh = MeshBuilder.CreateTorus(
        "fishRing",
        { diameter: 1, thickness: settings.thickness, tessellation: 24 },
        scene,
      );
      mesh.isPickable = false;
      const material = new StandardMaterial("fishRing", scene);
      material.diffuseColor = new Color3(0.8, 0.85, 0.87);
      material.specularColor = Color3.Black();
      mesh.material = material;
      ring = { mesh, material, age: 0 };
      this.rings.push(ring);
    }
    ring.age = 0;
    ring.mesh.position.set(x, level + 0.02, z);
    ring.mesh.setEnabled(true);
  }

  private updateRings(seconds: number): void {
    const settings = CONFIG.wildlife.fish.ring;
    for (const ring of this.rings) {
      if (ring.age >= settings.seconds) {
        continue;
      }
      ring.age += seconds;
      const t = Math.min(1, ring.age / settings.seconds);
      const size = settings.startSize + (settings.endSize - settings.startSize) * Math.sqrt(t);
      ring.mesh.scaling.set(size, 0.3, size);
      ring.material.alpha = settings.alpha * (1 - t);
      if (t >= 1) {
        ring.mesh.setEnabled(false);
      }
    }
  }

  /** Toward its target, turning smoothly, the tail waving; a new target when it gets there. */
  private swim(school: School, fish: Fish, seconds: number): void {
    const settings = CONFIG.wildlife.fish;
    const { root, tail } = fish.rig;
    const fleeing = school.fleeing > 0;
    const toTarget = flatDistance(root.position, fish.target);
    if (toTarget < 0.3 && !fleeing) {
      for (let i = 0; i < 4; i++) {
        const angle = this.random() * Math.PI * 2;
        const x = school.x + Math.sin(angle) * this.random() * settings.roam;
        const z = school.z + Math.cos(angle) * this.random() * settings.roam;
        if (this.deepEnough(x, z)) {
          fish.target = { x, z };
          break;
        }
      }
    }
    const speed = fleeing ? settings.fleeSpeed : settings.speed;
    if (toTarget > 0.05) {
      const wanted = Math.atan2(fish.target.x - root.position.x, fish.target.z - root.position.z);
      fish.heading = turnToward(fish.heading, wanted, (fleeing ? 8 : 2) * seconds);
      const step = Math.min(toTarget, speed * seconds);
      const x = root.position.x + Math.sin(fish.heading) * step;
      const z = root.position.z + Math.cos(fish.heading) * step;
      if (this.deepEnough(x, z)) {
        root.position.set(x, this.swimHeight(x, z), z);
      } else {
        // The bank ahead: give up on this target.
        fish.target = { x: school.x, z: school.z };
      }
      root.rotation.y = fish.heading;
    }
    fish.tailPhase += (fleeing ? settings.fleeTailRate : settings.tailRate) * seconds;
    tail.rotation.y = Math.sin(fish.tailPhase) * 0.5;
  }
}
