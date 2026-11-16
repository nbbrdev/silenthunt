import { testBox } from "./debug/testBox";
import type { ModelGenerator } from "./types";

/** Every model shown in the gallery. New models are added here (one line each). */
export const MODEL_REGISTRY: readonly ModelGenerator[] = [testBox];
