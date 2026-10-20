"use client";

import { useState } from "react";
import type { Sample } from "@/lib/samples";
import { buildUpgmaTree, type TreeNode } from "@/lib/upgma";
import Tree from "./Tree";


const SEQUENCE_PREVIEW_LENGTH = 1000;

type Tab = "blast" | "tree";
type BlastResult = { status: "running" | "done" | "error"; text: string };

export default function VirusExplorer({ samples }: { samples: Sample[] }) {
  const [tab, setTab] = useState<Tab>("blast");
  const [results, setResults] = useState<Record<string, BlastResult>>({});

  function setResult(id: string, result: BlastResult) {
    setResults((prev) => ({ ...prev, [id]: result }));
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Virus-Explorer</h1>
      <nav className="mb-6 flex gap-2">
        <TabButton active={tab === "blast"} onClick={() => setTab("blast")}>
          BLAST
        </TabButton>
        <TabButton active={tab === "tree"} onClick={() => setTab("tree")}>
          Phylogenetischer Baum
        </TabButton>
      </nav>
      {/* both tabs stay mounted so their state survives switching */}
      <div hidden={tab !== "blast"}>
        <BlastTab samples={samples} results={results} setResult={setResult} />
      </div>
      <div hidden={tab !== "tree"}>
        <TreeTab samples={samples} results={results} />
      </div>
    </main>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      style={{ borderWidth: props.active ? "2px" : "1px", fontWeight: props.active ? 700 : 400 }}
    >
      {props.children}
    </button>
  );
}

function BlastTab(props: {
  samples: Sample[];
  results: Record<string, BlastResult>;
  setResult: SetResult;
}) {
  const { samples, results, setResult } = props;

  return (
    <section>
      <ul className="flex flex-col gap-3">
        {samples.map((s) => (
          <li key={s.id} className="border border-black p-4">
            <SampleDetails sample={s} />
            <button className="mt-2" onClick={() => blastSample(s, setResult)}>
              BLAST
            </button>
            {results[s.id] && <div className="mt-2">{describeResult(results[s.id])}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shows name, date, length and a sequence preview of a sample. */
function SampleDetails({ sample }: { sample: Sample }) {
  return (
    <>
      <div className="font-bold">
        {sample.name} · {sample.date}
      </div>
      <div>{sample.sequence.length} Basen</div>
      <div
        className="mt-2 line-clamp-4 break-all text-sm"
        style={{ fontFamily: "var(--font-sequence), monospace" }}
      >
        <ColoredSequence sequence={sample.sequence.slice(0, SEQUENCE_PREVIEW_LENGTH)} />
      </div>
    </>
  );
}

const BASE_COLORS: Record<string, string> = {
  A: "#009E73",
  C: "#0072B2",
  G: "#E69F00",
  T: "#CC79A7",
};
const OTHER_BASE_COLOR = "#888";

/** Renders a sequence with one color per nucleotide, grouping runs of equal bases into one span. */
function ColoredSequence({ sequence }: { sequence: string }) {
  const runs = sequence.match(/(.)\1*/g) ?? [];
  return (
    <>
      {runs.map((run, i) => (
        <span key={i} style={{ color: BASE_COLORS[run[0]] ?? OTHER_BASE_COLOR }}>
          {run}
        </span>
      ))}
    </>
  );
}

function describeResult(result: BlastResult): string {
  if (result.status === "running") return "läuft…";
  return result.status === "done" ? `Virus: ${result.text}` : result.text;
}

type SetResult = (id: string, result: BlastResult) => void;

async function blastSample(sample: Sample, setResult: SetResult) {
  setResult(sample.id, { status: "running", text: "" });
  try {
    const response = await fetch("/api/blast", {
      method: "POST",
      body: JSON.stringify({ id: sample.id }),
    });
    const { result, error } = await response.json();
    if (error) throw new Error(error);
    setResult(sample.id, { status: "done", text: result });
  } catch (e) {
    setResult(sample.id, { status: "error", text: `Fehler: ${(e as Error).message}` });
  }
}

function TreeTab(props: { samples: Sample[]; results: Record<string, BlastResult> }) {
  const { samples, results } = props;
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = samples.find((smp) => smp.id === selectedId);

  function computeTree() {
    setTree(
      buildUpgmaTree(
        samples.map((s) => ({
          id: s.id,
          label: `${s.name} (${s.date})`,
          time: Date.parse(s.isoDate),
          sequence: s.sequence,
        })),
      ),
    );
  }

  return (
    <section>
      {!tree && (
        <button className="mb-4" onClick={computeTree}>
          Baum berechnen
        </button>
      )}
      {tree && (
        <div className="flex flex-col gap-6">
          <div className="min-w-0">
            <Tree
              root={tree}
              samples={samples}
              viruses={getBlastedViruses(results)}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          {selected && (
            <aside className="border border-black p-4">
              <SampleDetails sample={selected} />
              {results[selected.id]?.status === "done" && (
                <div className="mt-2">{describeResult(results[selected.id])}</div>
              )}
            </aside>
          )}
        </div>
      )}
    </section>
  );
}

function getBlastedViruses(results: Record<string, BlastResult>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(results)
      .filter(([, r]) => r.status === "done")
      .map(([id, r]) => [id, r.text]),
  );
}
