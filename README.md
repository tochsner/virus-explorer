# 🦠 Virus-Explorer

A small teaching dashboard for learning phylogenetics, based on a hypothetical virus outbreak at a school. Each child's sample is a sequence in `public/sequences.fasta`; names and sampling dates live in `data/samples.yaml`.

## 🧰 Stack

- ⚡ Next.js 16 (App Router) with React 19 and the React Compiler
- 🎨 Tailwind CSS 4 and Rubik via `next/font`
- 🟦 TypeScript
- 📄 `yaml` for the sample metadata

## ✨ Features

- 🔬 **BLAST tab:** one box per sample with name, date, length, DNA/RNA, and a colored sequence preview. A BLAST button identifies the virus (simulated with a 2-10 s delay, the answers come from `data/samples.yaml`).
- 🌳 **Phylogenetic tree tab:** UPGMA on k-mer distances, drawn on a calendar axis with tips at their sampling dates.
  - 🔵 Colored subtrees, split at a distance threshold so different viruses don't share a root
  - 💬 Tooltips for tips, transmissions (who likely infected whom) and branches (expected mutations)
  - 👆 Click a tip to see its sequence details

## 🚀 Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).
