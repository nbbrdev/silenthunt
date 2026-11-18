import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** G10: the Epidemic Sound music stays out of Git, in this folder (optional). */
const MUSIC_FOLDER = join(import.meta.dirname, "assets-private", "music");
const MUSIC_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};

/** The music files in the private folder (none if it does not exist). */
function musicFiles(): string[] {
  if (!existsSync(MUSIC_FOLDER)) {
    return [];
  }
  return readdirSync(MUSIC_FOLDER)
    .filter((name) => extname(name).toLowerCase() in MUSIC_TYPES)
    .sort();
}

/**
 * MU1-A (NBB-149): makes the private music reachable at `/music/`, with a list of the tracks at
 * `/music/index.json`. While developing, it serves them from the folder; in the build, it copies
 * them in if the folder exists. Without the folder the list is empty and the game has no music.
 */
function privateMusic(): Plugin {
  return {
    name: "silenthunt-private-music",
    configureServer(server) {
      server.middlewares.use("/music", (request, response, next) => {
        const name = decodeURIComponent(
          (request.url ?? "/").replace(/^\//, "").split("?")[0] ?? "",
        );
        if (name === "index.json") {
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(musicFiles()));
          return;
        }
        if (!musicFiles().includes(name)) {
          next();
          return;
        }
        response.setHeader("Content-Type", MUSIC_TYPES[extname(name).toLowerCase()] ?? "");
        response.end(readFileSync(join(MUSIC_FOLDER, name)));
      });
    },
    generateBundle() {
      const files = musicFiles();
      for (const name of files) {
        this.emitFile({
          type: "asset",
          fileName: `music/${name}`,
          source: readFileSync(join(MUSIC_FOLDER, name)),
        });
      }
      this.emitFile({ type: "asset", fileName: "music/index.json", source: JSON.stringify(files) });
    },
  };
}

export default defineConfig({
  plugins: [privateMusic()],
  // O Havok carrega o próprio .wasm; o pré-empacotamento do Vite quebraria esse carregamento.
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
