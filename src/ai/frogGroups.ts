import {
  CreateSoundAsync,
  CreateSoundBufferAsync,
  TransformNode,
  type StaticSound,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";
import { frameSeconds } from "../core/gameTime";
import { createRandom, randomInRange, randomInt } from "../core/random";
import { createFrog, kick, type FrogRig } from "../models/animals/smallAnimals";
import type { ChunkInfo } from "../world/chunks";
import { chunkRandom, flatDistance, type WildlifeSenses } from "./wildlifeCommon";

interface Frog {
  rig: FrogRig;
  /** Where it sits on the shore, facing the water. */
  home: { x: number; z: number; heading: number };
  /** Where it lands in the water when it jumps. */
  water: { x: number; z: number };
  state: "sit" | "jump" | "hidden";
  /** Jumping: seconds since the group was startled; this frog leaves after `delay`. */
  delay: number;
  nextTurn: number;
}

interface Group {
  x: number;
  z: number;
  frogs: Frog[];
  /** Game seconds until the chorus may start again (AV5-A: it stops when someone comes near). */
  quietUntil: number;
  /** Game seconds until the frogs come back out of the water. */
  hiddenUntil: number;
  /** Seconds since the frogs were startled (they jump one after another). */
  jumpTime: number;
  shown: boolean;
}

/** One of the few chorus loops, given to a singing group near the player. */
interface Chorus {
  sound: StaticSound;
  emitter: TransformNode;
  group: Group | undefined;
}

/**
 * NBB-166 (AV5-A): groups of 3 to 6 frogs on the marsh's shores, singing in chorus day and night.
 * The chorus stops at once when the player or the creature comes within ~15 m (a warning), and
 * starts again a while after they leave. When the player comes close, the frogs jump into the
 * water with a plop and stay under until the player has gone. Not hunted.
 */
export class FrogGroups {
  private readonly senses: WildlifeSenses;
  private readonly seed: number;
  private readonly random: () => number;
  private readonly groups = new Map<string, Group[]>();
  private choruses: Chorus[] = [];
  private plop: { sound: StaticSound; emitter: TransformNode } | undefined;
  /** Game seconds lived (for the quiet and hidden times). */
  private time = 0;
  /** Development: how many times a chorus went quiet, and how many frogs jumped. */
  private silenced = 0;
  private jumps = 0;

  constructor(senses: WildlifeSenses, seed: number) {
    this.senses = senses;
    this.seed = seed;
    this.random = createRandom(seed + 366);
    senses.scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(senses.scene)));
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.wildlife.frogs;
    const { scene } = this.senses;
    const buffer = await CreateSoundBufferAsync(soundUrl(settings.chorus), {}, audio.engine);
    const choruses: Chorus[] = [];
    for (let i = 0; i < settings.chorusCount; i++) {
      const emitter = new TransformNode(`frogChorus${i}`, scene);
      const sound = await CreateSoundAsync(
        `frogChorus${i}`,
        buffer,
        {
          loop: true,
          volume: settings.chorusVolume,
          outBus: audio.ambience,
          spatialEnabled: true,
          spatialDistanceModel: "linear",
          spatialMinDistance: 3,
          spatialMaxDistance: settings.chorusHearing,
        },
        audio.engine,
      );
      sound.spatial.attach(emitter);
      choruses.push({ sound, emitter, group: undefined });
    }
    const emitter = new TransformNode("frogPlop", scene);
    const sound = await CreateSoundAsync(
      "frogPlop",
      soundUrl(settings.plop),
      {
        maxInstances: 4,
        volume: settings.plopVolume,
        outBus: audio.effects,
        spatialEnabled: true,
        spatialDistanceModel: "linear",
        spatialMinDistance: 1,
        spatialMaxDistance: settings.plopHearing,
      },
      audio.engine,
    );
    sound.spatial.attach(emitter);
    this.choruses = choruses;
    this.plop = { sound, emitter };
  }

  load(chunk: ChunkInfo): void {
    const settings = CONFIG.wildlife.frogs;
    const { terrain } = this.senses;
    const { chunkSize } = CONFIG.world;
    const random = chunkRandom(chunk, 33, this.seed);
    const middleX = (chunk.cx + 0.5) * chunkSize;
    const middleZ = (chunk.cz + 0.5) * chunkSize;
    if (terrain.biomeAt(middleX, middleZ) !== "marsh") {
      return;
    }
    const groups: Group[] = [];
    const wanted = randomInt(random, settings.groupsPerChunk);
    for (let g = 0; g < wanted; g++) {
      const count = randomInt(random, settings.perGroup);
      for (let i = 0; i < settings.shoreTries; i++) {
        const x = (chunk.cx + random()) * chunkSize;
        const z = (chunk.cz + random()) * chunkSize;
        const toWater = this.waterDirection(x, z);
        if (toWater === undefined) {
          continue;
        }
        groups.push(this.makeGroup(chunk.key, groups.length, x, z, toWater, count, random));
        break;
      }
    }
    if (groups.length > 0) {
      this.groups.set(chunk.key, groups);
    }
  }

  unload(key: string): void {
    for (const group of this.groups.get(key) ?? []) {
      for (const frog of group.frogs) {
        frog.rig.root.dispose();
      }
      for (const chorus of this.choruses) {
        if (chorus.group === group) {
          chorus.group = undefined;
          chorus.sound.stop();
        }
      }
    }
    this.groups.delete(key);
  }

  /** Development: the groups around and the nearest one to (x, z). */
  debugState(x: number, z: number): object {
    const nearest = this.nearest(x, z);
    return {
      groups: [...this.groups.values()].flat().length,
      singing: this.choruses.filter((chorus) => chorus.group).length,
      silenced: this.silenced,
      jumps: this.jumps,
      nearest: nearest && {
        x: Math.round(nearest.x),
        z: Math.round(nearest.z),
        frogs: nearest.frogs.length,
        singing: this.choruses.some((chorus) => chorus.group === nearest),
        hidden: nearest.frogs.filter((frog) => frog.state === "hidden").length,
        distance: Math.round(flatDistance(nearest, { x, z })),
      },
    };
  }

  /** Development: the nearest group to (x, z). */
  nearest(x: number, z: number): Group | undefined {
    let best: Group | undefined;
    for (const group of [...this.groups.values()].flat()) {
      if (!best || flatDistance(group, { x, z }) < flatDistance(best, { x, z })) {
        best = group;
      }
    }
    return best;
  }

  /**
   * On dry ground with water within `shoreReach`: the direction of the water (radians), or
   * undefined.
   */
  private waterDirection(x: number, z: number): number | undefined {
    const { terrain } = this.senses;
    if (terrain.waterAt(x, z).depth > 0) {
      return undefined;
    }
    const reach = CONFIG.wildlife.frogs.shoreReach;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      if (terrain.waterAt(x + Math.sin(angle) * reach, z + Math.cos(angle) * reach).depth > 0.05) {
        return angle;
      }
    }
    return undefined;
  }

  private makeGroup(
    key: string,
    index: number,
    x: number,
    z: number,
    toWater: number,
    count: number,
    random: () => number,
  ): Group {
    const settings = CONFIG.wildlife.frogs;
    const { terrain, scene } = this.senses;
    const frogs: Frog[] = [];
    for (let i = 0; i < count; i++) {
      // Along the shore, each a little apart, all facing the water.
      const along = (random() - 0.5) * 2 * settings.spread;
      let fx = x + Math.cos(toWater) * along;
      let fz = z - Math.sin(toWater) * along;
      if (terrain.waterAt(fx, fz).depth > 0) {
        fx = x;
        fz = z;
      }
      const heading = toWater + (random() - 0.5) * 0.8;
      const rig = createFrog(scene, `frog-${key}-${index}-${i}`);
      rig.root.scaling.setAll(settings.scale);
      rig.root.position.set(fx, terrain.heightAt(fx, fz), fz);
      rig.root.rotation.y = heading;
      const water = {
        x: fx + Math.sin(toWater) * settings.jumpLength,
        z: fz + Math.cos(toWater) * settings.jumpLength,
      };
      frogs.push({
        rig,
        home: { x: fx, z: fz, heading },
        water,
        state: "sit",
        delay: 0,
        nextTurn: randomInRange(random, settings.turnEvery),
      });
    }
    const group: Group = {
      x,
      z,
      frogs,
      quietUntil: 0,
      hiddenUntil: 0,
      jumpTime: 0,
      shown: true,
    };
    this.show(group, false);
    return group;
  }

  private show(group: Group, shown: boolean): void {
    if (group.shown === shown) {
      return;
    }
    group.shown = shown;
    for (const frog of group.frogs) {
      frog.rig.root.setEnabled(shown && frog.state !== "hidden");
    }
  }

  private update(seconds: number): void {
    if (seconds <= 0) {
      return;
    }
    this.time += seconds;
    const settings = CONFIG.wildlife.frogs;
    const feet = this.senses.player.feet;
    const creature = this.senses.creaturePosition();
    const singing: { group: Group; distance: number }[] = [];
    for (const group of [...this.groups.values()].flat()) {
      const distance = flatDistance(group, feet);
      this.show(group, distance < CONFIG.wildlife.activeDistance);
      if (!group.shown) {
        continue;
      }
      // AV5-A: someone near: the chorus stops at once, and stays quiet a while after.
      if (
        distance < settings.quietDistance ||
        flatDistance(group, creature) < settings.quietDistance
      ) {
        group.quietUntil = this.time + settings.quietSeconds;
      }
      if (this.time >= group.quietUntil && distance < settings.chorusHearing) {
        singing.push({ group, distance });
      }
      this.updateFrogs(group, distance, seconds);
    }
    this.assignChoruses(singing);
  }

  /** The nearest singing groups get the chorus loops; a group gone quiet stops at once. */
  private assignChoruses(singing: { group: Group; distance: number }[]): void {
    if (this.choruses.length === 0) {
      return;
    }
    const heard = singing
      .sort((a, b) => a.distance - b.distance)
      .slice(0, this.choruses.length)
      .map(({ group }) => group);
    for (const chorus of this.choruses) {
      if (chorus.group && heard.includes(chorus.group)) {
        continue;
      }
      if (chorus.group) {
        this.silenced++;
      }
      const next = heard.find((group) => !this.choruses.some((other) => other.group === group));
      chorus.group = next;
      if (next) {
        chorus.emitter.position.set(next.x, this.senses.terrain.heightAt(next.x, next.z), next.z);
        chorus.sound.play({ startOffset: Math.random() * 15 });
      } else {
        chorus.sound.stop();
      }
    }
  }

  private updateFrogs(group: Group, distance: number, seconds: number): void {
    const settings = CONFIG.wildlife.frogs;
    const sitting = group.frogs.some((frog) => frog.state === "sit");
    // AV5-A: the player close: one after another, into the water.
    if (sitting && distance < settings.jumpDistance) {
      group.jumpTime = 0;
      for (const frog of group.frogs) {
        if (frog.state === "sit") {
          frog.state = "jump";
          frog.delay = this.random() * settings.jumpSpread;
        }
      }
      group.hiddenUntil = this.time + randomInRange(this.random, settings.hideSeconds);
    }
    group.jumpTime += seconds;
    // Back out of the water when the time is up and the player has gone.
    if (
      group.frogs.every((frog) => frog.state === "hidden") &&
      this.time >= group.hiddenUntil &&
      distance > settings.jumpDistance * 2
    ) {
      for (const frog of group.frogs) {
        this.sitAtHome(frog);
      }
    }
    for (const frog of group.frogs) {
      if (frog.state === "jump") {
        this.updateJump(frog, group.jumpTime);
      } else if (frog.state === "sit") {
        this.updateSit(frog, seconds);
      }
    }
  }

  private sitAtHome(frog: Frog): void {
    const { root, legL, legR } = frog.rig;
    frog.state = "sit";
    root.position.set(
      frog.home.x,
      this.senses.terrain.heightAt(frog.home.x, frog.home.z),
      frog.home.z,
    );
    root.rotation.y = frog.home.heading;
    kick(legL, legR, 0);
    root.setEnabled(true);
  }

  /** Breathing, and now and then a turn on the spot. */
  private updateSit(frog: Frog, seconds: number): void {
    const settings = CONFIG.wildlife.frogs;
    const { root } = frog.rig;
    root.scaling.y = settings.scale * (1 + Math.sin(this.time * 4 + frog.home.x) * 0.04);
    frog.nextTurn -= seconds;
    if (frog.nextTurn <= 0) {
      frog.nextTurn = randomInRange(this.random, settings.turnEvery);
      root.rotation.y = frog.home.heading + (this.random() - 0.5) * 0.8;
    }
  }

  /** An arc into the water, legs kicked out; a plop, and it is gone under. */
  private updateJump(frog: Frog, time: number): void {
    const settings = CONFIG.wildlife.frogs;
    const { root, legL, legR } = frog.rig;
    const t = (time - frog.delay) / settings.jumpSeconds;
    if (t < 0) {
      return;
    }
    if (t >= 1) {
      frog.state = "hidden";
      root.setEnabled(false);
      this.jumps++;
      if (this.plop) {
        const { terrain } = this.senses;
        const level = terrain.waterAt(frog.water.x, frog.water.z).level;
        this.plop.emitter.position.set(
          frog.water.x,
          Number.isFinite(level) ? level : terrain.heightAt(frog.water.x, frog.water.z),
          frog.water.z,
        );
        this.plop.sound.play({ volume: settings.plopVolume * (0.7 + Math.random() * 0.3) });
      }
      return;
    }
    const { terrain } = this.senses;
    const x = frog.home.x + (frog.water.x - frog.home.x) * t;
    const z = frog.home.z + (frog.water.z - frog.home.z) * t;
    root.rotation.y = Math.atan2(frog.water.x - frog.home.x, frog.water.z - frog.home.z);
    root.position.set(x, terrain.heightAt(x, z) + Math.sin(t * Math.PI) * settings.jumpHeight, z);
    kick(legL, legR, Math.sin(Math.min(1, t * 2) * Math.PI * 0.5));
  }
}
