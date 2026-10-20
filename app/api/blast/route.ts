import { loadSamples } from "@/lib/samples";

const MIN_DELAY_S = 2;
const MAX_DELAY_S = 10;

/** Simulates a BLAST search: waits a random time, then returns the known virus of the sample. */
export async function POST(request: Request) {
  const { id } = (await request.json()) as { id: string };

  const sample = (await loadSamples()).find((s) => s.id === id);
  if (!sample) return Response.json({ error: "Unbekannte Sequenz" }, { status: 404 });

  const delay = MIN_DELAY_S + Math.random() * (MAX_DELAY_S - MIN_DELAY_S);
  console.log(`[blast] ${id}: simulating search for ${delay.toFixed(1)}s, result=${sample.virus}`);
  await new Promise((resolve) => setTimeout(resolve, delay * 1000));

  return Response.json({ result: sample.virus });
}
