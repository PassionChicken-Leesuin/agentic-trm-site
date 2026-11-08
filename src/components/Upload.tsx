"use client";

import { useMemo, useState } from "react";
import Reveal from "./Reveal";
import type { Meta } from "@/lib/data";

const ACCEPT = ".pdf,.html,.htm,.md,.markdown,.txt,.docx";
const MAX_FILES = 30;

/**
 * 문서 단계. 왼쪽은 내 문서(서버 모드에서만: 회사 이름 + 파일), 오른쪽은 준비된 IonQ 180건.
 * 내부 문서(메모·회의록·이메일)는 파일 이름에 internal/memo/minutes/email 이 있으면 자동으로, 아니면 목록에서 표시한다.
 */
export default function Upload({ meta, serverOk, busy, error, onPrepared, onUpload }: {
  meta: Meta | null; serverOk: boolean; busy: boolean; error: string | null;
  onPrepared: () => void; onUpload: (files: File[], company: string, internal: string[]) => void;
}) {
  const [over, setOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [company, setCompany] = useState("");
  const [internal, setInternal] = useState<Set<string>>(new Set());
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    meta?.documents.forEach((d) => m.set(d.is_synthetic ? "internal (synthetic)" : d.source_type, (m.get(d.is_synthetic ? "internal (synthetic)" : d.source_type) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [meta]);
  const years = useMemo(() => { const ys = (meta?.documents || []).map((d) => +d.date.slice(0, 4)); return ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : ""; }, [meta]);

  const addFiles = (list: FileList | File[]) => {
    const ok = [...list].filter((f) => ACCEPT.split(",").some((e) => f.name.toLowerCase().endsWith(e)));
    const merged = [...files, ...ok.filter((f) => !files.some((g) => g.name === f.name && g.size === f.size))].slice(0, MAX_FILES);
    setFiles(merged);
    const auto = new Set(internal);
    ok.forEach((f) => { if (/internal|memo|minutes|meeting|e-?mail|confidential/i.test(f.name)) auto.add(f.name); });
    setInternal(auto);
  };
  const toggle = (name: string) => { const s = new Set(internal); if (s.has(name)) s.delete(name); else s.add(name); setInternal(s); };
  const remove = (name: string) => { setFiles(files.filter((f) => f.name !== name)); const s = new Set(internal); s.delete(name); setInternal(s); };
  const canStart = serverOk && !busy && files.length > 0 && company.trim().length > 1;
  const totalKb = Math.round(files.reduce((a, f) => a + f.size, 0) / 1024);

  return (
    <section>
      <Reveal>
        <div className="flex items-center gap-4"><p className="label">01 / 04 · Documents</p><span className="h-px w-16 bg-hairline" aria-hidden="true" /></div>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="display mt-6 text-[clamp(1.8rem,4.4vw,3rem)] leading-[1.15]">Give the agent a company&rsquo;s documents.</h1>
      </Reveal>
      <Reveal delay={160}>
        <p className="mt-5 max-w-xl text-[0.95rem] leading-[1.85] text-body">
          Filings, blog posts, press releases, papers, internal memos. The agent reads them in date order, decides passage by passage
          which knowledge structure each fact belongs to, and assembles the knowledge base you will watch grow on the next screen.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <Reveal delay={240}>
          <div
            className="drop"
            data-over={over}
            data-disabled={!serverOk}
            onDragOver={(e) => { e.preventDefault(); if (serverOk) setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (serverOk) addFiles(e.dataTransfer.files); }}
          >
            <p className="label">Your documents</p>
            {serverOk ? (
              <>
                <label className="mt-4 block text-xs text-muted">Company the documents are about
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Veltra Energy"
                    maxLength={80}
                    className="mt-1 w-full border border-hairline bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                  />
                </label>
                <p className="mt-4 text-sm text-body">Drop PDF, HTML, DOCX, Markdown or text files here, or choose them below.</p>
                <p className="mt-1 text-xs text-muted">Up to {MAX_FILES} documents per session. Dates are read from file names (YYYY-MM-DD) or the text; mark internal documents so they are shown as such.</p>
              </>
            ) : (
              <p className="mt-4 text-xs text-muted">Available when the site runs with its agent server (NEXT_PUBLIC_API). This copy replays a recorded session instead.</p>
            )}
            {files.length > 0 && (
              <ul className="mt-4 max-h-56 overflow-auto border-t border-hairline-soft text-xs">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 border-b border-hairline-soft py-1.5">
                    <span className="min-w-0 flex-1 truncate text-ink" title={f.name}>{f.name}</span>
                    <span className="text-muted">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                    <label className="flex items-center gap-1 text-muted"><input type="checkbox" checked={internal.has(f.name)} onChange={() => toggle(f.name)} className="accent-[var(--ink)]" />internal</label>
                    <button className="text-muted hover:text-ink" onClick={() => remove(f.name)} aria-label={`remove ${f.name}`}>×</button>
                  </li>
                ))}
                <li className="py-1.5 text-muted">{files.length} file(s) · {totalKb} KB · {internal.size} internal</li>
              </ul>
            )}
            {error && <p className="mt-3 text-xs" style={{ color: "var(--why)" }}>{error}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label className="btn" aria-disabled={!serverOk || busy}>
                Choose files
                <input type="file" multiple accept={ACCEPT} disabled={!serverOk || busy} className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
              </label>
              <button className="btn" data-primary="true" disabled={!canStart} onClick={() => onUpload(files, company.trim(), [...internal])}>
                {busy ? "Uploading…" : "Build the knowledge base →"}
              </button>
              {serverOk && files.length > 0 && company.trim().length <= 1 && <span className="text-xs text-muted">Enter the company name first.</span>}
            </div>
            {serverOk && <p className="mt-4 text-[11px] leading-relaxed text-muted">The run takes roughly 1–2 minutes per document for reading and routing, then a few minutes for consolidation, the card debate and roadmap writing. Keep this tab open.</p>}
          </div>
        </Reveal>
        <Reveal delay={320}>
          <div className="border border-hairline bg-[color-mix(in_oklab,var(--surface-card)_92%,transparent)] p-8">
            <p className="label">Prepared corpus</p>
            <h2 className="display mt-3 text-2xl">IonQ · {meta?.planned_total ?? meta?.documents.length ?? 180} documents</h2>
            <p className="mt-2 text-xs text-muted">{years} · public documents plus fictional internal memos</p>
            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-body">
              {byType.map(([k, n]) => (<li key={k} className="flex justify-between border-b border-hairline-soft py-1"><span>{k}</span><b className="font-medium text-ink">{n}</b></li>))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-muted">The internal memos (customer emails, technical assessments) are synthetic. Figures, customer and supplier names in them are not real.</p>
            <div className="mt-6"><button className="btn" data-primary="true" onClick={onPrepared} disabled={busy}>Try with the 180 prepared IonQ documents →</button></div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
