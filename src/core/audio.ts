import { CreateAudioEngineAsync, type AudioEngineV2, type Node } from "@babylonjs/core";
import { CONFIG } from "../config";

/**
 * The game's audio engine (A4-A, SO4). 3D sounds are heard from `ears` (the player's camera):
 * their volume and left/right balance follow where they are.
 */
export async function createGameAudio(ears: Node): Promise<AudioEngineV2> {
  const audio = await CreateAudioEngineAsync({
    volume: CONFIG.audio.masterVolume,
    listenerEnabled: true,
    // Browsers keep sound locked until the player interacts: the click that captures the mouse
    // unlocks it, and the default "unmute" button is not needed.
    resumeOnInteraction: true,
    disableDefaultUI: true,
  });
  audio.listener.attach(ears);
  return audio;
}

/** Where a sound file is served from (files in `public/sounds/`). */
export function soundUrl(path: string): string {
  return `${import.meta.env.BASE_URL}sounds/${path}`;
}
