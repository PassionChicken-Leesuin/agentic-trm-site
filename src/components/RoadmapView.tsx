"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import Reveal from "./Reveal";
import { stepIndex } from "./views";

export type RmNode = { id: string; label: string; layer: "why" | "what" | "how" | "resource"; start?: number | null; end?: number | null; description?: string; evidence_ids?: string[]; flags?: string[] };
export type ProvStep = { id: string; card: { eid: string; name: string; selected: boolean } | null; line: string | null; line_name: string | null; structure: string; detail: string;
  source: { text: string; date: string; type: string; synthetic: boolean; doc_id: string } | null };
export type Roadmap = { condition: string; model: string; horizon: [number, number]; nodes: RmNode[]; edges: { src: string; dst: string; type: string }[]; provenance?: Record<string, ProvStep[]> };
export type Evidence = Record<string, { text: string; doc_id: string; date: string; source_type: string; synthetic: boolean }>;
export type Roadmaps = { initial?: Roadmap; kb?: Roadmap; balanced?: Roadmap; q1?: Roadmap; q2?: Roadmap; q3?: Roadmap; evidence?: Evidence };
export type StanceKey = "balanced" | "q1" | "q2" | "q3";
export type Selection = {
  questions: Record<"q1" | "q2" | "q3", string>;
  stances: Record<StanceKey, { label: string; desc: string; order: string[]; selected: string[];
    profiles: Record<string, { q1: number; q2: number; q3: number; rank: number; sd: number[]; reasons: Record<string, Record<string, string>>; replies: Record<string, string[]> }> }>;
};
export type CardV2 = { eid: string; name: string; kind: string; customers: string[]; maturity: string; docs_public: number; docs_internal: number; lines: Record<string, string[]>; digest: string };

const LAYERS: RmNode["layer"][] = ["why", "what", "how", "resource"];
const LABEL: Record<string, string> = { why: "Why · market & drivers", what: "What · products & milestones", how: "How · technologies", resource: "Resources · enablers" };
const STANCE_ORDER: StanceKey[] = ["balanced", "q1", "q2", "q3"];
const STANCE_SHORT: Record<StanceKey, string> = { balanced: "All three equally", q1: "Why go — strongest demand", q2: "Where we are — strongest position", q3: "Can we get there — clearest path" };

/** 근거 하나(id)당 한 묶음: 그 id 가 들어 있던 카드들 + 지식 구조 + 원문 (같은 원문을 반복하지 않음) */
function groupProv(steps: ProvStep[]) {
  const m = new Map<string, { id: string; cards: { name: string; line: string; selected: boolean }[]; structure: string; detail: string; source: ProvStep["source"] }>();
  steps.forEach((st) => {
    let g = m.get(st.id);
    if (!g) { g = { id: st.id, cards: [], structure: st.structure, detail: st.detail, source: st.source }; m.set(st.id, g); }
    if (st.card && !g.cards.some((c) => c.name === st.card!.name)) g.cards.push({ name: st.card.name, line: st.line_name || "", selected: st.card.selected });
  });
  return [...m.values()];
}

const FLAG: Record<string, [string, string]> = { revised: ["↻", "var(--resource)"], conflict: ["!", "var(--conflict)"], infeasible: ["✕", "var(--muted)"] };

