"use client";

import { useEffect, useRef, useState } from "react";
import { API, replay, type KbEvent, type Meta } from "@/lib/data";
import { StructuresEngine } from "@/lib/structures";

export type Source = { kind: "static"; events: KbEvent[] } | { kind: "server"; run: string };

const PANELS: { id: "k1" | "k2" | "k3" | "k4" | "k5"; dom: string; k: string; fn: string }[] = [
  { id: "k1", dom: "p1", k: "K1  Evidence store", fn: "① grounding — every stored passage" },
  { id: "k2", dom: "p2", k: "K2  Theme summary tree", fn: "② trend — passage → theme → area" },
  { id: "k3", dom: "p3", k: "K3  Opportunity linkage grid", fn: "③ opportunities & priority" },
  { id: "k4", dom: "p4", k: "K4  Dependency graph", fn: "④ links — (subject, relation, subject)" },
  { id: "k5", dom: "p5", k: "K5  Temporal knowledge graph", fn: "⑤ timing — chains per subject and attribute" },
];

/**
 * 다섯 구조가 자라는 화면. 엔진이 그리고, React 는 그릇·조작부·진행만 맡는다.
 */
export default function Build({ meta, source, onDone }: { meta: Meta; source: Source; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const eng = useRef<StructuresEngine | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [speed, setSpeed] = useState(() => { const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("speed") : null; return q != null ? +q : 20; });
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const r = root.current!;
    const q = <T extends Element>(s: string) => r.querySelector(s) as T;
    const e = new StructuresEngine({
      chips: q("#chips"), passages: q("#passages"), s2: q("#s2"), s3: q("#s3"), s4: q("#s4"), s5: q("#s5"), links: q("#links"), root: r, tip: q("#tip"),
      log: q("#log"), stats: q("#stats"), share: q("#share"), doc: q("#doc"), progress: q("#progress"), bar: q("#bar"),
      counts: { c1: q("#c1"), c2: q("#c2"), c3: q("#c3"), c4: q("#c4"), c5: q("#c5") },
      panels: { k1: q("#p1"), k2: q("#p2"), k3: q("#p3"), k4: q("#p4"), k5: q("#p5") },
    });
    e.setMeta(meta);
    eng.current = e;
    const onResize = () => e.relayout();
    window.addEventListener("resize", onResize);
    start(e, 0);
    return () => { stopRef.current?.(); window.removeEventListener("resize", onResize); e.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start(e: StructuresEngine, from: number) {
    stopRef.current?.();
    setRunning(true); setFinished(false); setStarted(true);
    const done = () => { setRunning(false); setFinished(true); };
    if (source.kind === "static") {
      stopRef.current = replay(source.events, (ev) => e.handle(ev), done, { speed, start: from });
    } else {
      const es = new EventSource(`${API}/api/v2/runs/${source.run}/stream?speed=${speed}&start=${from}&follow=true`);
      es.addEventListener("kb", (m) => e.handle(JSON.parse((m as MessageEvent).data)));
      es.addEventListener("done", () => { es.close(); done(); });
      stopRef.current = () => es.close();
    }
  }
  const pause = () => { stopRef.current?.(); setRunning(false); };
  const resume = () => { if (eng.current) start(eng.current, eng.current.lastSeq); };
  const restart = () => { if (eng.current) { eng.current.reset(); eng.current.setMeta(meta); setStarted(false); start(eng.current, 0); } };
  const skip = () => {
    if (!eng.current) return;
    stopRef.current?.();
    if (source.kind === "static") {
      const e = eng.current; e.beams = false;
      source.events.filter((ev) => ev.seq > e.lastSeq).forEach((ev) => e.handle(ev));
      e.beams = true; e.relayout(); setRunning(false); setFinished(true);
    }
  };

  return (
    <div ref={root} className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="label">Live construction</span>
        <span className="h-px w-10 bg-hairline" aria-hidden="true" />
        <span id="doc" className="text-xs text-muted" />
        <div className="ml-auto flex items-center gap-2">
          {running
            ? <button className="btn" onClick={pause}>Pause</button>
            : <button className="btn" data-primary={!started ? "true" : undefined} onClick={resume} disabled={finished}>{started ? "Resume" : "Start"}</button>}
          <button className="btn" onClick={restart}>Restart</button>
          {source.kind === "static" && <button className="btn" onClick={skip} disabled={finished}>Skip to end</button>}
          <label className="label flex items-center gap-2">speed
            <input type="range" min={1} max={80} value={speed} onChange={(e) => { setSpeed(+e.target.value); }} onMouseUp={() => eng.current && running && start(eng.current, eng.current.lastSeq)} className="w-24 accent-[var(--ink)]" />
          </label>
        </div>
      </div>
      <div className="chips mb-2"><span className="label mr-2" style={{ color: "var(--k0)" }}>K0 glossary</span><span id="chips" className="chips" /></div>
      <div className="panels">
        {PANELS.map((p) => (
          <section key={p.id} className="panel" id={p.dom} data-flash="false">
            <header><span className="k">{p.k}</span><span className="label fn">{p.fn}</span><span id={"c" + p.id[1]} className="cnt label">0</span></header>
            <div className="body">{p.id === "k1" ? <div id="passages" className="passages" /> : <svg id={"s" + p.id[1]} />}</div>
          </section>
        ))}
        <aside className="panel aside" id="paside">
          <div className="sec"><h3 className="label">Progress</h3><div id="progress" className="text-sm text-ink">—</div><div className="mt-2 h-px w-full bg-hairline-soft"><div id="bar" className="h-px bg-ink transition-[width] duration-300" style={{ width: 0 }} /></div></div>
          <div className="sec"><h3 className="label">Size of each structure</h3><div id="stats" className="stats" /></div>
          <div className="sec"><h3 className="label">Router dispatch by document type</h3><table id="share" className="share" /></div>
          <div className="sec"><h3 className="label">Router decisions · structure events</h3></div>
          <div id="log" className="log" />
        </aside>
        <svg id="links" className="links-overlay" />
        <div id="tip" className="tip" />
      </div>
      {finished && (
        <div className="mt-6 flex items-center gap-4">
          <span className="label">Construction complete</span>
          <span className="h-px w-10 bg-hairline" aria-hidden="true" />
          <button className="btn" data-primary="true" onClick={onDone}>Open the opportunity cards →</button>
        </div>
      )}
    </div>
  );
}
