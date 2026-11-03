"use client";

import { useMemo, useState } from "react";
import Reveal from "./Reveal";
import type { CardV2 } from "./RoadmapView";

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

export default function Cards({ cards, onNext }: { cards: CardV2[]; onNext: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | "application" | "product_type">("all");
  const sorted = useMemo(() => [...cards].filter((c) => kind === "all" || c.kind === kind).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind < b.kind ? -1 : 1)), [cards, kind]);
  const counts = useMemo(() => ({ all: cards.length, application: cards.filter((c) => c.kind === "application").length, product_type: cards.filter((c) => c.kind === "product_type").length }), [cards]);
  return (
    <section>
      <Reveal>
        <div className="flex items-center gap-4"><p className="label">03 / 04 · Opportunity cards</p><span className="h-px w-16 bg-hairline" aria-hidden="true" /></div>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="display mt-6 text-[clamp(1.8rem,4.4vw,3rem)] leading-[1.15]">One card per opportunity the documents describe — a topic roadmap each.</h1>
      </Reveal>
      <Reveal delay={160}>
        <p className="mt-5 max-w-2xl text-[0.95rem] leading-[1.85] text-body">
          A Cambridge roadmapping workshop writes one topic roadmap per priority opportunity: market, product and technology rows against a
          current-to-vision timeline, plus risks and actions. Here the agent assembles that page for every opportunity it found, from the
          structures it built: the company&rsquo;s own need and driver sentences (evidence store), documents per year for the card&rsquo;s themes
          (theme tree), capabilities and enablers it is linked to (relation graph), and every dated statement about its subjects, including
          revised targets (temporal graph). The cards are not ranked here. Which of them lead the roadmap is decided in the next step.
        </p>
      </Reveal>
      <Reveal delay={220}>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex border border-hairline">
            {(["all", "application", "product_type"] as const).map((k) => (
              <button key={k} className="label px-4 py-2 data-[on=true]:text-ink border-l border-hairline-soft first:border-l-0" data-on={kind === k} onClick={() => setKind(k)}>
                {k === "all" ? "all" : k === "application" ? "applications" : "product types"} · {counts[k]}
              </button>
            ))}
          </div>
          <span className="label ml-auto text-muted">docs = public + internal (i) · click a card for all lines and evidence</span>
        </div>
      </Reveal>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {sorted.map((c, i) => {
          const isOpen = open === c.eid;
          return (
            <Reveal key={c.eid} delay={Math.min(60 * (i % 8), 420)}>
              <article className="card" data-eid={c.eid}>
                <div className="flex items-baseline gap-3">
                  <h3>{c.name}</h3>
                  <span className="label ml-auto">{c.kind === "product_type" ? "product" : "application"} · {c.docs_public}+{c.docs_internal}i docs · {c.maturity}</span>
                </div>
                <p className="text-xs text-muted">{c.customers.length ? `markets: ${c.customers.slice(0, 3).join("; ")}` : "markets: unspecified"}</p>
                {LINES.map((L) => {
                  const lines = c.lines[L.key] || [];
                  if (!lines.length) return null;
                  const shown = isOpen ? lines : lines.slice(0, L.n);
                  return (
                    <div className="row" data-layer={L.layer} key={L.key}>
                      <span className="lbl">{L.label}</span>
                      <div className="text-xs leading-relaxed">
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
