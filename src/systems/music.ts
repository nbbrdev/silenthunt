import {
  CreateSoundAsync,
  CreateStreamingSoundAsync,
  type Scene,
  type StaticSound,
  type StreamingSound,
} from "@babylonjs/core";
import { CONFIG } from "../config";
import { frameSeconds } from "../core/gameTime";
import { soundUrl, type GameAudio } from "../core/audio";
import type { DayClock } from "../core/dayClock";

interface Track {
  sound: StreamingSound;
  /** Length of the track (seconds). */
  duration: number;
  /** Seconds left of the fade out, once it began. */
  fadeLeft: number | undefined;
}

/** MF16: the pieces that can be played on their own (development). */
export type MusicCue = "dawn" | "dusk" | "victory" | "menu";

/**
 * The music (NBB-149, SM5-A, MU2; NBB-161, MF1-A to MF16), all of it CC0 or CC-BY tracks that come
 * with the game:
 * - the main menu's theme, in a loop, coming in over 2 s and leaving over 1.5 s into the game;
 * - by day, rare and soft: the first track 1–3 min into the game, then one every 5–10 min with
 *   silence in between, in random order without repeating; each fades in over 3 s and out over
 *   5 s; when dusk comes, the one playing fades out over 10 s and none starts at night;
 * - a short piece at dawn and at dusk (the day's messages play them);
 * - the victory's track, once, while its screen is up.
 */
export class MusicPlayer {
  private readonly clock: DayClock;
  private readonly isMainMenu: () => boolean;
  private audio: GameAudio | undefined;
  private queue: string[] = [];
  private wait: number;
  private current: Track | undefined;
  private loading = false;
  private menu: StaticSound | undefined;
  /** The menu's theme: playing, or seconds left of its fade out. */
  private menuState: "off" | "on" | number = "off";
  private cues: { dawn?: StaticSound; dusk?: StaticSound } = {};
  private victory: StreamingSound | undefined;

  constructor(scene: Scene, clock: DayClock, isMainMenu: () => boolean) {
    this.clock = clock;
    this.isMainMenu = isMainMenu;
    this.wait = randomBetween(CONFIG.music.firstDelay);
    scene.onBeforeRenderObservable.add(() => {
      // The menu's theme in real time (the world is paused behind the menu); the day's in game time.
      this.updateMenu(Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1));
      this.updateDay(frameSeconds(scene));
    });
  }

  async load(audio: GameAudio): Promise<void> {
    const settings = CONFIG.music;
    const load = (name: string, file: string, loop: boolean) =>
      CreateSoundAsync(
        name,
        soundUrl(file),
        { loop, volume: loop ? 0 : settings.cueVolume, outBus: audio.music },
        audio.engine,
      );
    const [menu, dawn, dusk] = await Promise.all([
      load("menuTheme", settings.menuFile, true),
      load("dawnCue", settings.dawnFile, false),
      load("duskCue", settings.duskFile, false),
    ]);
    this.menu = menu;
    this.cues = { dawn, dusk };
    this.audio = audio;
  }

  /** Development: what plays and how long until the next day track. */
  debugState(): { playing: string | undefined; wait: number; menu: string } {
    return {
      playing: this.current?.sound.name,
      wait: Math.round(this.wait),
      menu: typeof this.menuState === "number" ? "saindo" : this.menuState,
    };
  }

  /** Development: the next day track starts now (by day). */
  debugNext(): void {
    this.wait = 0;
  }

  /** Development (MF16): plays one piece now. */
  debugCue(cue: MusicCue): void {
    if (cue === "dawn" || cue === "dusk") {
      this.playCue(cue);
    } else if (cue === "victory") {
      void this.startVictory();
    } else {
      this.menu?.play();
      this.menu?.setVolume(CONFIG.music.volume, { duration: CONFIG.music.menuFadeInSeconds });
    }
  }

  /** MF10-B, MF11-A: the short piece at dawn or dusk. */
  playCue(cue: "dawn" | "dusk"): void {
    this.cues[cue]?.play();
  }

  /** MF12-A: the victory's track, once; the day track leaves first. */
  async startVictory(): Promise<void> {
    const audio = this.audio;
    if (!audio || this.victory) {
      return;
    }
    if (this.current) {
      this.finish(this.current);
    }
    const settings = CONFIG.music;
    try {
      const sound = await CreateStreamingSoundAsync(
        "victoryTheme",
        soundUrl(settings.victoryFile),
        { volume: 0, outBus: audio.music },
        audio.engine,
      );
      this.victory = sound;
      sound.onEndedObservable.addOnce(() => this.dropVictory(sound));
      sound.play();
      sound.setVolume(settings.volume, { duration: settings.victoryFadeInSeconds });
    } catch (error: unknown) {
      console.warn("Música da vitória não tocada:", error);
    }
  }

  /** The victory's screen closed: its track leaves over 1.5 s. */
  stopVictory(): void {
    const sound = this.victory;
    if (!sound) {
      return;
    }
    const seconds = CONFIG.music.victoryFadeOutSeconds;
    sound.setVolume(0, { duration: seconds });
    window.setTimeout(() => this.dropVictory(sound), seconds * 1000);
  }

  private dropVictory(sound: StreamingSound): void {
    if (this.victory !== sound) {
      return;
    }
    this.victory = undefined;
    sound.stop();
    sound.dispose();
  }

  /** MF4-A: the theme while the main menu is open; it starts over each time it opens. */
  private updateMenu(seconds: number): void {
    const menu = this.menu;
    if (!menu) {
      return;
    }
    const settings = CONFIG.music;
    const wanted = this.isMainMenu();
    if (wanted && this.menuState !== "on") {
      if (this.menuState === "off") {
        menu.play();
      }
      menu.setVolume(settings.volume, { duration: settings.menuFadeInSeconds });
      this.menuState = "on";
      // The day track does not play over the menu.
      if (this.current) {
        this.finish(this.current);
      }
    } else if (!wanted && this.menuState === "on") {
      menu.setVolume(0, { duration: settings.menuFadeOutSeconds });
      this.menuState = settings.menuFadeOutSeconds;
    } else if (typeof this.menuState === "number") {
      this.menuState -= seconds;
      if (this.menuState <= 0) {
        menu.stop();
        this.menuState = "off";
      }
    }
  }

  private updateDay(seconds: number): void {
    const audio = this.audio;
    if (!audio || this.isMainMenu() || this.victory) {
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
      void this.playNext(audio);
    }
  }

  private async playNext(audio: GameAudio): Promise<void> {
    if (this.queue.length === 0) {
      this.queue = shuffle([...CONFIG.music.dayTracks]);
    }
    const file = this.queue.shift();
    if (!file) {
      return;
    }
    this.loading = true;
    try {
      // An <audio> element streams the file and knows its length (for the fade at the end).
      const media = new Audio(soundUrl(file));
      media.preload = "auto";
      await new Promise<void>((resolve, reject) => {
        media.addEventListener("loadedmetadata", () => resolve(), { once: true });
        media.addEventListener("error", () => reject(new Error(`não abriu ${file}`)), {
          once: true,
        });
      });
      const sound = await CreateStreamingSoundAsync(
        file,
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
      console.warn("Música não tocada:", file, error);
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
