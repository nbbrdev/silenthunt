import { HavokPlugin } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";

/** Loads the Havok WebAssembly module and wraps it in Babylon's physics plugin (T2-B). */
export async function createHavokPlugin(): Promise<HavokPlugin> {
  const havok = await HavokPhysics({ locateFile: () => havokWasmUrl });
  return new HavokPlugin(true, havok);
}
