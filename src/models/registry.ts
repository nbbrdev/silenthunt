import { deer } from "./animals/deer";
import { rabbit } from "./animals/rabbit";
import { creature } from "./creature/creature";
import { torch } from "./items/torch";
import { bush } from "./nature/bush";
import { deadTree } from "./nature/deadTree";
import { groundBranch } from "./nature/groundBranch";
import { groundTuft } from "./nature/groundTuft";
import { oak } from "./nature/oak";
import { pine } from "./nature/pine";
import { rock } from "./nature/rock";
import type { ModelGenerator } from "./types";

/** Every model shown in the gallery. New models are added here (one line each). */
export const MODEL_REGISTRY: readonly ModelGenerator[] = [
  pine,
  oak,
  deadTree,
  bush,
  rock,
  groundBranch,
  groundTuft,
  torch,
  creature,
  rabbit,
  deer,
];
