import { useState } from "react";
import type { Sample } from "@/lib/samples";
import { splitAtHeight, type TreeNode } from "@/lib/upgma";

const WIDTH = 1000;
const ROW_HEIGHT = 80;
const SUBTREE_GAP = 40;
const MARGIN = { left: 20, right: 260, top: 20, bottom: 60 };
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TICK_SPACING = 60;
const DOT_RADIUS = 8;

/** Nodes above this height (half the pairwise distance) are not joined into one tree. */
const HEIGHT_THRESHOLD = 0.25;

/** Colorblind-safe palette, one color per subtree. */
const COLORS = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9"];

type Tooltip = { x: number; y: number; lines: string[] };
type ShowTooltip = (event: React.MouseEvent, lines: string[]) => void;
type RenderContext = {
  toX: (time: number) => number;
  showTooltip: ShowTooltip;
  hideTooltip: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  describe: (p: Placed) => string[];
};

type Placed = { node: TreeNode; time: number; y: number; color: string; children: Placed[] };

/**
 * Draws UPGMA trees as horizontal dendrograms on a calendar axis.
 * Tips (sampling events) sit at their sampling dates. Internal nodes (infection events)
 * are placed before their earliest descendant tip; the largest root height is assumed
 * to span the whole sampling period. Each subtree is joined to the origin (left edge) by a stem.
 */
export default function Tree(props: {
  root: TreeNode;
  samples: Sample[];
  /** Virus per sample id, for samples that have been blasted. */
  viruses: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { root, samples, viruses, selectedId, onSelect } = props;
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const subtrees = splitAtHeight(root, HEIGHT_THRESHOLD);
  const leafTimes = collectLeafTimes(root);
  const firstTip = Math.min(...leafTimes);
  const lastTip = Math.max(...leafTimes);
  const maxRootHeight = Math.max(...subtrees.map((t) => t.height)) || 1;
  const msPerHeight = Math.max(lastTip - firstTip, DAY_MS) / maxRootHeight;

  const { placed, bottomY } = layoutSubtrees(subtrees, msPerHeight);

  const startDay = Math.floor(Math.min(...placed.map(minTime)) / DAY_MS - 1) * DAY_MS;
  const endDay = Math.ceil(lastTip / DAY_MS) * DAY_MS;
  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const toX = (time: number) =>
    MARGIN.left + (innerWidth * (time - startDay)) / (endDay - startDay);

  const samplesById = new Map(samples.map((smp) => [smp.id, smp]));
  const context: RenderContext = {
    toX,
    showTooltip: (event, lines) => {
      const rect = event.currentTarget.closest("svg")?.parentElement?.getBoundingClientRect();
      if (rect) setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, lines });
    },
    hideTooltip: () => setTooltip(null),
    selectedId,
    onSelect,
    describe: (p) => describeNode(p, samplesById, viruses),
  };

  const height = bottomY + MARGIN.bottom;
  const axisY = height - MARGIN.bottom + 10;
  const days = (endDay - startDay) / DAY_MS;
  const tickStep = Math.max(1, Math.ceil((MIN_TICK_SPACING * days) / innerWidth));
  const ticks: number[] = [];
  for (let t = startDay; t <= endDay; t += tickStep * DAY_MS) ticks.push(t);

  return (
    <div className="relative">
      <Legend
        subtrees={placed.map((p, i) => ({
          color: p.color,
          label: nameSubtree(p.node, i, viruses),
        }))}
      />
      <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" fill="none" strokeWidth={2}>
        {placed.map((p, i) => (
          <g key={i}>
            <line x1={toX(startDay)} x2={toX(p.time)} y1={p.y} y2={p.y} stroke={p.color} strokeDasharray="2 6" strokeLinecap="round" />
            {renderBranches(p, toX)}
          </g>
        ))}
        {placed.map((p, i) => (
          <g key={i}>{renderNodes(p, context)}</g>
        ))}
        <g stroke="#000" strokeWidth={1}>
          <line x1={toX(startDay)} x2={toX(endDay)} y1={axisY} y2={axisY} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={toX(t)} x2={toX(t)} y1={axisY} y2={axisY + 6} />
              <text x={toX(t)} y={axisY + 24} fill="#000" stroke="none" fontSize={14} textAnchor="middle">
                {formatTick(t)}
              </text>
            </g>
          ))}
          <text x={toX(endDay)} y={axisY + 46} fill="#000" stroke="none" fontSize={14} textAnchor="end">
            Datum (2026)
          </text>
        </g>
      </svg>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 border border-black bg-white p-2 text-sm"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          {tooltip.lines.map((line, i) => (
            <div key={i} className={i === 0 ? "font-bold" : ""}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function layoutSubtrees(subtrees: TreeNode[], msPerHeight: number) {
  let nextY = MARGIN.top;

  const place = (node: TreeNode, color: string): Placed => {
    const children = node.children.map((c) => place(c, color));
    let y: number;
    if (children.length === 0) {
      y = nextY + ROW_HEIGHT / 2;
      nextY += ROW_HEIGHT;
    } else {
      y = (children[0].y + children[children.length - 1].y) / 2;
    }
    const time = node.time ?? Math.min(...collectLeafTimes(node)) - node.height * msPerHeight;
    return { node, time, y, color, children };
  };

  const placed = subtrees.map((t, i) => {
    if (i > 0) nextY += SUBTREE_GAP;
    return place(t, COLORS[i % COLORS.length]);
  });
  return { placed, bottomY: nextY };
}

