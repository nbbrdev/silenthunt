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

/**
 * The private music collections: the day tracks (MU1-A) in the folder itself, listed at
 * `/music/index.json`, and the chase track (MT1-C) in its `chase/` subfolder, listed at
 * `/music/chase.json` and served under `/music/chase/`.
 */
const COLLECTIONS = [
  { list: "index.json", folder: "" },
  { list: "chase.json", folder: "chase" },
] as const;

/** The music files in one private folder (none if it does not exist). */
function musicFiles(folder: string): string[] {
  const path = join(MUSIC_FOLDER, folder);
  if (!existsSync(path)) {
    return [];
  }
  return readdirSync(path)
    .filter((name) => extname(name).toLowerCase() in MUSIC_TYPES)
    .sort();
}

/** "chase/x.mp3" → the collection's folder and the file name, if it is one of its tracks. */
function findTrack(path: string): { folder: string; name: string } | undefined {
  for (const { folder } of COLLECTIONS) {
    const prefix = folder ? `${folder}/` : "";
    const name = path.startsWith(prefix) ? path.slice(prefix.length) : undefined;
    if (name && !name.includes("/") && musicFiles(folder).includes(name)) {
      return { folder, name };
    }
  }
  return undefined;
}

/**
 * MU1-A, MT1-C (NBB-149, NBB-153): makes the private music reachable at `/music/`, with the list
 * of each collection's tracks. While developing, it serves them from the folder; in the build, it
 * copies them in if the folder exists. Without the folder the lists are empty: no day music, and
 * the chase plays the track that comes with the game.
 */
function privateMusic(): Plugin {
  return {
    name: "silenthunt-private-music",
    configureServer(server) {
      server.middlewares.use("/music", (request, response, next) => {
        const path = decodeURIComponent(
          (request.url ?? "/").replace(/^\//, "").split("?")[0] ?? "",
        );
        const collection = COLLECTIONS.find(({ list }) => list === path);
        if (collection) {
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(musicFiles(collection.folder)));
          return;
        }
        const track = findTrack(path);
        if (!track) {
          next();
          return;
        }
        response.setHeader("Content-Type", MUSIC_TYPES[extname(track.name).toLowerCase()] ?? "");
        response.end(readFileSync(join(MUSIC_FOLDER, track.folder, track.name)));
      });
    },
    generateBundle() {
      for (const { list, folder } of COLLECTIONS) {
        const files = musicFiles(folder);
        const prefix = folder ? `music/${folder}/` : "music/";
        for (const name of files) {
          this.emitFile({
            type: "asset",
            fileName: `${prefix}${name}`,
            source: readFileSync(join(MUSIC_FOLDER, folder, name)),
          });
        }
        this.emitFile({ type: "asset", fileName: `music/${list}`, source: JSON.stringify(files) });
      }
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
