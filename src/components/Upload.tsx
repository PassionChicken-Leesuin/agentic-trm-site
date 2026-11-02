"use client";

import { useMemo, useState } from "react";
import Reveal from "./Reveal";
import type { Meta } from "@/lib/data";

/**
 * 문서 단계. 왼쪽은 내 문서(서버 모드에서만), 오른쪽은 준비된 IonQ 180건.
 */
export default function Upload({ meta, serverOk, onPrepared, onUpload }: { meta: Meta | null; serverOk: boolean; onPrepared: () => void; onUpload: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    meta?.documents.forEach((d) => m.set(d.is_synthetic ? "internal (synthetic)" : d.source_type, (m.get(d.is_synthetic ? "internal (synthetic)" : d.source_type) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [meta]);
  const years = useMemo(() => { const ys = (meta?.documents || []).map((d) => +d.date.slice(0, 4)); return ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : ""; }, [meta]);

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
          which of five knowledge structures each fact belongs to, and assembles the knowledge base you will watch grow on the next screen.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <Reveal delay={240}>
          <div
            className="drop"
            data-over={over}
            data-disabled={!serverOk}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (serverOk) setFiles([...e.dataTransfer.files]); }}
          >
            <p className="label">Your documents</p>
            <p className="mt-4 text-sm text-body">Drop PDF, HTML, Markdown or text files here.</p>
            <p className="mt-2 text-xs text-muted">{serverOk ? "Up to 30 documents per session." : "Available when the site runs with its agent server. This static copy replays a recorded session instead."}</p>
            {files.length > 0 && <p className="mt-4 text-xs text-ink">{files.length} file(s) selected</p>}
            <div className="mt-6">
              <label className="btn" aria-disabled={!serverOk}>
                Choose files
                <input type="file" multiple disabled={!serverOk} className="hidden" onChange={(e) => setFiles([...(e.target.files || [])])} />
              </label>
              <button className="btn ml-3" data-primary="true" disabled={!serverOk || !files.length} onClick={() => onUpload(files)}>Upload complete →</button>
            </div>
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
            <div className="mt-6"><button className="btn" data-primary="true" onClick={onPrepared}>Try with the 180 prepared IonQ documents →</button></div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