/** Names a subtree after the viruses of its blasted tips, or by its number if none was blasted. */
function nameSubtree(subtree: TreeNode, index: number, viruses: Record<string, string>): string {
  const names = new Set(
    collectLeaves(subtree)
      .map((leaf) => viruses[leaf.id ?? ""])
      .filter(Boolean),
  );
  return names.size > 0 ? [...names].join(" / ") : `Teilbaum ${index + 1}`;
}

function Legend({ subtrees }: { subtrees: { color: string; label: string }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <span>
        <Dot filled /> Probenahme
      </span>
      <span>
        <Dot /> Übertragung
      </span>
      {subtrees.map(({ color, label }, i) => (
        <span key={i}>
          <span style={{ color }}>■</span> {label}
        </span>
      ))}
    </div>
  );
}

function Dot({ filled = false }: { filled?: boolean }) {
  return (
    <span
      className="mr-1 inline-block rounded-full align-middle"
      style={{
        width: 12,
        height: 12,
        border: "2px solid #000",
        background: filled ? "#000" : "#fff",
      }}
    />
  );
}

function renderBranches(p: Placed, toX: (t: number) => number): React.ReactNode {
  if (p.children.length === 0) return null;
  const ys = p.children.map((c) => c.y);
  return (
    <g stroke={p.color}>
      <line x1={toX(p.time)} x2={toX(p.time)} y1={Math.min(...ys)} y2={Math.max(...ys)} />
      {p.children.map((c, i) => (
        <g key={i}>
          <line x1={toX(p.time)} x2={toX(c.time)} y1={c.y} y2={c.y} />
          {renderBranches(c, toX)}
        </g>
      ))}
    </g>
  );
}

function renderNodes(p: Placed, context: RenderContext): React.ReactNode {
  const x = context.toX(p.time);
  const hover = {
    onMouseEnter: (e: React.MouseEvent) => context.showTooltip(e, context.describe(p)),
    onMouseMove: (e: React.MouseEvent) => context.showTooltip(e, context.describe(p)),
    onMouseLeave: context.hideTooltip,
  };
  if (p.children.length === 0) {
    const id = p.node.id ?? "";
    return (
      <g>
        {id === context.selectedId && (
          <circle cx={x} cy={p.y} r={DOT_RADIUS + 5} stroke="#000" strokeWidth={1.5} />
        )}
        <circle
          cx={x}
          cy={p.y}
          r={DOT_RADIUS}
          fill={p.color}
          stroke={p.color}
          onClick={() => context.onSelect(id)}
          style={{ cursor: "pointer" }}
          {...hover}
        />
        <text x={x + 16} y={p.y + 6} fill="#000" stroke="none" fontSize={20}>
          {p.node.label}
        </text>
      </g>
    );
  }
  return (
    <g>
      <circle cx={x} cy={p.y} r={DOT_RADIUS} fill="#fff" stroke={p.color} {...hover} />
      {p.children.map((c, i) => (
        <g key={i}>{renderNodes(c, context)}</g>
      ))}
    </g>
  );
}

/** Builds the tooltip text of a node. */
function describeNode(
  p: Placed,
  samplesById: Map<string, Sample>,
  viruses: Record<string, string>,
): string[] {
  if (p.children.length === 0) {
    const sample = samplesById.get(p.node.id ?? "");
    const virus = viruses[p.node.id ?? ""];
    return [
      sample?.name ?? "Unbekannt",
      `Probe vom ${sample?.date ?? "?"}`,
      ...(virus ? [`Virus: ${virus}`] : []),
    ];
  }

  // the earliest sampled person of the two clades is presumed to be the infector
  const [a, b] = p.children.map((c) => collectLeaves(c.node).sort((x, y) => x.time! - y.time!)[0]);
  const [infector, infected] = a.time! <= b.time! ? [a, b] : [b, a];
  const nameOf = (leaf: TreeNode) => samplesById.get(leaf.id ?? "")?.name ?? "Unbekannt";
  const similarity = Math.max(0, 1 - 2 * p.node.height);

  return [
    "Übertragung",
    `${nameOf(infector)} hat vermutlich ${nameOf(infected)} angesteckt`,
    `Sequenzähnlichkeit: ${(100 * similarity).toFixed(0)} %`,
    `Geschätzt am ${formatDate(p.time)}`,
  ];
}

function collectLeaves(node: TreeNode): TreeNode[] {
  return node.children.length === 0 ? [node] : node.children.flatMap(collectLeaves);
}

function minTime(p: Placed): number {
  return Math.min(p.time, ...p.children.map(minTime));
}

function collectLeafTimes(node: TreeNode): number[] {
  return node.children.length === 0
    ? [node.time ?? 0]
    : node.children.flatMap(collectLeafTimes);
}

function formatTick(time: number): string {
  const [, month, day] = new Date(time).toISOString().slice(0, 10).split("-");
  return `${day}.${month}.`;
}

function formatDate(time: number): string {
  const [year, month, day] = new Date(time).toISOString().slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}
