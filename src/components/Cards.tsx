"use client";

import { useState } from "react";
import Reveal from "./Reveal";

export type CardRow = { eid: string; name: string; relation: string; derivation: string; strength: number; pid?: string | null };
export type Card = {
  id: string; name: string; kind?: string; support?: number; links?: number; maturity?: string;
  markets: string[]; markets_inferred: string[]; offerings: string[];
  why: CardRow[]; what: CardRow[]; how: CardRow[]; resource: CardRow[];
  trend: { area: string | null; area_trend: string | null; theme: string; theme_trend: string; shares: { year: number; share: number }[]; summary: string; pids: string[] }[];
  timing: { subject: string; attribute: string; family: string; chain: { value: string; unit?: string | null; valid: number | null; stated: string; modality: string; status: string; fid: string; pid: string }[] }[];
  links_k4: { src: string; rel: string; dst: string; pid: string }[];
  evidence: Record<string, { text: string; doc_id: string; date: string; source_type: string; synthetic: boolean }>;
};

function Rows({ rows, label, layer }: { rows: CardRow[]; label: string; layer: string }) {
  if (!rows.length) return null;
  return (
    <div className="row" data-layer={layer}>
      <span className="lbl">{label}</span>
      <div>
        {rows.slice(0, 6).map((r) => (
          <span key={r.eid + r.relation} className="item">{r.name}<small> · {r.relation}{r.derivation === "derived" ? " · inferred" : ""}</small></span>
        ))}
      </div>
    </div>
  );
}

export default function Cards({ cards, onNext }: { cards: Card[]; onNext: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section>
      <Reveal>
        <div className="flex items-center gap-4"><p className="label">03 / 04 · Opportunity cards</p><span className="h-px w-16 bg-hairline" aria-hidden="true" /></div>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="display mt-6 text-[clamp(1.8rem,4.4vw,3rem)] leading-[1.15]">One card per opportunity, assembled from all five structures.</h1>
      </Reveal>
      <Reveal delay={160}>
        <p className="mt-5 max-w-2xl text-[0.95rem] leading-[1.85] text-body">
          Market and drivers come from the linkage grid and the theme tree; offerings carry their timing chains; capabilities and enablers bring
          the stated relations; every line points back to a source passage. The card mirrors the per-opportunity topic roadmap of a T-Plan workshop.
        </p>
      </Reveal>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {cards.map((c, i) => (
          <Reveal key={c.id} delay={200 + i * 70}>
            <article className="card" data-eid={c.id}>
              <div className="flex items-baseline gap-3">
                <h3>{c.name}</h3>
                <span className="label ml-auto">{c.kind?.replace("_", " ")} · {c.support} docs · {c.maturity}</span>
              </div>
              <p className="text-xs text-muted">
                markets: {c.markets.length ? c.markets.join(", ") : c.markets_inferred.length ? `${c.markets_inferred.join(", ")} (inferred)` : "unspecified"}
                {c.offerings.length ? ` · offerings: ${c.offerings.join(", ")}` : ""}
              </p>
              <Rows rows={c.why} label="why · drivers" layer="why" />
              {c.trend.slice(0, 1).map((t) => (
                <div className="row" data-layer="why" key={t.theme}>
                  <span className="lbl">trend</span>
                  <div className="text-xs leading-relaxed">
                    <span className="text-ink">{t.theme}</span> <small className="text-muted">({t.theme_trend}{t.area ? `, area ${t.area}` : ""}; doc share {t.shares.slice(-3).map((s) => `${s.year} ${Math.round(s.share * 100)}%`).join(", ")})</small>
                    <div className="text-muted">{t.summary.slice(0, 180)}{t.summary.length > 180 ? "…" : ""}</div>
                  </div>
                </div>
              ))}
              <Rows rows={c.what} label="what · offerings" layer="what" />
              {c.timing.slice(0, 3).map((t) => (
                <div className="row" data-layer="what" key={t.subject + t.attribute}>
                  <span className="lbl">timing</span>
                  <div className="chain text-xs">
                    <span className="text-ink">{t.subject}</span> · {t.attribute}: {t.chain.map((f, j) => (
                      <span key={f.fid}>{j > 0 ? " → " : ""}{f.value}{f.unit && !f.value.includes(f.unit) ? ` ${f.unit}` : ""}{f.valid != null ? ` @${f.valid.toFixed(1)}` : ""} <small className="text-muted">({f.stated.slice(0, 7)}, {f.modality}{f.status !== "new" ? `, ${f.status}` : ""})</small></span>
                    ))}
                  </div>
                </div>
              ))}
              <Rows rows={c.how} label="how · capabilities" layer="how" />
              <Rows rows={c.resource} label="resources" layer="resource" />
              {c.links_k4.length > 0 && (
                <div className="row" data-layer="how"><span className="lbl">links</span>
                  <div className="text-xs">{c.links_k4.slice(0, 4).map((l, j) => (<div key={j}>{l.src} <small className="text-muted">—{l.rel}→</small> {l.dst}</div>))}</div>
                </div>
              )}
              <div className="row"><span className="lbl">evidence</span>
                <div className="text-xs">
                  <button className="cursor-pointer text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setOpen(open === c.id ? null : c.id)}>
                    {Object.keys(c.evidence).length} source passages {open === c.id ? "▲" : "▼"}
                  </button>
                  {open === c.id && (
                    <ul className="mt-2 space-y-2">
                      {Object.entries(c.evidence).slice(0, 12).map(([pid, e]) => (
                        <li key={pid} className="border-l border-hairline pl-3 text-body"><span className="label mr-2">{e.date} · {e.source_type}{e.synthetic ? " · internal" : ""}</span>{e.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <div className="mt-10 flex items-center gap-4">
        <span className="h-px w-10 bg-hairline" aria-hidden="true" />
        <button className="btn" data-primary="true" onClick={onNext}>Let the agent build the roadmap →</button>
      </div>
    </section>
  );
}
