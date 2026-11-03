"use client";

import { useMemo, useState } from "react";
import Reveal from "./Reveal";
import type { CardV2 } from "./RoadmapView";

export type Candidates = {
  passages_routed: number; records: number; subjects: number; kept: number;
  list: { eid: string; name: string; kind: string; records: number; docs: number; customers: string[]; kept: boolean; reason: string }[];
};

const LINES: { key: string; label: string; layer: string; n: number }[] = [
  { key: "state", label: "now", layer: "what", n: 2 },
  { key: "why", label: "why · needs & drivers", layer: "why", n: 3 },
  { key: "trend", label: "trend · documents per year", layer: "why", n: 1 },
  { key: "what", label: "what · offerings", layer: "what", n: 3 },
  { key: "when", label: "when · dated statements", layer: "what", n: 3 },
  { key: "how", label: "how · capabilities", layer: "how", n: 3 },
  { key: "resource", label: "resources · enablers", layer: "resource", n: 3 },
  { key: "actors", label: "actors", layer: "resource", n: 2 },
  { key: "issue", label: "issues · risks, barriers, open questions", layer: "resource", n: 2 },
];

/** 한 줄의 근거 id 꼬리([ps_..., tf_...])를 떼고, 'internal' 표시를 남긴다. */
function clean(ln: string) {
  return ln.replace(/\s*\[(ps|tf)_[0-9a-f]+(,\s*(ps|tf)_[0-9a-f]+)*\]/g, "").replace(/\s*\(in \d+ cards\)/g, "");
}

export default function Cards({ cards, candidates, onNext }: { cards: CardV2[]; candidates: Candidates | null; onNext: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | "application" | "product_type">("all");
  const [showExcluded, setShowExcluded] = useState(false);
  const sorted = useMemo(() => [...cards].filter((c) => kind === "all" || c.kind === kind).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind < b.kind ? -1 : 1)), [cards, kind]);
  const counts = useMemo(() => ({ all: cards.length, application: cards.filter((c) => c.kind === "application").length, product_type: cards.filter((c) => c.kind === "product_type").length }), [cards]);
  const kept = candidates?.list.filter((c) => c.kept) ?? [];
  const excluded = candidates?.list.filter((c) => !c.kept) ?? [];
  return (
    <section>
      <Reveal>
        <div className="flex items-center gap-4"><p className="label">03 / 04 · Opportunity cards</p><span className="h-px w-16 bg-hairline" aria-hidden="true" /></div>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="display mt-6 text-[clamp(1.8rem,4.4vw,3rem)] leading-[1.15]">From opportunity candidates to one card per opportunity.</h1>
      </Reveal>
      <Reveal delay={160}>
        <p className="mt-5 max-w-2xl text-[0.95rem] leading-[1.85] text-body">
          The structures say what the company knows, not which of it is an opportunity. That judgement is made while reading: whenever a passage
          names an application area or a product type for a market, the Router sends it to the opportunity extractor, which writes a candidate
          record (the opportunity, its market or customer, the offering, drivers, needs, maturity). After reading, generic names, organizations,
          technologies and concrete products are removed from the candidates. Each remaining candidate becomes a card: the topic roadmap a
          Cambridge workshop would write for it, filled from the four structures.
        </p>
      </Reveal>

      {candidates && (
        <Reveal delay={220}>
          <div className="mt-8 border border-hairline p-5">
            <p className="label">Step 1 · Candidates extracted while reading</p>
            <div className="mt-3 grid gap-4 md:grid-cols-4">
              {[
                ["passages routed to the opportunity extractor", candidates.passages_routed],
                ["candidate records written", candidates.records],
                ["distinct candidates", candidates.subjects],
                ["kept as cards", candidates.kept],
              ].map(([k, v]) => (
                <div key={String(k)}><p className="display text-2xl">{v}</p><p className="label mt-1 text-muted">{k}</p></div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {kept.slice(0, 60).map((c) => (
                <span key={c.eid} className="text-body">{c.name} <span className="text-muted">· {c.kind === "product_type" ? "product type" : "application"} · {c.records} rec · {c.docs} docs</span></span>
              ))}
            </div>
            <button className="label mt-4 cursor-pointer text-muted hover:text-ink" onClick={() => setShowExcluded(!showExcluded)}>
              {excluded.length} excluded {showExcluded ? "▲" : "▼"}
            </button>
            {showExcluded && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {excluded.map((c) => (<span key={c.eid} className="text-muted line-through decoration-hairline">{c.name} <span className="no-underline">· {c.reason}</span></span>))}
              </div>
            )}
          </div>
        </Reveal>
      )}

      <Reveal delay={280}>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <p className="label">Step 2 · One card per candidate, from the four structures</p>
          <div className="ml-auto flex border border-hairline">
            {(["all", "application", "product_type"] as const).map((k) => (
              <button key={k} className="label px-4 py-2 data-[on=true]:text-ink border-l border-hairline-soft first:border-l-0" data-on={kind === k} onClick={() => setKind(k)}>
                {k === "all" ? "all" : k === "application" ? "applications" : "product types"} · {counts[k]}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Every card has the same nine lines; a line reads &ldquo;none stated in the documents&rdquo; when the company&rsquo;s documents say nothing. The cards are not ranked here.
          docs = public + internal (i). Click a card for every line with its source ids.
        </p>
      </Reveal>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {sorted.map((c, i) => {
          const isOpen = open === c.eid;
          return (
            <Reveal key={c.eid} delay={Math.min(60 * (i % 8), 420)}>
              <article className="card" data-eid={c.eid}>
                <div className="flex items-baseline gap-3">
                  <h3>{c.name}</h3>
                  <span className="label ml-auto">{c.kind === "product_type" ? "product type" : "application"} · {c.docs_public}+{c.docs_internal}i docs · {c.maturity}</span>
                </div>
                <p className="text-xs text-muted">{c.customers.length ? `markets: ${c.customers.slice(0, 3).join("; ")}` : "markets: none stated"}</p>
                {LINES.map((L) => {
                  const lines = c.lines[L.key] || [];
                  const shown = isOpen ? lines : lines.slice(0, L.n);
                  return (
                    <div className="row" data-layer={L.layer} key={L.key}>
                      <span className="lbl">{L.label}</span>
                      <div className="text-xs leading-relaxed">
                        {lines.length === 0 && <div className="text-muted">none stated in the documents</div>}
                        {shown.map((ln, j) => (<div key={j} className="text-body">{isOpen ? ln : clean(ln).slice(0, 200) + (clean(ln).length > 200 ? "…" : "")}</div>))}
                        {!isOpen && lines.length > L.n && <div className="text-muted">+{lines.length - L.n} more</div>}
                      </div>
                    </div>
                  );
                })}
                <div className="row"><span className="lbl">evidence</span>
                  <div className="text-xs">
                    <button className="cursor-pointer text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setOpen(isOpen ? null : c.eid)}>
                      {isOpen ? "show less ▲" : "show every line with its source ids ▼"}
                    </button>
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
      <div className="mt-10 flex items-center gap-4">
        <span className="h-px w-10 bg-hairline" aria-hidden="true" />
        <button className="btn" data-primary="true" onClick={onNext}>Let the models choose and the agent build the roadmap →</button>
      </div>
    </section>
  );
}
