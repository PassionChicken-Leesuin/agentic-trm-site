# agentic-trm-site

Agentic AI Technology Roadmapping — a research demo (SNU DDSI Lab, Suin Lee).

An agent reads a company's documents, decides passage by passage which of five knowledge structures each fact belongs to
(K1 evidence store, K2 theme summary tree, K3 opportunity linkage grid, K4 dependency graph, K5 temporal knowledge graph, plus a K0 glossary),
and builds a technology roadmap from the knowledge base it assembled. The site replays a recorded construction session (IonQ, 180 documents)
and shows the opportunity cards and the generated roadmap.

## Stack

- Next.js 16 (App Router) · Tailwind CSS v4 · D3 v7 · three.js / react-three-fiber
- Static deploy (Vercel). `NEXT_PUBLIC_API` points to the optional agent server (FastAPI, `viz.server` in the research repo) for upload mode.

## Data

`public/data/<run>/` is produced by `scripts/export_site.py` in the research repo (`Advanced-Agentic-TRM`):
`meta.json`, `events.jsonl` (recorded events), `cards.json`, `roadmaps.json`.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```
