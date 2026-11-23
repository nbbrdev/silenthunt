import { CreateStreamingSoundAsync, type Scene, type StreamingSound } from "@babylonjs/core";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import type { GameAudio } from "../core/audio";
import type { DayClock } from "../core/dayClock";

interface Track {
  sound: StreamingSound;
  /** Length of the track (seconds). */
  duration: number;
  /** Seconds left of the fade out, once it began. */
  fadeLeft: number | undefined;
}

/**
 * The music (NBB-149, SM5-A, MU1-A to MU3): rare and soft, by day only. The tracks are the ones in
 * `assets-private/music/` (G10, out of Git), listed at `/music/index.json`; without them there is
 * no music. The first comes 1–3 min after the game opens, then one every 5–10 min with silence in
 * between, in random order without repeating until all have played. Each fades in over 3 s and out
 * over 5 s; when dusk comes, the one playing fades out over 10 s and none starts at night.
 */
export class MusicPlayer {
  private readonly clock: DayClock;
  private audio: GameAudio | undefined;
  private tracks: string[] = [];
  private queue: string[] = [];
  private wait: number;
  private current: Track | undefined;
  private loading = false;

  constructor(scene: Scene, clock: DayClock) {
    this.clock = clock;
    this.wait = randomBetween(CONFIG.music.firstDelay);
    scene.onBeforeRenderObservable.add(() => {
      this.update(frameSeconds(scene));
    });
  }

  /** Reads the list of tracks; with none (no private folder), the game stays without music. */
  async load(audio: GameAudio): Promise<void> {
    const response = await fetch(`${import.meta.env.BASE_URL}${CONFIG.music.list}`);
    const list: unknown = response.ok ? await response.json() : [];
    this.tracks = Array.isArray(list)
      ? list.filter((item): item is string => typeof item === "string")
      : [];
    this.audio = audio;
  }

  /** True if the private folder has tracks (the credits name the music then, MN5-A). */
  get hasTracks(): boolean {
    return this.tracks.length > 0;
  }

  /** Development: how many tracks, what is playing and how long until the next. */
  debugState(): { tracks: number; playing: string | undefined; wait: number } {
    return {
      tracks: this.tracks.length,
      playing: this.current?.sound.name,
      wait: Math.round(this.wait),
    };
  }

  /** Development: the next track starts now (by day). */
  debugNext(): void {
    this.wait = 0;
  }

  private update(seconds: number): void {
    if (!this.audio || this.tracks.length === 0) {
      return;
    }
    const settings = CONFIG.music;
    const day = this.clock.daylight >= settings.minDaylight;
    const track = this.current;
    if (track) {
      if (track.fadeLeft !== undefined) {
        track.fadeLeft -= seconds;
        if (track.fadeLeft <= 0) {
          this.finish(track);
        }
      } else if (!day) {
        // MU2: dusk takes the music away.
        this.fadeOut(track, settings.duskFadeSeconds);
      } else if (track.sound.currentTime >= track.duration - settings.fadeOutSeconds) {
        this.fadeOut(track, settings.fadeOutSeconds);
      }
      return;
    }
    this.wait -= seconds;
    if (this.wait <= 0 && day && !this.loading) {
      void this.playNext(this.audio);
    }
  }

  private async playNext(audio: GameAudio): Promise<void> {
    if (this.queue.length === 0) {
      this.queue = shuffle([...this.tracks]);
    }
    const name = this.queue.shift();
    if (!name) {
      return;
    }
    this.loading = true;
    try {
      // An <audio> element streams the file and knows its length (for the fade at the end).
      const media = new Audio(`${import.meta.env.BASE_URL}music/${encodeURIComponent(name)}`);
      media.preload = "auto";
      await new Promise<void>((resolve, reject) => {
        media.addEventListener("loadedmetadata", () => resolve(), { once: true });
        media.addEventListener("error", () => reject(new Error(`não abriu ${name}`)), {
          once: true,
        });
      });
      const sound = await CreateStreamingSoundAsync(
        name,
        media,
        { volume: 0, outBus: audio.music },
        audio.engine,
      );
      const track: Track = { sound, duration: media.duration, fadeLeft: undefined };
      this.current = track;
      sound.onEndedObservable.addOnce(() => this.finish(track));
      sound.play();
      sound.setVolume(CONFIG.music.volume, { duration: CONFIG.music.fadeInSeconds });
    } catch (error: unknown) {
      console.warn("Música não tocada:", name, error);
      this.wait = randomBetween(CONFIG.music.gap);
    } finally {
      this.loading = false;
    }
  }

  private fadeOut(track: Track, seconds: number): void {
    track.fadeLeft = seconds;
    track.sound.setVolume(0, { duration: seconds });
  }

  /** The track is over: silence for 5–10 min. */
  private finish(track: Track): void {
    if (this.current !== track) {
      return;
    }
    this.current = undefined;
    track.sound.stop();
    track.sound.dispose();
    this.wait = randomBetween(CONFIG.music.gap);
  }
}

function randomBetween([low, high]: readonly [number, number]): number {
  return low + Math.random() * (high - low);
}

/** The list in random order (Fisher–Yates). */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = items[i];
    const b = items[j];
    if (a !== undefined && b !== undefined) {
      items[i] = b;
      items[j] = a;
    }
  }
  return items;
}
