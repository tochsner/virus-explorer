import { useState } from "react";
import type { Sample } from "@/lib/samples";
import { estimateDivergence, splitAtHeight, type TreeNode } from "@/lib/upgma";

const WIDTH = 1000;
const ROW_HEIGHT = 80;
const SUBTREE_GAP = 40;
const MARGIN = { left: 50, right: 260, top: 20, bottom: 70 };
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TICK_SPACING = 90;
const TICK_STEPS_DAYS = [1, 2, 3, 4, 5, 7, 10, 14, 21, 30];
const DOT_RADIUS = 8;
const DOT_STROKE_WIDTH = 2;
const AXIS_COLOR = "#80868e";

/** Nodes above this height (half the pairwise distance) are not joined into one tree. */
const HEIGHT_THRESHOLD = 0.25;

/** Colorblind-safe palette, one color per subtree. */
const COLORS = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9"];

type TooltipContent = { title: string; color: string; rows: { label: string; value: string }[] };
type Tooltip = TooltipContent & { x: number; y: number };
type ShowTooltip = (event: React.MouseEvent, content: TooltipContent) => void;
type RenderContext = {
  toX: (time: number) => number;
  showTooltip: ShowTooltip;
  hideTooltip: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  describe: (p: Placed) => TooltipContent;
  describeBranch: (parent: Placed, child: Placed) => TooltipContent;
  getSample: (id: string) => Sample | undefined;
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
  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const { ticks, endDay } = computeAxis(startDay, lastTip, innerWidth);
  const toX = (time: number) =>
    MARGIN.left + (innerWidth * (time - startDay)) / (endDay - startDay);

  const samplesById = new Map(samples.map((smp) => [smp.id, smp]));
  const context: RenderContext = {
    toX,
    showTooltip: (event, content) => {
      const rect = event.currentTarget.closest("svg")?.parentElement?.getBoundingClientRect();
      if (rect) setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, ...content });
    },
    hideTooltip: () => setTooltip(null),
    selectedId,
    onSelect,
    describe: (p) => describeNode(p, samplesById, viruses),
    describeBranch: (parent, child) => describeBranch(parent, child, samplesById),
    getSample: (id) => samplesById.get(id),
  };

  const height = bottomY + MARGIN.bottom;
  const axisY = height - MARGIN.bottom + 10;

  return (
    <div className="relative">
      <Legend
        subtrees={placed.map((p, i) => ({
          color: p.color,
          label: nameSubtree(p.node, i, viruses),
        }))}
      />
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        fill="none"
        strokeWidth={2}
      >
        {placed.map((p, i) => (
          <g key={i}>
            <line x1={toX(startDay)} x2={toX(p.time)} y1={p.y} y2={p.y} stroke={p.color} strokeDasharray="2 6" strokeLinecap="round" />
            {renderBranches(p, context)}
          </g>
        ))}
        {placed.map((p, i) => (
          <g key={i}>{renderNodes(p, context)}</g>
        ))}
        <g stroke={AXIS_COLOR} strokeWidth={1}>
          <line x1={toX(startDay)} x2={toX(endDay)} y1={axisY} y2={axisY} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={toX(t)} x2={toX(t)} y1={axisY} y2={axisY + 8} />
              <text
                x={toX(t)}
                y={axisY + 34}
                fill={AXIS_COLOR}
                stroke="none"
                fontSize={20}
                textAnchor="middle"
              >
                {formatTick(t)}
              </text>
            </g>
          ))}
        </g>
      </svg>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 min-w-48 max-w-72 rounded-xl bg-white p-3 text-sm shadow-[0_6px_24px_rgba(0,0,0,0.15)] ring-1 ring-black/5"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="mb-2 flex items-center gap-2 text-base font-semibold">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: tooltip.color }}
            />
            {tooltip.title}
          </div>
          <dl className="flex flex-col gap-1.5">
            {tooltip.rows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">{row.label}</dt>
                <dd className="text-neutral-900">{row.value}</dd>
              </div>
            ))}
          </dl>
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
  const swatchSize = 2 * (DOT_RADIUS + DOT_STROKE_WIDTH / 2);
  return (
    <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-[#f6f7f8] px-4 py-3 text-base shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <LegendItem label="Probenahme">
        <Swatch size={swatchSize} fill="#444" stroke="#444" round />
      </LegendItem>
      <LegendItem label="Übertragung">
        <Swatch size={swatchSize} fill="#fff" stroke="#444" round />
      </LegendItem>
      {subtrees.map(({ color, label }, i) => (
        <LegendItem key={i} label={label}>
          <Swatch size={swatchSize} fill={color} stroke={color} />
        </LegendItem>
      ))}
    </div>
  );
}

function LegendItem(props: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      {props.children}
      {props.label}
    </span>
  );
}

/** Draws a legend marker with the same radius and stroke as the dots in the tree. */
function Swatch(props: { size: number; fill: string; stroke: string; round?: boolean }) {
  const { size, fill, stroke, round } = props;
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {round ? (
        <circle cx={center} cy={center} r={DOT_RADIUS} fill={fill} stroke={stroke} strokeWidth={DOT_STROKE_WIDTH} />
      ) : (
        <rect
          x={DOT_STROKE_WIDTH / 2}
          y={DOT_STROKE_WIDTH / 2}
          width={2 * DOT_RADIUS}
          height={2 * DOT_RADIUS}
          rx={3}
          fill={fill}
          stroke={stroke}
          strokeWidth={DOT_STROKE_WIDTH}
        />
      )}
    </svg>
  );
}

