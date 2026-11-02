"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import Reveal from "./Reveal";

export type RmNode = { id: string; label: string; layer: "why" | "what" | "how" | "resource"; start?: number | null; end?: number | null; description?: string; evidence_ids?: string[]; flags?: string[] };
export type Roadmap = { condition: string; model: string; horizon: [number, number]; nodes: RmNode[]; edges: { src: string; dst: string; type: string }[] };
export type Roadmaps = { initial?: Roadmap; kb?: Roadmap; evidence?: Record<string, { text: string; doc_id: string; date: string; source_type: string; synthetic: boolean }> };

const LAYERS: RmNode["layer"][] = ["why", "what", "how", "resource"];
const LABEL: Record<string, string> = { why: "Why · market & drivers", what: "What · products & milestones", how: "How · technologies", resource: "Resources · enablers" };

function Chart({ rm, evidence, onSelect, selected }: { rm: Roadmap; evidence: Roadmaps["evidence"]; onSelect: (n: RmNode | null) => void; selected: RmNode | null }) {
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
      const lanes: number[] = []; // 끝 x
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
    const nodeById = new Map(rm.nodes.map((n) => [n.id, n]));
    rm.edges.forEach((e) => { const a = posOf.get(e.src), b = posOf.get(e.dst); if (!a || !b) return; svg.append("path").attr("class", "rm-edge").attr("d", `M${a.x + a.w / 2},${a.y + 22} C${a.x + a.w / 2},${(a.y + b.y) / 2 + 11} ${b.x + b.w / 2},${(a.y + b.y) / 2 + 11} ${b.x + b.w / 2},${b.y}`); });
    const g = svg.append("g").selectAll("g").data(rm.nodes).join("g").attr("class", (n) => "rm-node" + (selected?.id === n.id ? " selected" : "")).attr("data-layer", (n) => n.layer).attr("data-evidence", (n) => (n.evidence_ids?.length ? 1 : 0))
      .attr("transform", (n) => { const p = posOf.get(n.id)!; return `translate(${p.x},${p.y})`; }).style("cursor", "pointer").on("click", (_, n) => onSelect(n));
    g.append("rect").attr("width", (n) => posOf.get(n.id)!.w).attr("height", 22).attr("rx", 0);
    g.append("text").attr("x", 6).attr("y", 14.5).text((n) => { const w = posOf.get(n.id)!.w; return n.label.length > w / 6 ? n.label.slice(0, Math.max(4, w / 6 - 1)) + "…" : n.label; });
    g.append("title").text((n) => `${n.label}\n${n.start ?? ""}–${n.end ?? ""}\n${n.description || ""}\nevidence: ${(n.evidence_ids || []).length}`);
    void nodeById; void evidence;
  }, [rm, selected, onSelect, evidence]);
  return <svg ref={ref} className="w-full" />;
}

export default function RoadmapView({ data, serverOk }: { data: Roadmaps | null; serverOk: boolean }) {
  const [phase, setPhase] = useState<"idle" | "working" | "done">("idle");
  const [which, setWhich] = useState<"kb" | "initial">("kb");
  const [sel, setSel] = useState<RmNode | null>(null);
  const rm = data?.[which] ?? null;
  const stats = useMemo(() => {
    if (!rm) return null;
    const n = rm.nodes.length, ev = rm.nodes.filter((x) => x.evidence_ids?.length).length;
    return { n, ev, edges: rm.edges.length, byLayer: LAYERS.map((l) => [l, rm.nodes.filter((x) => x.layer === l).length] as const) };
  }, [rm]);

  const build = () => {
    setPhase("working");
    // 정적 모드: 미리 생성해 둔 로드맵을 연다. 서버 모드: 생성기 호출 (추후 /api/v2/generate).
    setTimeout(() => setPhase("done"), serverOk ? 400 : 1800);
  };

  return (
    <section>
      <Reveal>
        <div className="flex items-center gap-4"><p className="label">04 / 04 · Roadmap</p><span className="h-px w-16 bg-hairline" aria-hidden="true" /></div>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="display mt-6 text-[clamp(1.8rem,4.4vw,3rem)] leading-[1.15]">Now the agent writes the roadmap from what it built.</h1>
      </Reveal>
      <Reveal delay={160}>
        <p className="mt-5 max-w-2xl text-[0.95rem] leading-[1.85] text-body">
          The generator receives the opportunity cards and the remaining worksheets of the five structures, with one reading rule per structure.
          Its instructions, output schema and model are identical to a generator that has no knowledge base at all — so the difference between the two
          roadmaps is the knowledge, not the prompt.
        </p>
      </Reveal>

      {phase === "idle" && (
        <Reveal delay={240}>
          <div className="mt-10 flex items-center gap-4">
            <button className="btn" data-primary="true" onClick={build} disabled={!data?.kb && !serverOk}>Build the roadmap with the agent</button>
            {!data?.kb && <span className="text-xs text-muted">No generated roadmap in this copy yet.</span>}
          </div>
        </Reveal>
      )}
      {phase === "working" && (
        <div className="mt-10 flex items-center gap-4 text-sm text-muted"><span className="inline-block h-3 w-3 animate-pulse border border-ink" /> Reading the cards, placing nodes on the horizon, citing passages…</div>
      )}
      {phase === "done" && rm && (
        <div className="mt-10 view-enter">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex border border-hairline">
              <button className="label px-4 py-2 data-[on=true]:text-ink" data-on={which === "kb"} onClick={() => setWhich("kb")}>With knowledge base</button>
              <button className="label border-l border-hairline-soft px-4 py-2 data-[on=true]:text-ink" data-on={which === "initial"} onClick={() => setWhich("initial")} disabled={!data?.initial}>Without (prior knowledge only)</button>
            </div>
            {stats && <span className="label ml-auto">{stats.n} nodes · {stats.edges} edges · {stats.ev} with evidence · {stats.byLayer.map(([l, k]) => `${l} ${k}`).join(" · ")}</span>}
          </div>
          <div className="border border-hairline bg-[color-mix(in_oklab,var(--surface-card)_92%,transparent)] p-4">
            <Chart rm={rm} evidence={data?.evidence} onSelect={setSel} selected={sel} />
          </div>
          {sel && (
            <div className="mt-4 border-l border-ink pl-4">
              <p className="label" style={{ color: `var(--${sel.layer})` }}>{sel.layer} · {sel.start ?? "?"}–{sel.end ?? "?"}{sel.flags?.length ? ` · ${sel.flags.join(", ")}` : ""}</p>
              <h3 className="display mt-1 text-xl">{sel.label}</h3>
              <p className="mt-2 max-w-2xl text-sm text-body">{sel.description}</p>
              <ul className="mt-3 space-y-2 text-xs">
                {(sel.evidence_ids || []).map((pid) => { const e = data?.evidence?.[pid]; return e ? (<li key={pid} className="border-l border-hairline pl-3 text-body"><span className="label mr-2">{e.date} · {e.source_type}{e.synthetic ? " · internal" : ""}</span>{e.text}</li>) : (<li key={pid} className="text-muted">{pid}</li>); })}
                {!sel.evidence_ids?.length && <li className="text-muted">No source passage cited — this node comes from the model&rsquo;s prior knowledge.</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
