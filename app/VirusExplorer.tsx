"use client";

import { useState } from "react";
import type { Sample } from "@/lib/samples";
import { buildUpgmaTree, type TreeNode } from "@/lib/upgma";
import Header from "./Header";
import Tree from "./Tree";

const SEQUENCE_PREVIEW_LENGTH = 400;
const TREE_DELAY_RANGE_S = { min: 2, max: 5 };
const ORANGE_STYLE = { background: "#f59e0b", color: "#3b2300" };
const BOX_CLASS = "rounded-lg bg-[#f6f7f8] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]";

type Tab = "blast" | "tree";
type BlastResult = { status: "running" | "done" | "error"; text: string };

export default function VirusExplorer({ samples }: { samples: Sample[] }) {
  const [tab, setTab] = useState<Tab>("blast");
  const [results, setResults] = useState<Record<string, BlastResult>>({});

  function setResult(id: string, result: BlastResult) {
    setResults((prev) => ({ ...prev, [id]: result }));
  }

  return (
    <>
      <Header tab={tab} onTabChange={setTab} />
      <main className="mx-auto max-w-5xl p-6">
      {/* both tabs stay mounted so their state survives switching */}
      <div hidden={tab !== "blast"}>
        <BlastTab samples={samples} results={results} setResult={setResult} />
      </div>
      <div hidden={tab !== "tree"}>
        <TreeTab samples={samples} results={results} />
      </div>
      </main>
    </>
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
          <li key={s.id} className={BOX_CLASS}>
            <SampleDetails
              sample={s}
              action={
                <BlastButton result={results[s.id]} onClick={() => blastSample(s, setResult)} />
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shows name, an optional action at the top right, pills for date, length, nucleic acid type and BLAST result, and a sequence preview. */
function SampleDetails(props: { sample: Sample; result?: BlastResult; action?: React.ReactNode }) {
  const { sample, result, action } = props;
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="text-lg font-bold">{sample.name}</div>
          <div className="flex flex-wrap gap-1.5">
            <Pill kind="date">{sample.date}</Pill>
            <Pill kind="length">{sample.sequence.length} Basen</Pill>
            <Pill kind="type">{detectNucleicAcid(sample.sequence)}</Pill>
            {result && <Pill kind="virus">{describeResult(result)}</Pill>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-3 line-clamp-2 break-all text-base">
        <ColoredSequence sequence={sample.sequence.slice(0, SEQUENCE_PREVIEW_LENGTH)} />
      </div>
    </>
  );
}

const PILL_COLORS = {
  date: { background: "#dbeafe", color: "#1e3a8a" },
  length: { background: "#fde7c7", color: "#7a4b00" },
  type: { background: "#d5f0e6", color: "#00573f" },
  virus: { background: "#f6dcea", color: "#7a2a55" },
};

/** Orange pill button that shows a spinner while running and the virus once the result is in. */
function BlastButton(props: { result?: BlastResult; onClick: () => void }) {
  const status = props.result?.status;
  const running = status === "running";
  const done = status === "done";
  const label = done ? props.result!.text : status === "error" ? "Fehler – erneut versuchen" : "BLAST";

  return (
    <button
      onClick={props.onClick}
      disabled={running || done}
      title={status === "error" ? props.result!.text : undefined}
      className={`inline-flex items-center rounded-full border-0 px-5 py-2 text-lg font-semibold transition-colors duration-300 enabled:hover:brightness-95 disabled:cursor-default ${running ? "pulse-soft" : ""}`}
      style={done ? { background: "#fde7c7", color: "#7a4b00" } : ORANGE_STYLE}
    >
      <ButtonSpinner visible={running} />
      <span key={label} className="fade-in">
        {label}
      </span>
    </button>
  );
}

/** Spinner that grows in from the left of a button label while visible. */
function ButtonSpinner({ visible }: { visible: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center overflow-hidden transition-all duration-300"
      style={{ width: visible ? 20 : 0, marginRight: visible ? 6 : 0, opacity: visible ? 1 : 0 }}
    >
      <span className="block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
    </span>
  );
}

function Pill(props: { kind: keyof typeof PILL_COLORS; children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-sm"
      style={PILL_COLORS[props.kind]}
    >
      {props.children}
    </span>
  );
}

function detectNucleicAcid(sequence: string): "RNA" | "DNA" {
  return sequence.includes("U") ? "RNA" : "DNA";
}

const BASE_COLORS: Record<string, string> = {
  A: "#009E73",
  C: "#0072B2",
  G: "#E69F00",
  T: "#CC79A7",
};
const OTHER_BASE_COLOR = "#888";

/** Renders a sequence with one color per nucleotide; hovering a base highlights it without moving the text. */
function ColoredSequence({ sequence }: { sequence: string }) {
  return (
    <>
      {Array.from(sequence, (base, i) => (
        <span
          key={i}
          title={`Position ${i + 1}`}
          className="hover:bg-black/15"
          style={{ color: BASE_COLORS[base] ?? OTHER_BASE_COLOR }}
        >
          {base}
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
  const [computing, setComputing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = samples.find((smp) => smp.id === selectedId);

  async function computeTree() {
    setComputing(true);
    const delay = TREE_DELAY_RANGE_S.min + Math.random() * (TREE_DELAY_RANGE_S.max - TREE_DELAY_RANGE_S.min);
    await new Promise((resolve) => setTimeout(resolve, delay * 1000));

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
        <div className="mb-4 flex justify-center">
          <button
            className={`inline-flex items-center rounded-full border-0 px-5 py-2 text-lg font-semibold transition-[filter] enabled:hover:brightness-95 disabled:cursor-progress ${computing ? "pulse-soft" : ""}`}
            style={ORANGE_STYLE}
            disabled={computing}
            onClick={computeTree}
          >
            <ButtonSpinner visible={computing} />
            Baum berechnen
          </button>
        </div>
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
            <aside className={BOX_CLASS}>
              <SampleDetails sample={selected} result={results[selected.id]} />
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