function renderBranches(p: Placed, context: RenderContext): React.ReactNode {
  if (p.children.length === 0) return null;
  const { toX } = context;
  const ys = p.children.map((c) => c.y);
  return (
    <g stroke={p.color}>
      <line x1={toX(p.time)} x2={toX(p.time)} y1={Math.min(...ys)} y2={Math.max(...ys)} />
      {p.children.map((c, i) => {
        const hover = {
          onMouseEnter: (e: React.MouseEvent) => context.showTooltip(e, context.describeBranch(p, c)),
          onMouseMove: (e: React.MouseEvent) => context.showTooltip(e, context.describeBranch(p, c)),
          onMouseLeave: context.hideTooltip,
        };
        return (
          <g key={i}>
            <line x1={toX(p.time)} x2={toX(c.time)} y1={c.y} y2={c.y} />
            <line
              x1={toX(p.time)}
              x2={toX(c.time)}
              y1={c.y}
              y2={c.y}
              stroke="transparent"
              strokeWidth={16}
              {...hover}
            />
            {renderBranches(c, context)}
          </g>
        );
      })}
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
          <circle cx={x} cy={p.y} r={DOT_RADIUS + 7} fill={p.color} fillOpacity={0.3} stroke="none" />
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
        <text x={x + 16} y={p.y - 2} fill="#000" stroke="none" fontSize={20}>
          <tspan fontWeight={700}>{context.getSample(id)?.name}</tspan>
          <tspan x={x + 16} dy={22} fontSize={17} fill="#555">
            Probe vom {context.getSample(id)?.date}
          </tspan>
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

/** Builds the tooltip content of a node. */
function describeNode(
  p: Placed,
  samplesById: Map<string, Sample>,
  viruses: Record<string, string>,
): TooltipContent {
  if (p.children.length === 0) {
    const sample = samplesById.get(p.node.id ?? "");
    const virus = viruses[p.node.id ?? ""];
    return {
      title: sample?.name ?? "Unbekannt",
      color: p.color,
      rows: [
        { label: "Probe vom", value: sample?.date ?? "?" },
        ...(virus ? [{ label: "Virus", value: virus }] : []),
      ],
    };
  }

  // the earliest sampled person of the two clades is presumed to be the infector
  const [a, b] = p.children.map((c) => collectLeaves(c.node).sort((x, y) => x.time! - y.time!)[0]);
  const [infector, infected] = a.time! <= b.time! ? [a, b] : [b, a];
  const nameOf = (leaf: TreeNode) => samplesById.get(leaf.id ?? "")?.name ?? "Unbekannt";
  const similarity = Math.max(0, 1 - 2 * p.node.height);

  return {
    title: "Übertragung",
    color: p.color,
    rows: [
      { label: "Vermutlich", value: `${nameOf(infector)} hat ${nameOf(infected)} angesteckt` },
      { label: "Sequenzähnlichkeit", value: `${(100 * similarity).toFixed(0)} %` },
      { label: "Geschätzt am", value: formatDate(p.time) },
    ],
  };
}

/** Builds the tooltip content of the branch leading from a parent node to a child node. */
function describeBranch(
  parent: Placed,
  child: Placed,
  samplesById: Map<string, Sample>,
): TooltipContent {
  const leaves = collectLeaves(child.node);
  const meanLength =
    leaves.reduce((sum, leaf) => sum + (samplesById.get(leaf.id ?? "")?.sequence.length ?? 0), 0) /
    leaves.length;

  // each lineage carries half of the pairwise divergence at its merge point
  const perSite = (estimateDivergence(parent.node.height) - estimateDivergence(child.node.height)) / 2;
  const mutations = perSite * meanLength;
  const days = (child.time - parent.time) / DAY_MS;

  const target =
    child.children.length === 0
      ? (samplesById.get(child.node.id ?? "")?.name ?? "Unbekannt")
      : "einer Übertragung";

  return {
    title: `Ast zu ${target}`,
    color: parent.color,
    rows: [
      { label: "Erwartete Mutationen", value: `≈ ${formatCount(mutations)}` },
      { label: "Dauer", value: `${Math.round(days)} Tage` },
    ],
  };
}

function formatCount(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
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

/**
 * Computes evenly spaced ticks from the first day of the axis. The axis ends at the last
 * tick, which may lie after the latest sample.
 */
function computeAxis(startDay: number, lastTip: number, width: number) {
  const days = Math.max(1, Math.ceil((lastTip - startDay) / DAY_MS));
  const maxIntervals = Math.max(1, Math.floor(width / MIN_TICK_SPACING));
  const step = TICK_STEPS_DAYS.find((d) => days / d <= maxIntervals) ?? Math.ceil(days / maxIntervals);
  const intervals = Math.ceil(days / step);

  const ticks = Array.from({ length: intervals + 1 }, (_, i) => startDay + i * step * DAY_MS);
  return { ticks, endDay: ticks[ticks.length - 1] };
}

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function formatTick(time: number): string {
  const date = new Date(time);
  return `${date.getUTCDate()}. ${MONTHS[date.getUTCMonth()]}`;
}

function formatDate(time: number): string {
  const [year, month, day] = new Date(time).toISOString().slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}
