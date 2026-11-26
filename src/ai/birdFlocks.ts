import { CreateSoundAsync, TransformNode, Vector3, type StaticSound } from "@babylonjs/core";
import { CONFIG } from "../config";
import { soundUrl, type GameAudio } from "../core/audio";
import { frameSeconds } from "../core/gameTime";
import { createRandom, randomInRange, randomInt } from "../core/random";
import { createBird, flap, fold, glide, type BirdRig } from "../models/animals/smallAnimals";
import type { NoiseEvent } from "../systems/noise";
import type { ChunkInfo } from "../world/chunks";
import { chunkRandom, flatDistance, type WildlifeSenses } from "./wildlifeCommon";

/** A bird's flight from where it took off to where it lands. */
interface Flight {
  from: Vector3;
  to: Vector3;
  /** Seconds after the flock's take-off that this bird leaves. */
  delay: number;
  duration: number;
}

interface Bird {
  rig: BirdRig;
  heading: number;
  /** Seconds to the next peck, and how much of the current peck is left. */
  nextPeck: number;
  peckLeft: number;
  nextHop: number;
  hop: { fromX: number; fromZ: number; toX: number; toZ: number; left: number } | undefined;
  flight: Flight | undefined;
  wingPhase: number;
}

interface Flock {
  x: number;
  z: number;
  birds: Bird[];
  flying: boolean;
  /** Seconds since the flock took off. */
  flightTime: number;
  shown: boolean;
}

/**
 * NBB-166 (AV2-A, AV3-A): flocks of 4 to 8 birds pecking on the ground in clearings and fields,
 * by day only. When the player comes within 12 m or the creature within 25 m (or a noise reaches
 * them), they take off with a burst of wings heard from far away, a noise the prey and the
 * creature hear too, fly off and land again 45 to 80 m away.
 */
export class BirdFlocks {
  private readonly senses: WildlifeSenses;
  private readonly seed: number;
  private readonly random: () => number;
  private readonly flocks = new Map<string, Flock>();
  private sound: { sound: StaticSound; emitter: TransformNode } | undefined;
  /** Development: how many times a flock has taken off. */
  private takeoffs = 0;

  constructor(senses: WildlifeSenses, seed: number) {
    this.senses = senses;
    this.seed = seed;
    this.random = createRandom(seed + 166);
    senses.scene.onBeforeRenderObservable.add(() => this.update(frameSeconds(senses.scene)));
    senses.noise.onNoise.add((event) => this.hear(event));
  }

  async loadSounds(audio: GameAudio): Promise<void> {
    const settings = CONFIG.wildlife.birds;
    const emitter = new TransformNode("birdFlockSound", this.senses.scene);
    const sound = await CreateSoundAsync(
      "birdFlock",
      soundUrl(settings.sound),
      {
        maxInstances: 2,
        volume: settings.volume,
        outBus: audio.effects,
        spatialEnabled: true,
        spatialDistanceModel: "linear",
        spatialMinDistance: 2,
        spatialMaxDistance: settings.hearingDistance,
      },
      audio.engine,
    );
    sound.spatial.attach(emitter);
    this.sound = { sound, emitter };
  }

  load(chunk: ChunkInfo): void {
    const settings = CONFIG.wildlife.birds;
    const { terrain, chunks, scene } = this.senses;
    const random = chunkRandom(chunk, 31, this.seed);
    if (random() >= settings.flockChance) {
      return;
    }
    const { chunkSize } = CONFIG.world;
    // A clearing of the right biome, on dry ground.
    let spot: { x: number; z: number } | undefined;
    for (let i = 0; i < settings.clearingTries && !spot; i++) {
      const x = (chunk.cx + random()) * chunkSize;
      const z = (chunk.cz + random()) * chunkSize;
      if (
        (settings.biomes as readonly string[]).includes(terrain.biomeAt(x, z)) &&
        terrain.waterAt(x, z).depth === 0 &&
        chunks.treesNear(x, z, settings.clearing).length === 0
      ) {
        spot = { x, z };
      }
    }
    if (!spot) {
      return;
    }
    const count = randomInt(random, settings.perFlock);
    const birds: Bird[] = [];
    for (let i = 0; i < count; i++) {
      const rig = createBird(scene, `bird-${chunk.key}-${i}`);
      rig.root.scaling.setAll(settings.scale);
      const x = spot.x + (random() - 0.5) * 2 * settings.spread;
      const z = spot.z + (random() - 0.5) * 2 * settings.spread;
      const heading = random() * Math.PI * 2;
      rig.root.position.set(x, terrain.heightAt(x, z), z);
      rig.root.rotation.y = heading;
      birds.push({
        rig,
        heading,
        nextPeck: randomInRange(random, settings.peckEvery),
        peckLeft: 0,
        nextHop: randomInRange(random, settings.hopEvery),
        hop: undefined,
        flight: undefined,
        wingPhase: random() * Math.PI * 2,
      });
    }
    const flock: Flock = { ...spot, birds, flying: false, flightTime: 0, shown: true };
    this.show(flock, false);
    this.flocks.set(chunk.key, flock);
  }

