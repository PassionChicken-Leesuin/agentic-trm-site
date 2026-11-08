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

## Upload mode (agent server)

The static deployment replays a recorded IonQ session. To let visitors upload their own documents, build the site with the agent server address and run that server:

```bash
# in Code/ (research repo): python -m uvicorn viz.server:app --port 8765
NEXT_PUBLIC_API=http://127.0.0.1:8765 npx next build && npx next start -p 3011
```

Flow: Documents → company name + files (up to 500; sent in chunks of ≤ 40 files / 60 MB: `POST /api/v2/jobs/new` → `/jobs/<run>/files` → `/jobs/<run>/start`) → the Knowledge structures screen follows the job's events over SSE → when the job finishes (consolidation, cards, panel debate, roadmaps) the Cards and Roadmap screens read `/api/v2/runs/<run>/site/*.json`. Reopen a finished job with `/?job=<run>`. Without `NEXT_PUBLIC_API` the upload panel is shown disabled.
