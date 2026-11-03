/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 다섯 지식 구조 엔진 — 사건(KbEvent) 하나를 받아 다섯 패널을 갱신한다.
 * React 는 그릇(DOM 자리)만 만들고, 그리기는 D3 가 직접 한다. 사건이 수천 개라 React 상태로 돌리면 느리다.
 *
 *   K1 근거 저장소  : 문장 흐름 (층 태그, 보낸 구조)
 *   K2 주제 요약 트리: 주제 버블 (영역으로 묶임, 추세 색)
 *   K3 기회 연계 그리드: 열 = 기회, 행 = 동인·제공물·역량·자원, 칸 = 연결
 *   K4 의존 관계 그래프: 힘 배치 그래프
 *   K5 시간 지식그래프: 대상별 가로줄 위의 사실, 속성별 체인
 *   구조 간 연결: 문장 → 패널 빛줄기, 같은 공유 대상이 다른 패널에 있으면 그 둘을 잇는 선
 */
import * as d3 from "d3";
import type { KbEvent, Meta } from "./data";

export type Els = {
  chips: HTMLElement; passages: HTMLElement; s2: SVGSVGElement; s3: SVGSVGElement; s4: SVGSVGElement; s5: SVGSVGElement;
  links: SVGSVGElement; root: HTMLElement; tip: HTMLElement; log: HTMLElement; stats: HTMLElement; share: HTMLElement;
  doc: HTMLElement; progress: HTMLElement; bar: HTMLElement;
  counts: Record<"c1" | "c2" | "c3" | "c4" | "c5", HTMLElement>;
  panels: Record<"k1" | "k2" | "k3" | "k4" | "k5", HTMLElement>;
};

const LAYERS = ["why", "what", "how", "resource"] as const;
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const SYS_PANEL: Record<string, "k2" | "k3" | "k4" | "k5"> = { tree: "k2", grid: "k3", graph: "k4", time: "k5" };
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

export class StructuresEngine {
  els: Els;
  meta: Meta | null = null;
  beams = true;
  S: any;
  lastSeq = 0;
  private sim: any = null;
  private g4: any = null;
  private timers: Record<string, any> = {};
  private LCOL: Record<string, string> = {};
  private flashT: Record<string, any> = {};
  onProgress?: (done: number, total: number) => void;

  constructor(els: Els) {
    this.els = els;
    this.reset();
    document.addEventListener("mouseover", this.hoverOn);
    document.addEventListener("mouseout", this.hoverOff);
  }

  destroy() {
    document.removeEventListener("mouseover", this.hoverOn);
    document.removeEventListener("mouseout", this.hoverOff);
    if (this.sim) this.sim.stop();
    Object.values(this.timers).forEach(clearTimeout);
  }

  setMeta(meta: Meta) {
    this.meta = meta;
    this.S.docsTotal = meta.planned_total || meta.documents.length;
    if (meta.tree) meta.tree.areas.forEach((a) => a.theme_ids.forEach((t) => this.S.themeArea.set(t, a.name)));
    this.renderProgress();
  }

  reset() {
    this.LCOL = { why: css("--why"), what: css("--what"), how: css("--how"), resource: css("--resource") };
    this.S = {
      ents: new Map(), terms: [], passages: 0, byStatus: {}, docsDone: 0, docsTotal: this.S?.docsTotal ?? 0, curDoc: null,
      themes: new Map(), areas: new Map(), themeArea: new Map(), opps: new Map(), cells: new Map(), rows: new Map(),
      gnodes: new Map(), gedges: new Map(), facts: new Map(), subjects: new Map(), share: {},
    };
    if (this.meta?.tree) this.meta.tree.areas.forEach((a) => a.theme_ids.forEach((t) => this.S.themeArea.set(t, a.name)));
    this.lastSeq = 0;
    const { els } = this;
    els.log.innerHTML = ""; els.chips.innerHTML = ""; els.passages.innerHTML = "";
    [els.s2, els.s3, els.s4, els.s5, els.links].forEach((s) => d3.select(s).selectAll("*").remove());
    this.initGraph();
    this.renderStats(); this.renderProgress();
  }

