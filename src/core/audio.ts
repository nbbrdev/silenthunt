import {
  CreateAudioBusAsync,
  CreateAudioEngineAsync,
  type AudioBus,
  type AudioEngineV2,
  type Node,
} from "@babylonjs/core";
import { CONFIG } from "../config";

/**
 * The game's audio (A4-A, SO4, SM7): one engine and a bus per group of sounds (effects, ambience,
 * music), each with its own volume under the master volume; the options menu (NBB-150) moves them.
 */
export interface GameAudio {
  engine: AudioEngineV2;
  effects: AudioBus;
  ambience: AudioBus;
  music: AudioBus;
}

/** 3D sounds are heard from `ears` (the player's camera): volume and left/right follow them. */
export async function createGameAudio(ears: Node): Promise<GameAudio> {
  const { masterVolume, groups } = CONFIG.audio;
  const engine = await CreateAudioEngineAsync({
    volume: masterVolume,
    listenerEnabled: true,
    // Browsers keep sound locked until the player interacts: the click that captures the mouse
    // unlocks it, and the default "unmute" button is not needed.
    resumeOnInteraction: true,
    disableDefaultUI: true,
  });
  engine.listener.attach(ears);
  const [effects, ambience, music] = await Promise.all([
    CreateAudioBusAsync("effects", { volume: groups.effects }, engine),
    CreateAudioBusAsync("ambience", { volume: groups.ambience }, engine),
    CreateAudioBusAsync("music", { volume: groups.music }, engine),
  ]);
  return { engine, effects, ambience, music };
}

/** Where a sound file is served from (files in `public/sounds/`). */
export function soundUrl(path: string): string {
  return `${import.meta.env.BASE_URL}sounds/${path}`;
}