  unload(key: string): void {
    for (const bird of this.flocks.get(key)?.birds ?? []) {
      bird.rig.root.dispose();
    }
    this.flocks.delete(key);
  }

  /** Development: the flocks around and the nearest one to (x, z). */
  debugState(x: number, z: number): object {
    const nearest = this.nearest(x, z);
    return {
      flocks: this.flocks.size,
      takeoffs: this.takeoffs,
      nearest: nearest && {
        x: Math.round(nearest.x),
        z: Math.round(nearest.z),
        birds: nearest.birds.length,
        flying: nearest.flying,
        shown: nearest.shown,
        distance: Math.round(flatDistance(nearest, { x, z })),
      },
    };
  }

  /** Development: the nearest flock to (x, z) on the ground. */
  nearest(x: number, z: number): Flock | undefined {
    let best: Flock | undefined;
    for (const flock of this.flocks.values()) {
      if (!best || flatDistance(flock, { x, z }) < flatDistance(best, { x, z })) {
        best = flock;
      }
    }
    return best;
  }

  private show(flock: Flock, shown: boolean): void {
    if (flock.shown === shown) {
      return;
    }
    flock.shown = shown;
    for (const bird of flock.birds) {
      bird.rig.root.setEnabled(shown);
    }
  }

  /** AV2-A: a noise that reaches a flock on the ground scares it (not their own wings). */
  private hear(event: NoiseEvent): void {
    if (event.source === "birds") {
      return;
    }
    for (const flock of this.flocks.values()) {
      if (!flock.flying && flock.shown && flatDistance(flock, event.position) < event.radius) {
        this.takeOff(flock, event.position);
      }
    }
  }

  private update(seconds: number): void {
    if (seconds <= 0) {
      return;
    }
    const settings = CONFIG.wildlife.birds;
    const { player, clock } = this.senses;
    const feet = player.feet;
    const creature = this.senses.creaturePosition();
    // AV3-A: they sleep at night: no flocks on the ground.
    const night = clock.phase === "night";
    for (const flock of this.flocks.values()) {
      if (flock.flying) {
        this.updateFlight(flock, seconds);
        continue;
      }
      const distance = flatDistance(flock, feet);
      this.show(flock, !night && distance < CONFIG.wildlife.activeDistance);
      if (!flock.shown) {
        continue;
      }
      if (distance < settings.playerDistance) {
        this.takeOff(flock, feet);
      } else if (flatDistance(flock, creature) < settings.creatureDistance) {
        this.takeOff(flock, creature);
      } else {
        for (const bird of flock.birds) {
          this.updateOnGround(bird, seconds);
        }
      }
    }
  }

  /** Pecking now and then, and a little hop to a new spot. */
  private updateOnGround(bird: Bird, seconds: number): void {
    const settings = CONFIG.wildlife.birds;
    const { root, head } = bird.rig;
    bird.nextPeck -= seconds;
    if (bird.nextPeck <= 0 && bird.peckLeft <= 0 && !bird.hop) {
      bird.peckLeft = settings.peckSeconds;
      bird.nextPeck = randomInRange(this.random, settings.peckEvery);
    }
    if (bird.peckLeft > 0) {
      bird.peckLeft = Math.max(0, bird.peckLeft - seconds);
      head.rotation.x = Math.sin((1 - bird.peckLeft / settings.peckSeconds) * Math.PI) * 0.9;
    }
    bird.nextHop -= seconds;
    if (bird.nextHop <= 0 && !bird.hop && bird.peckLeft <= 0) {
      bird.heading += (this.random() - 0.5) * 2;
      root.rotation.y = bird.heading;
      bird.hop = {
        fromX: root.position.x,
        fromZ: root.position.z,
        toX: root.position.x + Math.sin(bird.heading) * settings.hopDistance,
        toZ: root.position.z + Math.cos(bird.heading) * settings.hopDistance,
        left: settings.hopSeconds,
      };
      bird.nextHop = randomInRange(this.random, settings.hopEvery);
    }
    const hop = bird.hop;
    if (hop) {
      hop.left = Math.max(0, hop.left - seconds);
      const t = 1 - hop.left / settings.hopSeconds;
      const x = hop.fromX + (hop.toX - hop.fromX) * t;
      const z = hop.fromZ + (hop.toZ - hop.fromZ) * t;
      root.position.set(x, this.senses.terrain.heightAt(x, z) + Math.sin(t * Math.PI) * 0.04, z);
      if (hop.left <= 0) {
        bird.hop = undefined;
      }
    }
  }