  // ------------------------------------------------------------ helpers
  private ename(id: string): string { return this.S.ents.get(id)?.name || this.meta?.entities?.[id]?.name || id; }
  private ent(id: string, name?: string) {
    let e = this.S.ents.get(id);
    if (!e) { e = { id, name: name || this.meta?.entities?.[id]?.name || id, layers: {}, where: new Set() }; this.S.ents.set(id, e); }
    else if (name && e.name === id) e.name = name;
    return e;
  }
  private dominant(e: any): string | null { const l = Object.entries(e?.layers || {}).sort((a: any, b: any) => b[1] - a[1])[0]; return l ? l[0] : null; }
  private log(cls: string, msg: string) {
    const d = document.createElement("div");
    d.innerHTML = `<span class="t">${this.lastSeq}</span><span class="${cls}">${esc(msg)}</span>`;
    this.els.log.prepend(d);
    while (this.els.log.children.length > 250) this.els.log.lastChild!.remove();
  }
  private flash(k: keyof Els["panels"]) {
    const el = this.els.panels[k]; el.dataset.flash = "true";
    clearTimeout(this.flashT[k]); this.flashT[k] = setTimeout(() => { el.dataset.flash = "false"; }, 450);
  }
  private tip(e: MouseEvent, html: string) {
    const t = this.els.tip; t.style.display = "block"; t.innerHTML = html;
    const m = this.els.root.getBoundingClientRect();
    t.style.left = Math.min(e.clientX - m.left + 14, m.width - 380) + "px"; t.style.top = e.clientY - m.top + 10 + "px";
  }
  private hideTip = () => { this.els.tip.style.display = "none"; };
  private hoverOn = (e: Event) => { const el = (e.target as HTMLElement).closest?.("[data-eid]") as HTMLElement | null; if (!el) return; this.els.root.querySelectorAll(`[data-eid="${el.dataset.eid}"]`).forEach((x) => x.classList.add("hl")); };
  private hoverOff = (e: Event) => { const el = (e.target as HTMLElement).closest?.("[data-eid]") as HTMLElement | null; if (!el) return; this.els.root.querySelectorAll(`[data-eid="${el.dataset.eid}"]`).forEach((x) => x.classList.remove("hl")); };

  // ------------------------------------------------------------ dispatch
  handle(ev: KbEvent) {
    const S = this.S;
    this.lastSeq = ev.seq;
    const E = ev as any;
    switch (ev.type) {
      case "doc.started":
        S.curDoc = E;
        this.els.doc.innerHTML = `<b>${E.date}</b> · ${E.source_type}${E.synthetic ? " · internal" : ""} · ${esc(E.title)} · ${E.n} passages`;
        break;
      case "doc.finished": S.docsDone++; this.renderProgress(); break;
      case "glossary.term": this.onTerm(E); break;
      case "glossary.confirmed": { const c = this.els.chips.querySelector(`[data-tid="${E.tid}"]`) as HTMLElement | null; if (c) c.style.borderColor = css("--k0"); break; }
      case "entity.created": case "entity.linked": { const e = this.ent(E.eid, E.name); (E.layers || []).forEach((l: string) => (e.layers[l] = (e.layers[l] || 0) + 1)); break; }
      case "passage.routed": this.onPassage(E); break;
      case "tree.theme_created": S.themes.set(E.tid, { id: E.tid, name: E.name, count: 0, fresh: true }); this.log("k2", `new theme: ${E.name}`); break;
      case "tree.assigned": this.onAssigned(E); break;
      case "grid.opportunity": this.onOpportunity(E); break;
      case "graph.relation": this.onRelation(E); break;
      case "time.fact": this.onFact(E); break;
      case "entity.merged": this.log("m", `merged subjects → ${E.name} ← ${(E.merged || []).join(", ")} — ${E.reason || ""}`); break;
      case "tree.theme_merged": this.log("k2", `merged themes → ${E.name} (+${E.merged}) — ${E.reason || ""}`); break;
      case "tree.theme_summarized": { const t = S.themes.get(E.tid); if (t) t.trend = E.trend; break; }
      case "tree.area_built": S.areas.set(E.name, E); this.log("k2", `area: ${E.name} (${E.themes} themes, ${E.trend})`); this.flash("k2"); this.renderTree(); break;
      case "tree.built": this.log("k2", `tree complete: ${E.areas} areas, ${E.themes} themes`); this.renderTree(); break;
      case "grid.started":
        E.columns.forEach((c: any) => { const o = S.opps.get(c.eid) || { eid: c.eid, name: c.name, n: 0, customers: new Set(), offerings: new Set() }; o.tier = c.tier; o.support = c.support; S.opps.set(c.eid, o); });
        this.renderGrid(); break;
      case "grid.cell": this.onCell(E); break;
      case "grid.built": break;
      case "time.relinked": this.log("k5", `chains relinked: update ${E.update}, duplicate ${E.duplicate}, conflict ${E.conflict}`); break;
      case "error": this.log("m", `error ${E.structure || ""}: ${E.msg}`); break;
    }
    this.renderStats();
  }

