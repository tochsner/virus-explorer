import { loadSamples } from "@/lib/samples";
import VirusExplorer from "./VirusExplorer";

export default async function Home() {
  const samples = await loadSamples();
  return <VirusExplorer samples={samples} />;
}