  /** AV2-A: up and away from `threat`, with the burst of wings and its noise. */
  private takeOff(flock: Flock, threat: { x: number; z: number }): void {
    const settings = CONFIG.wildlife.birds;
    const { terrain, player } = this.senses;
    // Where they land: away from the threat, on dry ground, not near the player.
    const away = Math.atan2(flock.x - threat.x, flock.z - threat.z);
    let land = { x: flock.x, z: flock.z };
    for (let i = 0; i < 8; i++) {
      const angle = away + (this.random() - 0.5) * 1.2;
      const distance = randomInRange(this.random, settings.landDistance);
      const x = flock.x + Math.sin(angle) * distance;
      const z = flock.z + Math.cos(angle) * distance;
      land = { x, z };
      if (terrain.waterAt(x, z).depth === 0 && flatDistance(land, player.feet) > 35) {
        break;
      }
    }
    for (const bird of flock.birds) {
      const from = bird.rig.root.position.clone();
      const x = land.x + (this.random() - 0.5) * 2 * settings.spread;
      const z = land.z + (this.random() - 0.5) * 2 * settings.spread;
      const to = new Vector3(x, terrain.heightAt(x, z), z);
      bird.flight = {
        from,
        to,
        delay: this.random() * settings.takeoffSpread,
        duration: Math.max(1, flatDistance(from, to) / settings.flightSpeed),
      };
      bird.hop = undefined;
      bird.peckLeft = 0;
      bird.rig.head.rotation.x = 0;
    }
    flock.flying = true;
    flock.flightTime = 0;
    flock.x = land.x;
    flock.z = land.z;
    this.takeoffs++;
    const center = new Vector3(
      flock.birds[0]?.flight?.from.x ?? land.x,
      0,
      flock.birds[0]?.flight?.from.z ?? land.z,
    );
    center.y = terrain.heightAt(center.x, center.z) + 1;
    if (this.sound) {
      this.sound.emitter.position.copyFrom(center);
      this.sound.sound.play();
    }
    this.senses.noise.emit(center, settings.noise, "birds");
  }

  /** Along an arc to the landing spot: beating wings, then gliding down, then folded. */
  private updateFlight(flock: Flock, seconds: number): void {
    const settings = CONFIG.wildlife.birds;
    flock.flightTime += seconds;
    let landed = 0;
    for (const bird of flock.birds) {
      const flight = bird.flight;
      if (!flight) {
        landed++;
        continue;
      }
      const t = Math.min(1, Math.max(0, (flock.flightTime - flight.delay) / flight.duration));
      const { root, wingL, wingR } = bird.rig;
      root.position.set(
        flight.from.x + (flight.to.x - flight.from.x) * t,
        flight.from.y +
          (flight.to.y - flight.from.y) * t +
          Math.sin(t * Math.PI) * settings.flightHeight,
        flight.from.z + (flight.to.z - flight.from.z) * t,
      );
      bird.heading = Math.atan2(flight.to.x - flight.from.x, flight.to.z - flight.from.z);
      root.rotation.y = bird.heading;
      if (t >= 1) {
        fold(wingL, wingR);
        bird.flight = undefined;
        landed++;
      } else if (t > 1 - settings.glideShare) {
        glide(wingL, wingR);
      } else if (flock.flightTime >= flight.delay) {
        bird.wingPhase += settings.flapRate * seconds;
        flap(wingL, wingR, bird.wingPhase);
      }
    }
    if (landed === flock.birds.length) {
      flock.flying = false;
    }
  }
}