  // ------------------------------------------------------------ K0
  private onTerm(ev: any) {
    this.S.terms.push(ev);
    const c = document.createElement("span"); c.className = "chip new"; c.dataset.tid = ev.tid;
    c.innerHTML = `${esc(ev.name)}<small>${ev.term_type}${ev.unit ? " · " + esc(ev.unit) : ""}</small>`;
    this.els.chips.prepend(c); setTimeout(() => c.classList.remove("new"), 1500);
    while (this.els.chips.children.length > 40) this.els.chips.lastChild!.remove();
    this.log("k0", `K0 term +${ev.term_type}: ${ev.name}`);
  }

  // ------------------------------------------------------------ K1
  private onPassage(ev: any) {
    const S = this.S;
    S.passages++; S.byStatus[ev.status] = (S.byStatus[ev.status] || 0) + 1;
    const st = S.curDoc?.source_type || "?";
    const sh = S.share[st] || (S.share[st] = { n: 0, tree: 0, grid: 0, graph: 0, time: 0 }); sh.n++; (ev.systems || []).forEach((s: string) => sh[s]++);
    (ev.entities || []).forEach((id: string) => { const e = this.ent(id); (ev.layers || []).forEach((l: string) => (e.layers[l] = (e.layers[l] || 0) + 1)); });
    const row = document.createElement("div");
    row.className = "ps" + (ev.status === "duplicate" ? " dup" : ev.status === "irrelevant" ? " irr" : ""); row.dataset.pid = ev.pid;
    row.innerHTML = `<div class="meta">${(ev.layers || []).map((l: string) => `<span class="tag ${l}">${l}</span>`).join("")}${(ev.systems || []).map((s: string) => `<span class="sys">${s}</span>`).join("")}<span class="date">${ev.status}${ev.synthetic ? " · internal" : ""}</span></div><div class="txt" title="${esc(ev.text)}">${esc(ev.text)}</div>`;
    this.els.passages.appendChild(row); while (this.els.passages.children.length > 10) this.els.passages.firstChild!.remove();
    if (ev.systems?.length) {
      const why = Object.entries(ev.reasons || {}).map(([s, r]) => `${s}: ${r}`).join(" | ");
      this.log("k1", `→ ${ev.systems.join("+")} · ${why}`);
      if (this.beams) ev.systems.forEach((s: string) => { const p = this.els.panels[SYS_PANEL[s]]; if (p) this.beam(row, p.querySelector("header")!, css("--ink")); });
    }
  }

