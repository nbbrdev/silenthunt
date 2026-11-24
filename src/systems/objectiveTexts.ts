/**
 * NBB-156 (OB13): the words of the way out, as the user approved them. `{direção}` and
 * `{distância}` are filled in with where the next cabin is.
 */

/** A note or a diary page: its title in the "Anotações" list and its text. */
export interface NoteText {
  title: string;
  text: string;
}

/** OB6-A: shown once, when a new world begins. */
export const INTRO_TEXT = "Você se perdeu na floresta. Há uma cabana a uns 60 m a {direção}.";

/** OB12, OB13: the notes, one per cabin on the way out (0 is the first cabin). */
export const NOTES: readonly NoteText[] = [
  {
    title: "Bilhete 1",
    text:
      "Se alguém achar isto: o rádio estragou e eu espalhei as peças pelas cabanas da mata. " +
      "A primeira está a uns {distância} m a {direção} daqui. Monte o rádio e chame o resgate. " +
      "E não ande à noite.",
  },
  {
    title: "Bilhete 2",
    text: "A bateria ainda segura carga. A antena ficou a uns {distância} m a {direção}.",
  },
  {
    title: "Bilhete 3",
    text: "Falta pouco. As válvulas estão a uns {distância} m a {direção}, na cabana mais funda.",
  },
  {
    title: "Bilhete 4",
    text:
      "Com as três peças, monte o rádio. O resgate só voa ao amanhecer. Chame e aguente a " +
      "noite: ela sabe quando alguém quer ir embora.",
  },
];

/** OB8-A, OB13: the hunter's diary, one page in each of the first three cabins. */
export const DIARY: readonly NoteText[] = [
  {
    title: "Diário, página 1",
    text:
      "Ela usa o crânio de um cervo como rosto. Uma vez a vi parar diante de uma carcaça e " +
      "ficar olhando, como se reconhecesse alguém.",
  },
  {
    title: "Diário, página 2",
    text:
      "Os velhos daqui diziam: três crânios de cervo no fogo, à noite, com ela perto o bastante " +
      "para sentir o cheiro. Ela vai embora e não volta. Nunca tive coragem.",
  },
  {
    title: "Diário, página 3",
    text: "Ela me acha nas moitas, cedo ou tarde. Mas teme o fogo. Toda noite, o fogo.",
  },
];

/** OB3-A, OB12: the eight directions, clockwise from north (the world's +Z). */
export const DIRECTIONS = [
  "norte",
  "nordeste",
  "leste",
  "sudeste",
  "sul",
  "sudoeste",
  "oeste",
  "noroeste",
] as const;

/** The compass's letters for the same eight directions. */
export const COMPASS_LETTERS = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"] as const;

/** OB13: the rest of the words. */
export const OBJECTIVE_WORDS = {
  callRescue: "Chamar o resgate",
  burnSkulls: "Queimar os crânios",
  rescueComing: "O resgate chega ao amanhecer. Aguente esta noite.",
  needCreature: "Ela precisa estar perto",
  onlyAtNight: "Só à noite",
  rescuedTitle: "Você foi resgatado",
  banishedTitle: "A criatura foi banida",
  continuePlaying: "Continuar jogando",
  mainMenu: "Menu principal",
  notesTitle: "Anotações",
} as const;

/** The direction (pt-BR) from one point to another, in eight steps. */
export function directionName(fromX: number, fromZ: number, toX: number, toZ: number): string {
  const angle = Math.atan2(toX - fromX, toZ - fromZ);
  const index = Math.round(angle / (Math.PI / 4));
  return DIRECTIONS[((index % 8) + 8) % 8] ?? "norte";
}
