import { defineConfig } from "vitest/config";

export default defineConfig({
  // O Havok carrega o próprio .wasm; o pré-empacotamento do Vite quebraria esse carregamento.
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