  // ------------------------------------------------------------ K2
  private onAssigned(ev: any) {
    let t = this.S.themes.get(ev.tid); if (!t) { t = { id: ev.tid, name: ev.theme, count: 0 }; this.S.themes.set(ev.tid, t); }
    t.count++; t.fresh = true; t.emph = ev.emphasis; this.flash("k2");
    clearTimeout(this.timers.tree); this.timers.tree = setTimeout(() => this.renderTree(), 120);
  }
  private trendColor(tr: string | undefined, emph: string | undefined) {
    const how = css("--how"), why = css("--why"), what = css("--what"), muted = css("--muted");
    if (tr === "rising") return how; if (tr === "declining") return why; if (tr === "new") return what; if (tr === "stable") return muted;
    if (emph === "expanding") return how; if (emph === "declining") return why; return css("--hairline");
  }
  renderTree() {
    const S = this.S, svg = d3.select(this.els.s2), box = this.els.s2.getBoundingClientRect(), W = box.width, H = box.height;
    if (!W || !S.themes.size) return;
    const groups = new Map<string, any[]>();
    S.themes.forEach((t: any) => { const a = S.themeArea.get(t.id) || (S.areas.size ? "—" : null); const k = a || "all"; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(t); });
    const root: any = d3.hierarchy({ children: [...groups.entries()].map(([k, ts]) => ({ name: k, children: ts })) } as any).sum((d: any) => (d.count ? Math.sqrt(d.count) + 0.6 : 0));
    d3.pack().size([W, H]).padding((d: any) => (d.depth === 0 ? 6 : 2))(root);
    const multi = groups.size > 1;
    svg.selectAll("circle.area-circle").data(multi ? root.children : [], (d: any) => d.data.name).join("circle").attr("class", "area-circle")
      .transition().duration(300).attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y).attr("r", (d: any) => d.r);
    svg.selectAll("text.area-lbl").data(multi ? root.children : [], (d: any) => d.data.name).join("text").attr("class", "area-lbl muted").attr("text-anchor", "middle").attr("font-size", 10)
      .text((d: any) => d.data.name.slice(0, 30)).transition().duration(300).attr("x", (d: any) => d.x).attr("y", (d: any) => d.y - d.r + 11);
    const leaves = root.leaves().filter((d: any) => d.data.count);
    const g = svg.selectAll("g.bubble").data(leaves, (d: any) => d.data.id);
    const ge = g.enter().append("g").attr("class", "bubble").attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    ge.append("circle").attr("r", 0); ge.append("text").attr("text-anchor", "middle").attr("dy", 3);
    const all = ge.merge(g as any);
    all.classed("new", (d: any) => d.data.fresh).attr("data-tid", (d: any) => d.data.id)
      .on("mousemove", (e: MouseEvent, d: any) => this.tip(e, `<b>${esc(d.data.name)}</b><br>${d.data.count} passages${d.data.trend ? " · " + d.data.trend : ""}${S.themeArea.get(d.data.id) ? "<br>area: " + esc(S.themeArea.get(d.data.id)) : ""}`)).on("mouseleave", this.hideTip);
    all.transition().duration(300).attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    all.select("circle").transition().duration(300).attr("r", (d: any) => d.r).attr("fill", (d: any) => this.trendColor(d.data.trend, d.data.emph)).attr("fill-opacity", 0.55);
    all.select("text").text((d: any) => (d.r > 18 ? d.data.name.slice(0, Math.max(4, d.r / 3.2)) : "")).attr("font-size", (d: any) => Math.min(11, Math.max(8, d.r / 3))).attr("fill", css("--ink"));
    g.exit().remove();
    S.themes.forEach((t: any) => (t.fresh = false));
    this.els.counts.c2.textContent = `${S.themes.size} themes${S.areas.size ? " · " + S.areas.size + " areas" : ""}`;
  }

  // ------------------------------------------------------------ K3
  private onOpportunity(ev: any) {
    const S = this.S;
    let o = S.opps.get(ev.eid); if (!o) { o = { eid: ev.eid, name: ev.name, n: 0, customers: new Set(), offerings: new Set(), kind: ev.kind }; S.opps.set(ev.eid, o); }
    o.n++; o.fresh = true; if (ev.customer) o.customers.add(ev.customer); if (ev.offering) o.offerings.add(ev.offering); o.maturity = ev.maturity;
    this.ent(ev.eid, ev.name).where.add("k3");
    this.log("k3", `opportunity: ${ev.name}${ev.customer ? " ← " + ev.customer : ""}${ev.offering ? " · " + ev.offering : ""} (${ev.maturity})`);
    this.flash("k3"); clearTimeout(this.timers.grid); this.timers.grid = setTimeout(() => { this.renderGrid(); this.crossLink(ev.eid, "k3"); }, 100);
  }
  private onCell(ev: any) {
    const S = this.S;
    S.cells.set(ev.row + "|" + ev.col, { ...ev, fresh: true });
    if (!S.rows.has(ev.row)) S.rows.set(ev.row, { eid: ev.row, name: ev.row_name, layer: ev.layer, n: 0 });
    S.rows.get(ev.row).n++; this.ent(ev.row, ev.row_name).where.add("k3");
    clearTimeout(this.timers.grid); this.timers.grid = setTimeout(() => this.renderGrid(), 60);
  }
  renderGrid() {
    const S = this.S, svg = d3.select(this.els.s3), box = this.els.s3.getBoundingClientRect(), W = box.width, H = box.height;
    if (!W || !S.opps.size) return;
    const maxCols = Math.max(3, Math.min(10, Math.floor((W - 158) / 64)));
    const cols: any[] = [...S.opps.values()].sort((a: any, b: any) => ((a.tier || "B") < (b.tier || "B") ? -1 : (a.tier || "B") > (b.tier || "B") ? 1 : (b.support || b.n) - (a.support || a.n))).slice(0, maxCols);
    const colIdx = new Map(cols.map((c, i) => [c.eid, i]));
    const rows: any[] = [...S.rows.values()].filter((r: any) => [...S.cells.values()].some((c: any) => c.row === r.eid && colIdx.has(c.col)))
      .sort((a: any, b: any) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer) || b.n - a.n).slice(0, 26);
    const rowIdx = new Map(rows.map((r, i) => [r.eid, i]));
    const left = 150, top = 66, cw = Math.min(150, (W - left - 8) / Math.max(cols.length, 1)), rh = rows.length ? Math.min(18, (H - top - 6) / rows.length) : 18;
    svg.selectAll("*").remove();
    const ink = css("--ink"), muted = css("--muted"), hair = css("--hairline"), res = css("--resource");
    const hc = svg.append("g");
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    hc.selectAll("g").data(cols).join("g").attr("data-eid", (d: any) => d.eid).attr("transform", (d: any, i: number) => `translate(${left + i * cw + cw / 2},0)`)
      .each(function (d: any) {
        const g = d3.select(this as SVGGElement);
        g.append("rect").attr("x", -cw / 2 + 1).attr("y", 4).attr("width", cw - 2).attr("height", 56).attr("fill", d.customers.size ? css("--surface-soft") : "none").attr("stroke", d.fresh ? ink : hair).attr("stroke-width", d.fresh ? 1.5 : 1);
        const words = String(d.name).split(/\s+/); const lines: string[] = []; let line: string[] = [];
        words.forEach((w) => { line.push(w); if (line.join(" ").length * (cw < 90 ? 5 : 5.6) > cw - 8) { line.pop(); if (line.length) lines.push(line.join(" ")); line = [w]; } });
        if (line.length) lines.push(line.join(" "));
        const t = g.append("text").attr("text-anchor", "middle").attr("font-size", cw < 90 ? 9.5 : 10.5).attr("fill", ink);
        lines.slice(0, 2).forEach((l, i) => t.append("tspan").attr("x", 0).attr("y", 15 + i * 12).text(l));
        g.append("text").attr("y", 44).attr("text-anchor", "middle").attr("font-size", 9).attr("fill", muted).text(`${d.n} rec`);
        g.append("text").attr("y", 55).attr("text-anchor", "middle").attr("font-size", 9).attr("fill", res).text(String(d.customers.size ? [...d.customers][0] : d.offerings.size ? [...d.offerings][0] : d.maturity || "").slice(0, Math.max(6, Math.floor(cw / 6.4))));
        g.on("mousemove", (e: MouseEvent) => self.tip(e, `<b>${esc(d.name)}</b><br>${d.n} records · ${d.maturity || ""}<br>markets: ${[...d.customers].join(", ") || "—"}<br>offerings: ${[...d.offerings].join(", ") || "—"}`)).on("mouseleave", self.hideTip);
      });
    const rg = svg.append("g");
    rg.selectAll("g").data(rows).join("g").attr("transform", (d: any, i: number) => `translate(0,${top + i * rh})`).attr("data-eid", (d: any) => d.eid)
      .each(function (d: any) {
        const g = d3.select(this as SVGGElement);
        g.append("rect").attr("x", 4).attr("y", 2).attr("width", 5).attr("height", rh - 4).attr("fill", self.LCOL[d.layer] || muted);
        g.append("text").attr("x", 14).attr("y", rh / 2 + 3.5).attr("class", "rowlbl").text(d.name.length > 22 ? d.name.slice(0, 21) + "…" : d.name);
        g.append("line").attr("class", "rowline").attr("x1", left).attr("x2", W - 4).attr("y1", rh).attr("y2", rh);
      });
    const cells = [...S.cells.values()].filter((c: any) => colIdx.has(c.col) && rowIdx.has(c.row));
    svg.append("g").selectAll("rect").data(cells, (d: any) => d.row + "|" + d.col).join("rect")
      .attr("class", (d: any) => "cell" + (d.derivation === "derived" ? " derived" : "") + (d.fresh ? " new" : ""))
      .attr("x", (d: any) => left + colIdx.get(d.col)! * cw + 2).attr("y", (d: any) => top + rowIdx.get(d.row)! * rh + 2).attr("width", cw - 4).attr("height", rh - 4)
      .attr("fill", (d: any) => this.LCOL[d.layer] || muted).attr("fill-opacity", (d: any) => 0.22 + 0.22 * Math.min(3, d.strength))
      .on("mousemove", (e: MouseEvent, d: any) => this.tip(e, `<b>${esc(d.row_name)}</b> → <b>${esc(d.col_name)}</b><br>${d.relation} · ${d.derivation} · strength ${d.strength}<br>${esc(d.reason || "")}`)).on("mouseleave", this.hideTip);
    S.cells.forEach((c: any) => (c.fresh = false)); S.opps.forEach((o: any) => (o.fresh = false));
    this.els.counts.c3.textContent = `${S.opps.size} · ${S.cells.size} links`;
  }

  // ------------------------------------------------------------ K4
  private initGraph() {
    const svg = d3.select(this.els.s4); svg.selectAll("*").remove();
    svg.append("defs").append("marker").attr("id", "arrow4").attr("viewBox", "0 -4 8 8").attr("refX", 14).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto")
      .append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", css("--muted"));
    this.g4 = { edges: svg.append("g"), labels: svg.append("g"), nodes: svg.append("g") };
    if (this.sim) this.sim.stop();
    const box = this.els.s4.getBoundingClientRect();
    this.sim = d3.forceSimulation().force("link", d3.forceLink().id((d: any) => d.id).distance(60).strength(0.5)).force("charge", d3.forceManyBody().strength(-90).distanceMax(220))
      .force("x", d3.forceX(box.width / 2).strength(0.06)).force("y", d3.forceY(box.height / 2).strength(0.1)).force("collide", d3.forceCollide(17)).on("tick", () => this.tick4());
  }
  private onRelation(ev: any) {
    const S = this.S;
    const a = this.ent(ev.src, ev.src_name), b = this.ent(ev.dst, ev.dst_name); a.where.add("k4"); b.where.add("k4");
    [ev.src, ev.dst].forEach((id) => { if (!S.gnodes.has(id)) S.gnodes.set(id, { id, deg: 0 }); S.gnodes.get(id).deg++; S.gnodes.get(id).fresh = true; });
    S.gedges.set(ev.rid, { id: ev.rid, source: ev.src, target: ev.dst, rel: ev.rel, fresh: true });
    this.log("k4", `relation: ${this.ename(ev.src)} —${ev.rel}→ ${this.ename(ev.dst)}`);
    this.flash("k4"); this.renderGraph(); this.crossLink(ev.src, "k4"); this.crossLink(ev.dst, "k4");
  }
  renderGraph() {
    const S = this.S, g4 = this.g4; if (!g4) return;
    const keep = new Set([...S.gnodes.values()].sort((a: any, b: any) => b.deg - a.deg).slice(0, 140).map((n: any) => n.id));
    const nodes: any[] = [...S.gnodes.values()].filter((n: any) => keep.has(n.id));
    const edges: any[] = [...S.gedges.values()].filter((e: any) => keep.has(typeof e.source === "object" ? e.source.id : e.source) && keep.has(typeof e.target === "object" ? e.target.id : e.target));
    const ns = g4.nodes.selectAll("g.node").data(nodes, (d: any) => d.id);
    const ne = ns.enter().append("g").attr("class", "node").attr("data-eid", (d: any) => d.id)
      .call(d3.drag<any, any>().on("start", (e, d) => { d.fx = d.x; d.fy = d.y; }).on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; this.sim.alpha(0.3).restart(); }).on("end", (e, d) => { d.fx = d.fy = null; }));
    ne.append("circle"); ne.append("text").attr("dx", 9).attr("dy", 3);
    const na = ne.merge(ns);
    na.classed("new", (d: any) => d.fresh).select("circle").attr("r", (d: any) => 4 + Math.min(9, Math.sqrt(d.deg) * 2)).attr("fill", (d: any) => this.LCOL[this.dominant(S.ents.get(d.id)) || ""] || css("--muted")).attr("fill-opacity", 0.75);
    na.select("text").text((d: any) => this.ename(d.id).slice(0, 26));
    na.on("mousemove", (e: MouseEvent, d: any) => this.tip(e, `<b>${esc(this.ename(d.id))}</b><br>${d.deg} relations · layer ${this.dominant(S.ents.get(d.id)) || "?"}`)).on("mouseleave", this.hideTip);
    ns.exit().remove();
    const es = g4.edges.selectAll("line").data(edges, (d: any) => d.id);
    es.enter().append("line").attr("class", "edge").attr("marker-end", "url(#arrow4)").merge(es).classed("new", (d: any) => d.fresh); es.exit().remove();
    const ls = g4.labels.selectAll("text").data(edges, (d: any) => d.id);
    ls.enter().append("text").attr("class", "edge-label").attr("text-anchor", "middle").text((d: any) => d.rel).merge(ls); ls.exit().remove();
    const bb = this.els.s4.getBoundingClientRect();
    this.sim.force("x").x(bb.width / 2); this.sim.force("y").y(bb.height / 2);
    nodes.forEach((n) => { if (n.x == null || isNaN(n.x)) { n.x = bb.width / 2 + (Math.random() - 0.5) * 60; n.y = bb.height / 2 + (Math.random() - 0.5) * 60; } });
    this.sim.nodes(nodes); this.sim.force("link").links(edges); this.sim.alpha(0.5).restart();
    setTimeout(() => { S.gnodes.forEach((n: any) => (n.fresh = false)); S.gedges.forEach((e: any) => (e.fresh = false)); g4.nodes.selectAll("g.node").classed("new", false); g4.edges.selectAll("line").classed("new", false); }, 1500);
    this.els.counts.c4.textContent = `${S.gnodes.size} subjects · ${S.gedges.size} relations`;
  }
  private tick4() {
    const g4 = this.g4; if (!g4) return;
    const box = this.els.s4.getBoundingClientRect(), W = box.width, H = box.height;
    g4.nodes.selectAll("g.node").attr("transform", (d: any) => { d.x = Math.max(10, Math.min(W - 10, d.x)); d.y = Math.max(10, Math.min(H - 10, d.y)); return `translate(${d.x},${d.y})`; });
    g4.edges.selectAll("line").attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
    g4.labels.selectAll("text").attr("x", (d: any) => (d.source.x + d.target.x) / 2).attr("y", (d: any) => (d.source.y + d.target.y) / 2 - 3);
  }

  // ------------------------------------------------------------ K5
  private onFact(ev: any) {
    const S = this.S;
    S.facts.set(ev.fid, { ...ev, fresh: true });
    let s = S.subjects.get(ev.eid); if (!s) { s = { eid: ev.eid, n: 0, last: 0 }; S.subjects.set(ev.eid, s); } s.n++; s.last = ev.seq;
    this.ent(ev.eid, ev.name).where.add("k5");
    this.log("k5", `fact: ${ev.name} · ${ev.attribute} = ${ev.value}${ev.valid != null ? " @" + (+ev.valid).toFixed(1) : ""} (${ev.modality}${ev.status !== "new" ? ", " + String(ev.status).toUpperCase() : ""})`);
    this.flash("k5"); clearTimeout(this.timers.time); this.timers.time = setTimeout(() => { this.renderTime(); this.crossLink(ev.eid, "k5"); }, 80);
  }
  renderTime() {
    const S = this.S, svg = d3.select(this.els.s5), box = this.els.s5.getBoundingClientRect(), W = box.width, H = box.height;
    if (!W || !S.facts.size) return;
    svg.selectAll("*").remove();
    const MOD: Record<string, string> = { achieved: css("--how"), current: css("--muted"), planned: css("--what"), forecast: css("--what"), required: css("--resource"), vision: css("--k0") };
    const subs: any[] = [...S.subjects.values()].sort((a: any, b: any) => b.n - a.n || b.last - a.last).slice(0, Math.max(3, Math.floor((H - 30) / 22)));
    const left = 140, top = 8, rh = Math.min(26, (H - 30) / subs.length);
    const x = d3.scaleLinear().domain([2019.5, 2031]).range([left, W - 10]);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - 18})`).call(d3.axisBottom(x).tickValues(d3.range(2020, 2031, 1)).tickFormat(d3.format("d")) as any);
    svg.append("line").attr("x1", x(2024.9)).attr("x2", x(2024.9)).attr("y1", top).attr("y2", H - 18).attr("stroke", css("--hairline")).attr("stroke-dasharray", "3 3");
    svg.append("text").attr("x", x(2024.9) + 3).attr("y", H - 24).attr("class", "muted").attr("font-size", 9).text("documents end");
    const rowY = new Map(subs.map((s, i) => [s.eid, top + i * rh + rh / 2]));
    const rg = svg.append("g");
    subs.forEach((s) => { const y = rowY.get(s.eid)!; rg.append("line").attr("class", "rowline").attr("x1", left).attr("x2", W - 10).attr("y1", y).attr("y2", y); rg.append("text").attr("x", 6).attr("y", y + 3.5).attr("class", "rowlbl").attr("data-eid", s.eid).text(this.ename(s.eid).slice(0, 22)); });
    const facts: any[] = [...S.facts.values()].filter((f: any) => rowY.has(f.eid));
    const off = (f: any) => { let h = 0; for (const ch of String(f.attribute)) h = (h * 31 + ch.charCodeAt(0)) % 7; return (h - 3) * 1.6; };
    const pos = (f: any) => ({ x: x(f.valid != null ? Math.max(2019.6, Math.min(2030.9, +f.valid)) : 2019.7), y: rowY.get(f.eid)! + off(f) });
    d3.group(facts, (f: any) => f.eid + "|" + f.attribute).forEach((fs: any[]) => {
      fs.sort((a, b) => a.seq - b.seq);
      for (let i = 1; i < fs.length; i++) { const a = pos(fs[i - 1]), b = pos(fs[i]); svg.append("path").attr("class", "chain" + (fs[i].status === "update" ? " update" : fs[i].status === "conflict" ? " conflict" : "")).attr("d", `M${a.x},${a.y} C${(a.x + b.x) / 2},${a.y - 10} ${(a.x + b.x) / 2},${b.y - 10} ${b.x},${b.y}`); }
    });
    svg.append("g").selectAll("path").data(facts, (d: any) => d.fid).join("path").attr("class", (d: any) => "fact" + (d.fresh ? " new" : "")).attr("data-eid", (d: any) => d.eid)
      .attr("d", (d: any) => d3.symbol().type(d.family === "lifecycle" ? d3.symbolSquare : d.family === "milestone" ? d3.symbolDiamond : d3.symbolCircle).size(d.fresh ? 110 : 70)())
      .attr("transform", (d: any) => { const p = pos(d); return `translate(${p.x},${p.y})`; }).attr("fill", (d: any) => MOD[d.modality] || css("--muted")).attr("fill-opacity", (d: any) => (d.valid == null ? 0.35 : 0.9))
      .on("mousemove", (e: MouseEvent, d: any) => this.tip(e, `<b>${esc(d.name)}</b> · ${esc(d.attribute)} (${d.family})<br>value <b>${esc(d.value)}</b>${d.valid != null ? " · valid " + (+d.valid).toFixed(2) : " · no time"}<br>${d.modality} · ${d.status}${d.related ? " of " + d.related : ""}`)).on("mouseleave", this.hideTip);
    const lab = svg.append("g");
    facts.filter((f) => f.fresh || f.family === "metric").forEach((f) => { const p = pos(f); lab.append("text").attr("x", p.x + 6).attr("y", p.y - 6).attr("font-size", 9).attr("class", f.fresh ? "" : "muted").text(String(f.value).slice(0, 14)); });
    S.facts.forEach((f: any) => (f.fresh = false));
    this.els.counts.c5.textContent = `${S.subjects.size} subjects · ${S.facts.size} facts`;
  }

  // ------------------------------------------------------------ 구조 간 연결
  private crossLink(eid: string, from: keyof Els["panels"]) {
    if (!this.beams || !eid) return;
    const fromEl = this.els.panels[from].querySelector(`[data-eid="${eid}"]`);
    if (!fromEl) return;
    const targets = (["k3", "k4", "k5"] as const).filter((p) => p !== from).map((p) => this.els.panels[p].querySelector(`[data-eid="${eid}"]`)).filter(Boolean) as Element[];
    targets.slice(0, 3).forEach((t) => this.beam(fromEl, t, css("--ink"), true));
    if (targets.length) this.log("m", `shared subject: ${this.ename(eid)} ↔ ${targets.length} other structure(s)`);
  }
  private beam(fromEl: Element, toEl: Element, color: string, shared = false) {
    const main = this.els.root.getBoundingClientRect(), a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const x1 = a.left + a.width / 2 - main.left, y1 = a.top + a.height / 2 - main.top, x2 = b.left + b.width / 2 - main.left, y2 = b.top + b.height / 2 - main.top;
    const p = d3.select(this.els.links).append("path").attr("class", "beam").attr("stroke", color).attr("d", `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`);
    const L = (p.node() as SVGPathElement).getTotalLength(); p.attr("stroke-dasharray", L).attr("stroke-dashoffset", L);
    p.transition().duration(shared ? 500 : 350).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0).transition().delay(shared ? 900 : 500).duration(500).style("opacity", 0).remove();
  }

  // ------------------------------------------------------------ 측면
  renderProgress() {
    const S = this.S, t = S.docsTotal || 0;
    this.els.progress.textContent = `${S.docsDone} / ${t} documents`;
    this.els.bar.style.width = t ? (100 * S.docsDone) / t + "%" : "0";
    this.onProgress?.(S.docsDone, t);
  }
  renderStats() {
    const S = this.S;
    this.els.counts.c1.textContent = `${S.passages} passages`;
    const rows = [["K0 terms", S.terms.length], ["K1 passages (new / dup / irr)", `${S.byStatus.new || 0} / ${S.byStatus.duplicate || 0} / ${S.byStatus.irrelevant || 0}`], ["shared subjects", S.ents.size],
      ["K2 themes · areas", `${S.themes.size} · ${S.areas.size}`], ["K4 relations", S.gedges.size], ["K5 facts", S.facts.size], ["opportunity candidates (→ cards)", S.opps.size]];
    this.els.stats.innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join("");
    const sh = Object.entries(S.share) as [string, any][];
    this.els.share.innerHTML = `<tr><th>type</th><th>n</th><th>tree</th><th>graph</th><th>time</th><th>opps</th></tr>` +
      sh.map(([k, v]) => `<tr><td>${k}</td><td>${v.n}</td>${["tree", "graph", "time", "grid"].map((s) => `<td>${Math.round((100 * v[s]) / v.n)}%</td>`).join("")}</tr>`).join("");
  }
  relayout() { this.renderTree(); this.renderGrid(); this.renderTime(); }
}
