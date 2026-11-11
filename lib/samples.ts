import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

export type Sample = {
  id: string;
  name: string;
  virus: string;
  date: string;
  isoDate: string;
  sequence: string;
};

/** Loads the hardcoded sample metadata and joins it with the FASTA sequences by order. */
export async function loadSamples(): Promise<Sample[]> {
  "use cache";
  const root = process.cwd();
  const yaml = await readFile(path.join(root, "data/samples.yaml"), "utf8");
  const fasta = await readFile(path.join(root, "data/sequences.fasta"), "utf8");

  const meta = parse(yaml) as { id: string; name: string; virus: string; date: string | Date }[];
  const sequences = parseFasta(fasta);

  return meta.map((m, index) => ({
    id: m.id,
    name: m.name,
    virus: m.virus,
    date: formatDate(m.date),
    isoDate: toIsoDate(m.date),
    sequence: sequences[index] ?? "",
  }));
}

function toIsoDate(date: string | Date): string {
  return (date instanceof Date ? date.toISOString() : String(date)).slice(0, 10);
}

/** Formats an ISO date (or a parsed YAML date) as dd.mm.yyyy. */
function formatDate(date: string | Date): string {
  const [year, month, day] = toIsoDate(date).split("-");
  return `${day}.${month}.${year}`;
}

/** Returns the sequences of a FASTA file in file order, ignoring the headers. */
function parseFasta(text: string): string[] {
  const result: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(">")) {
      result.push("");
    } else if (result.length > 0) {
      result[result.length - 1] += line.trim().toUpperCase();
    }
  }
  return result;
}
