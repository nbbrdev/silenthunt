import creditsText from "../../CREDITS.md?raw";

/** One line of the credits screen. */
export interface CreditLine {
  kind: "heading" | "text" | "item";
  text: string;
}

/** Links, code marks and bold, as plain text. */
function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .trim();
}

/**
 * MN5-A: the credits screen reads CREDITS.md itself, so there is one list only. Headings and
 * paragraphs are shown as they are; each table row (a sound) becomes "Sound — Author (License)".
 */
export function creditLines(): CreditLine[] {
  const lines: CreditLine[] = [];
  let tableRow = 0;
  for (const raw of creditsText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) {
      tableRow = 0;
    }
    if (line === "" || line.startsWith("# ")) {
      continue;
    }
    if (line.startsWith("## ")) {
      lines.push({ kind: "heading", text: plain(line.slice(3)) });
      continue;
    }
    if (line.startsWith("|")) {
      tableRow++;
      // The first row names the columns and the second is the separator.
      if (tableRow <= 2) {
        continue;
      }
      const cells = line.split("|").map((cell) => plain(cell));
      // Cells: "", file, original sound, author, license, what we did, "".
      const [, , original, author, license] = cells;
      if (original && author && license) {
        lines.push({ kind: "item", text: `${original} — ${author} (${license})` });
      }
      continue;
    }
    lines.push({ kind: "text", text: plain(line) });
  }
  return lines;
}
