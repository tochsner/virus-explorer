export type TreeNode = {
  /** Sample id of a leaf. */
  id?: string;
  label?: string;
  /** Sampling time of a leaf in ms since epoch. */
  time?: number;
  height: number;
  children: TreeNode[];
};

const KMER_SIZE = 12;

/** Builds an UPGMA tree from named sequences using k-mer based distances. */
export function buildUpgmaTree(
  items: { id: string; label: string; time: number; sequence: string }[],
): TreeNode {
  const distances = computeDistanceMatrix(items.map((i) => i.sequence));
  const root = runUpgma(
    items.map((i) => i.id),
    distances,
  );
  decorateLeaves(root, new Map(items.map((i) => [i.id, i])));
  return root;
}

function decorateLeaves(node: TreeNode, items: Map<string, { label: string; time: number }>) {
  if (node.children.length === 0) {
    const item = items.get(node.label ?? "");
    node.id = node.label;
    node.label = item?.label;
    node.time = item?.time;
  }
  node.children.forEach((c) => decorateLeaves(c, items));
}

function computeDistanceMatrix(sequences: string[]): number[][] {
  const kmerSets = sequences.map(extractKmers);
  return kmerSets.map((a) => kmerSets.map((b) => 1 - computeJaccard(a, b)));
}

function extractKmers(sequence: string): Set<string> {
  const kmers = new Set<string>();
  for (let i = 0; i + KMER_SIZE <= sequence.length; i++) {
    const kmer = sequence.slice(i, i + KMER_SIZE);
    if (/^[ACGT]+$/.test(kmer)) kmers.add(kmer);
  }
  return kmers;
}

function computeJaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const kmer of a) if (b.has(kmer)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * Estimates substitutions per site between two sequences that merge at the given node height.
 * Uses the Mash distance derived from the k-mer Jaccard index.
 */
export function estimateDivergence(height: number): number {
  if (height <= 0) return 0;
  const jaccard = Math.max(1 - 2 * height, 1e-9);
  return -Math.log((2 * jaccard) / (1 + jaccard)) / KMER_SIZE;
}

/** Cuts the tree at a node height, returning the separate subtrees below the cut. */
export function splitAtHeight(node: TreeNode, maxHeight: number): TreeNode[] {
  return node.height <= maxHeight
    ? [node]
    : node.children.flatMap((c) => splitAtHeight(c, maxHeight));
}

/** Runs UPGMA (average linkage) on a symmetric distance matrix. */
export function runUpgma(labels: string[], distances: number[][]): TreeNode {
  type Cluster = { node: TreeNode; size: number };
  const clusters: Cluster[] = labels.map((label) => ({
    node: { label, height: 0, children: [] },
    size: 1,
  }));
  let d = distances.map((row) => [...row]);

  while (clusters.length > 1) {
    // find the closest pair
    let bi = 0;
    let bj = 1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (d[i][j] < d[bi][bj]) {
          bi = i;
          bj = j;
        }
      }
    }

    const a = clusters[bi];
    const b = clusters[bj];
    const merged: Cluster = {
      node: { height: d[bi][bj] / 2, children: [a.node, b.node] },
      size: a.size + b.size,
    };

    // distance to the merged cluster is the size-weighted average
    const keep = clusters.map((_, k) => k).filter((k) => k !== bi && k !== bj);
    const row = keep.map((k) => (d[bi][k] * a.size + d[bj][k] * b.size) / merged.size);
    const next = keep.map((r) => keep.map((c) => d[r][c]));
    next.forEach((r, idx) => r.push(row[idx]));
    next.push([...row, 0]);

    d = next;
    const remaining = keep.map((k) => clusters[k]);
    remaining.push(merged);
    clusters.splice(0, clusters.length, ...remaining);
  }

  return clusters[0].node;
}