function Chart({ rm, onSelect, selected, evidence }: { rm: Roadmap; onSelect: (n: RmNode | null) => void; selected: RmNode | null; evidence: Evidence }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = d3.select(ref.current!); svg.selectAll("*").remove();
    const W = ref.current!.clientWidth || 900, left = 150, top = 24;
    const [h0, h1] = rm.horizon || [2025, 2030];
    const x = d3.scaleLinear().domain([h0, h1 + 1]).range([left, W - 20]);
    const byLayer = new Map(LAYERS.map((l) => [l, rm.nodes.filter((n) => n.layer === l)]));
    const rowH = 30, laneGap = 18;
    let y = top; const laneY = new Map<string, number>(); const posOf = new Map<string, { x: number; y: number; w: number }>();
    LAYERS.forEach((l) => {
      const ns = byLayer.get(l)!.sort((a, b) => (a.start ?? h0) - (b.start ?? h0));
      laneY.set(l, y);
      const lanes: number[] = [];
      ns.forEach((n) => {
        const s = Math.max(h0, n.start ?? h0), e = Math.min(h1 + 1, Math.max(s + 0.6, n.end ?? s + 1));
        let k = lanes.findIndex((end) => end <= x(s) + 2); if (k < 0) { k = lanes.length; lanes.push(0); }
        lanes[k] = x(e);
        posOf.set(n.id, { x: x(s), y: y + k * rowH, w: Math.max(40, x(e) - x(s) - 4) });
      });
      y += Math.max(1, lanes.length) * rowH + laneGap;
    });
    svg.attr("height", y + 30);
    LAYERS.forEach((l) => { const ly = laneY.get(l)!; svg.append("line").attr("class", "rm-lane").attr("x1", 0).attr("x2", W).attr("y1", ly - 8).attr("y2", ly - 8); svg.append("text").attr("x", 0).attr("y", ly + 12).attr("class", "label").attr("font-size", 10).attr("fill", `var(--${l})`).text(LABEL[l]); });
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${y})`).call(d3.axisBottom(x).tickValues(d3.range(h0, h1 + 1, 1)).tickFormat(d3.format("d")) as never);
    rm.edges.forEach((e) => { const a = posOf.get(e.src), b = posOf.get(e.dst); if (!a || !b) return; svg.append("path").attr("class", "rm-edge").attr("data-type", e.type).attr("d", `M${a.x + a.w / 2},${a.y + 22} C${a.x + a.w / 2},${(a.y + b.y) / 2 + 11} ${b.x + b.w / 2},${(a.y + b.y) / 2 + 11} ${b.x + b.w / 2},${b.y}`); });
    const g = svg.append("g").selectAll("g").data(rm.nodes).join("g").attr("class", (n) => "rm-node" + (selected?.id === n.id ? " selected" : "")).attr("data-layer", (n) => n.layer).attr("data-evidence", (n) => (n.evidence_ids?.length ? 1 : 0))
      .attr("transform", (n) => { const p = posOf.get(n.id)!; return `translate(${p.x},${p.y})`; }).style("cursor", "pointer").on("click", (_, n) => onSelect(n));
    g.append("rect").attr("width", (n) => posOf.get(n.id)!.w).attr("height", 22).attr("rx", 0);
    g.append("text").attr("x", 6).attr("y", 14.5).text((n) => { const w = posOf.get(n.id)!.w; return n.label.length > w / 6 ? n.label.slice(0, Math.max(4, w / 6 - 1)) + "…" : n.label; });
    g.append("title").text((n) => `${n.label}\n${n.start ?? ""}–${n.end ?? ""}\n${n.description || ""}\nevidence: ${(n.evidence_ids || []).length}${n.flags?.length ? "\nflags: " + n.flags.join(", ") : ""}`);
    // 플래그 기호 (막대 오른쪽 끝)와 내부 문서 근거만 있는 항목의 점 (막대 왼쪽)
    g.each(function (n) {
      const w = posOf.get(n.id)!.w, sel = d3.select(this);
      (n.flags || []).filter((f) => FLAG[f]).forEach((f, i) => sel.append("text").attr("class", "rm-flag").attr("x", w - 8 - i * 12).attr("y", 15.5).attr("text-anchor", "middle").style("fill", FLAG[f][1]).text(FLAG[f][0]));
      const ids = n.evidence_ids || [];
      if (ids.length && ids.every((id) => evidence[id]?.synthetic)) sel.append("circle").attr("class", "rm-internal").attr("cx", -5).attr("cy", 11).attr("r", 3);
    });
  }, [rm, selected, onSelect, evidence]);
  return <svg ref={ref} className="w-full" />;
}

/** 04. 관점 선택 → 선정된 기회 카드 10장 → 그 카드로 만든 로드맵. v2 데이터가 없으면 v1(kb/initial) 로 내려간다. */
export default function RoadmapView({ data, v2, selection, cards, serverOk }: { data: Roadmaps | null; v2: Roadmaps | null; selection: Selection | null; cards: CardV2[]; serverOk: boolean }) {
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const qs = q?.get("stance");
  const [phase, setPhase] = useState<"idle" | "working" | "done">(q?.get("auto") === "1" ? "done" : "idle");   // 시연·캡처용 ?auto=1&stance=q1
  const [stance, setStance] = useState<StanceKey>(qs === "q1" || qs === "q2" || qs === "q3" ? qs : "balanced");
  const [compare, setCompare] = useState<"stance" | "initial">("stance");
  const [sel, setSel] = useState<RmNode | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const hasV2 = !!(v2 && selection && v2[stance]);
  const rm = compare === "initial" ? (data?.initial ?? null) : hasV2 ? v2![stance]! : (data?.kb ?? null);
  const evidence: Evidence = { ...(data?.evidence || {}), ...(v2?.evidence || {}) };
  const cardOf = useMemo(() => new Map(cards.map((c) => [c.eid, c])), [cards]);
  const st = selection?.stances[stance];
  const stats = useMemo(() => {
    if (!rm) return null;
    const n = rm.nodes.length, ev = rm.nodes.filter((x) => x.evidence_ids?.length).length;
    return { n, ev, edges: rm.edges.length, byLayer: LAYERS.map((l) => [l, rm.nodes.filter((x) => x.layer === l).length] as const) };
  }, [rm]);

  const build = () => { setPhase("working"); setSel(null); setTimeout(() => setPhase("done"), serverOk ? 400 : 1600); };
  const pick = (k: StanceKey) => { setStance(k); setSel(null); setOpenCard(null); if (phase === "done") { setPhase("working"); setTimeout(() => setPhase("done"), 900); } };

  return (
    <section>
      <Reveal>
        <div className="flex items-center gap-4"><p className="label">{stepIndex("roadmap")} · Roadmap</p><span className="h-px w-16 bg-hairline" aria-hidden="true" /></div>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="display mt-6 text-[clamp(1.8rem,4.4vw,3rem)] leading-[1.15]">The selected cards, and the roadmap written from them.</h1>
      </Reveal>
      <Reveal delay={160}>
        <p className="mt-5 max-w-2xl text-[0.95rem] leading-[1.85] text-body">
          The debate gave every card three scores: why go, where we are, can we get there. You decide which answer should lead; the ten cards
          that come out on top under that stance are listed below. The generator reads those ten cards plus the landscape and writes the roadmap
          from them — with the same instructions, output schema and model as a generator that has no knowledge base at all.
        </p>
      </Reveal>

      {selection && (
        <Reveal delay={240}>
          <div className="mt-8">
            <p className="label">Which opportunities should lead the roadmap?</p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {STANCE_ORDER.map((k) => (
                <button key={k} onClick={() => pick(k)} data-on={stance === k}
                  className="border border-hairline p-4 text-left transition data-[on=true]:border-ink data-[on=true]:bg-[color-mix(in_oklab,var(--surface-card)_92%,transparent)]">
                  <p className="label" style={{ color: stance === k ? "var(--ink)" : undefined }}>{STANCE_SHORT[k]}</p>
                  <p className="mt-2 text-xs leading-relaxed text-body">{selection.stances[k]?.desc}</p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Q1 · {selection.questions.q1} &nbsp; Q2 · {selection.questions.q2} &nbsp; Q3 · {selection.questions.q3}
            </p>
          </div>
        </Reveal>
      )}

      {st && (
        <Reveal delay={300}>
          <div className="mt-8">
            <p className="label">Top 10 opportunity cards · {st.label}</p>
            <ol className="mt-3 divide-y divide-hairline-soft border-y border-hairline">
              {st.selected.map((eid, i) => {
                const c = cardOf.get(eid); const p = st.profiles[eid]; if (!c || !p) return null;
                const open = openCard === eid;
                return (
                  <li key={eid} className="py-2">
                    <button className="flex w-full items-baseline gap-3 text-left" onClick={() => setOpenCard(open ? null : eid)}>
                      <span className="label w-6 text-muted">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-sm text-ink">{c.name}</span>
                      <span className="label text-muted">{c.kind === "product_type" ? "product" : "application"} · {c.docs_public}+{c.docs_internal}i docs · {c.maturity}</span>
                      <span className="label ml-auto"><span style={{ color: "var(--why)" }}>why {p.q1}</span> · <span style={{ color: "var(--what)" }}>now {p.q2}</span> · <span style={{ color: "var(--how)" }}>path {p.q3}</span></span>
                    </button>
                    {open && (
                      <div className="mt-2 grid gap-3 pl-9 text-xs md:grid-cols-2">
                        <div>
                          <p className="label">Panel reasons</p>
                          {Object.entries(p.reasons).map(([m, r]) => (
                            <p key={m} className="mt-1 text-body"><span className="label mr-1">{m}</span> why: {r.q1} · now: {r.q2} · path: {r.q3}</p>
                          ))}
                        </div>
                        <div>
                          <p className="label">Card (what the company&rsquo;s documents say)</p>
                          {(["why", "when", "how", "resource", "issue"] as const).map((k) => c.lines[k]?.length ? (
                            <div key={k} className="mt-1"><span className="label" style={{ color: `var(--${k === "when" ? "what" : k === "issue" ? "resource" : k})` }}>{k}</span>
                              <ul className="ml-2 list-disc text-body">{c.lines[k].slice(0, 3).map((ln, j) => <li key={j}>{ln.length > 220 ? ln.slice(0, 220) + "…" : ln}</li>)}</ul></div>
                          ) : null)}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </Reveal>
      )}

      {phase === "idle" && (
        <Reveal delay={360}>
          <div className="mt-10 flex items-center gap-4">
            <button className="btn" data-primary="true" onClick={build} disabled={!rm && !serverOk}>Build the roadmap from these cards</button>
            {!rm && <span className="text-xs text-muted">No generated roadmap in this copy yet.</span>}
          </div>
        </Reveal>
      )}
      {phase === "working" && (
        <div className="mt-10 flex items-center gap-4 text-sm text-muted"><span className="inline-block h-3 w-3 animate-pulse border border-ink" /> Reading the cards, placing nodes on the horizon, citing passages…</div>
      )}
      {phase === "done" && rm && (
        <div className="mt-10 view-enter">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Which roadmap to show">
              <button className="btn" role="tab" aria-selected={compare === "stance"} data-primary={compare === "stance" ? "true" : undefined} onClick={() => setCompare("stance")}>With the knowledge base built by our system</button>
              <button className="btn" role="tab" aria-selected={compare === "initial"} data-primary={compare === "initial" ? "true" : undefined} onClick={() => setCompare("initial")} disabled={!data?.initial}>Without a knowledge base (model prior only)</button>
            </div>
            {stats && <span className="label ml-auto">{compare === "stance" && hasV2 ? `${STANCE_SHORT[stance]} · ` : ""}{stats.n} nodes · {stats.edges} edges · {stats.ev} with evidence · {stats.byLayer.map(([l, k]) => `${l} ${k}`).join(" · ")}</span>}
          </div>
          <div className="border border-hairline bg-[color-mix(in_oklab,var(--surface-card)_92%,transparent)] p-4">
            <Chart rm={rm} onSelect={setSel} selected={sel} evidence={evidence} />
            <div className="rm-legend" aria-label="Legend">
              <span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="var(--muted)" /></svg>requires</span>
              <span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="var(--muted)" strokeDasharray="6 3" /></svg>enables</span>
              <span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="var(--muted)" strokeDasharray="2 3" /></svg>drives</span>
              <span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="var(--muted)" strokeWidth="0.8" /></svg>precedes</span>
              <span><svg width="26" height="12"><rect x="1" y="1" width="24" height="10" rx="3" fill="none" stroke="var(--muted)" strokeDasharray="3 3" /></svg>no evidence cited</span>
              <span><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="var(--internal)" /></svg>internal evidence only</span>
              <span><b style={{ color: "var(--resource)" }}>↻</b> revised · <b style={{ color: "var(--conflict)" }}>!</b> conflict · <b>✕</b> infeasible</span>
            </div>
          </div>
          {sel && (
            <div className="mt-4 border-l border-ink pl-4">
              <p className="label" style={{ color: `var(--${sel.layer})` }}>{sel.layer} · {sel.start ?? "?"}–{sel.end ?? "?"}{sel.flags?.length ? ` · ${sel.flags.join(", ")}` : ""}</p>
              <h3 className="display mt-1 text-xl">{sel.label}</h3>
              <p className="mt-2 max-w-2xl text-sm text-body">{sel.description}</p>
              {rm?.provenance?.[sel.id]?.length ? (
                <div className="mt-4">
                  <p className="label">Why this item is on the roadmap</p>
                  <ol className="prov mt-2">
                    {groupProv(rm.provenance[sel.id]).map((g) => (
                      <li key={g.id}>
                        <div className="prov-step"><span className="prov-k">opportunity card</span>
                          <div>{g.cards.length ? g.cards.map((c, i) => (
                            <span key={c.name + i} className="prov-card"><b>{c.name}</b><span className="text-muted"> · {c.line}{c.selected ? "" : " · not in the top ten"}</span></span>
                          )) : <span className="text-muted">cited directly, not through a card</span>}</div></div>
                        <div className="prov-step"><span className="prov-k">{g.structure}</span><div className="text-body">{g.detail}</div></div>
                        {g.source && <div className="prov-step"><span className="prov-k">source sentence</span>
                          <div><span className="text-muted">{g.source.date} · {g.source.type}{g.source.synthetic ? " · internal" : ""}</span><br /><span className="text-body">&ldquo;{g.source.text}&rdquo;</span></div></div>}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
              <ul className="mt-3 space-y-2 text-xs">
                {(sel.evidence_ids || []).map((pid) => { const e = evidence[pid]; return e ? (<li key={pid} className="border-l border-hairline pl-3 text-body"><span className="label mr-2">{e.date} · {e.source_type}{e.synthetic ? " · internal" : ""}</span>{e.text}</li>) : (<li key={pid} className="text-muted">{pid}</li>); })}
                {!sel.evidence_ids?.length && <li className="text-muted">No source passage cited — this node comes from the model&rsquo;s prior knowledge.</li>}
              </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
