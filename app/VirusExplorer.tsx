"use client";

import { useRef, useState } from "react";
import type { Sample } from "@/lib/samples";
import { buildUpgmaTree, type TreeNode } from "@/lib/upgma";
import Header from "./Header";
import Tree from "./Tree";

const TREE_DELAY_RANGE_S = { min: 2, max: 5 };
const ORANGE_STYLE = { background: "#f59e0b", color: "#3b2300" };
const BOX_CLASS = "rounded-lg bg-[#f6f7f8] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]";

type Tab = "blast" | "tree";
type BlastResult = { status: "running" | "done" | "error"; text: string };

export default function VirusExplorer({ samples }: { samples: Sample[] }) {
  const [tab, setTab] = useState<Tab>("blast");
  const [results] = useState<Record<string, BlastResult>>({});

  return (
    <>
      <Header tab={tab} onTabChange={setTab} />
      <main className="mx-auto max-w-5xl p-6">
      {/* both tabs stay mounted so their state survives switching */}
      <div hidden={tab !== "blast"}>
        <BlastTab samples={samples} results={results} />
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
}) {
  const { samples, results } = props;
  const highlightStyle = useRef<HTMLStyleElement>(null);
  const highlightedPosition = useRef<string | undefined>(undefined);

  // the highlight is a single generated css rule rather than react state, so hovering does not re-render every base
  function highlightPosition(position: string | undefined) {
    if (position === highlightedPosition.current || !highlightStyle.current) return;
    highlightedPosition.current = position;
    highlightStyle.current.textContent = position
      ? `.sequence-base[data-position="${position}"] { background: var(--base-color); box-shadow: 0 0 0 1px var(--base-color); color: #fff !important; }`
      : "";
  }

  return (
    <section>
      <style ref={highlightStyle} />
      <ul
        className="flex flex-col gap-3"
        onMouseOver={(e) => {
          const position = (e.target as HTMLElement).dataset?.position;
          if (position !== undefined || (e.target as HTMLElement).closest(".sequence-box")) {
            highlightPosition(position && /^\d+$/.test(position) ? position : undefined);
          }
        }}
        onMouseLeave={() => highlightPosition(undefined)}
      >
        {samples.map((s) => (
          <li key={s.id} className={BOX_CLASS}>
            <SampleDetails
              sample={s}
              result={results[s.id]}
              action={<CopyButton sequence={s.sequence} />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shows name, an optional action at the top right, pills for date, length, nucleic acid type and BLAST result, and the scrollable full sequence. */
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
      <div className="sequence-box mt-3 h-[4.5rem] cursor-crosshair font-mono overflow-y-auto break-all text-base leading-6">
        <ColoredSequence sequence={sample.sequence} />
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

/** Icon button that copies the full sequence to the clipboard. */
function CopyButton({ sequence }: { sequence: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(sequence)}
      title="Sequenz kopieren"
      aria-label="Sequenz kopieren"
      className="inline-flex items-center rounded-full border-0 p-2 transition-colors duration-300 hover:brightness-95"
      style={ORANGE_STYLE}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="size-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
        />
      </svg>
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

function baseColor(base: string): string {
  return BASE_COLORS[base] ?? OTHER_BASE_COLOR;
}

/** Renders a sequence with one color per nucleotide; hovering a base highlights it without moving the text. */
function ColoredSequence({ sequence }: { sequence: string }) {
  return (
    <>
      {Array.from(sequence, (base, i) => (
        <span
          key={i}
          data-position={i + 1}
          title={`Position ${i + 1}`}
          className="sequence-base rounded-[2px]"
          style={{ color: baseColor(base), "--base-color": baseColor(base) } as React.CSSProperties}
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
        <div className="mb-4 mt-12 flex justify-center">
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
