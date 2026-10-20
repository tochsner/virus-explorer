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

/** Loads the hardcoded sample metadata and joins it with the FASTA sequences by id. */
export async function loadSamples(): Promise<Sample[]> {
  "use cache";
  const root = process.cwd();
  const yaml = await readFile(path.join(root, "data/samples.yaml"), "utf8");
  const fasta = await readFile(path.join(root, "data/sequences.fasta"), "utf8");

  const meta = parse(yaml) as { id: string; name: string; virus: string; date: string | Date }[];
  const sequences = parseFasta(fasta);

  return meta.map((m) => ({
    id: m.id,
    name: m.name,
    virus: m.virus,
    date: formatDate(m.date),
    isoDate: toIsoDate(m.date),
    sequence: sequences.get(m.id) ?? "",
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

function parseFasta(text: string): Map<string, string> {
  const result = new Map<string, string>();
  let id: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(">")) {
      id = line.slice(1).trim().split(/\s+/)[0];
      result.set(id, "");
    } else if (id) {
      result.set(id, result.get(id) + line.trim().toUpperCase());
    }
  }
  return result;
}
