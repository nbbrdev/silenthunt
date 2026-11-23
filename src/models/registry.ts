import { deer } from "./animals/deer";
import { rabbit } from "./animals/rabbit";
import { remains } from "./animals/remains";
import { meat } from "./items/meat";
import { axe } from "./items/axe";
import { backpack } from "./items/backpack";
import { cartridge, fat, fiber, leather, wood } from "./items/resources";
import { stump } from "./nature/stump";
import { bed } from "./structures/bed";
import { doorPiece, foundationPiece, roofPiece, wallPiece } from "./structures/buildPieces";
import { campfire } from "./structures/campfire";
import { creature } from "./creature/creature";
import { arrow, bow } from "./items/bow";
import { shotgun } from "./items/shotgun";
import { cabin } from "./structures/cabin";
import { knife } from "./items/knife";
import { arms } from "./player/arms";
import { torch } from "./items/torch";
import { antenna, battery, deerSkull, radio, tubes } from "./items/objective";
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
  knife,
  bow,
  arrow,
  shotgun,
  cabin,
  arms,
  campfire,
  meat,
  remains,
  fiber,
  fat,
  leather,
  cartridge,
  axe,
  wood,
  stump,
  foundationPiece,
  wallPiece,
  doorPiece,
  roofPiece,
  bed,
  backpack,
  battery,
  antenna,
  tubes,
  radio,
  deerSkull,
];
