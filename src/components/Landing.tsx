"use client";

import dynamic from "next/dynamic";
import Reveal from "./Reveal";

const RoadmapScene = dynamic(() => import("./scene/RoadmapScene"), { ssr: false });

/** 첫 화면. 큰 제목, 오른쪽 설명과 버튼, 그 아래 등각 로드맵 판. */
export default function Landing({ onStart, onUpload, docCount }: { onStart: () => void; onUpload: () => void; docCount: number }) {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-6 pb-16 pt-28 sm:px-10">
      <Reveal><p className="label">A living knowledge base for technology roadmapping</p></Reveal>
      <Reveal delay={90}>
        <h1 className="display hero-title-lg mt-6">
          See how a firm-specific{" "}<br className="hidden sm:inline" />knowledge base is built{" "}<br className="hidden sm:inline" />for agentic roadmapping.
        </h1>
      </Reveal>
      <div className="mt-10 grid gap-10 md:grid-cols-[1.25fr_1fr] md:items-start">
        <div className="hidden md:block" aria-hidden="true" />
        <div>
          <Reveal delay={160}>
            <p className="max-w-md text-[1.05rem] leading-[1.6] text-body">
              An agent reads a company&rsquo;s documents and organizes what it finds into connected knowledge structures.
              Passages provide evidence, themes reveal trends, opportunities become cards, relations map connections,
              and dates show how things unfold over time. Watch the knowledge base take shape.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button className="btn" data-primary="true" onClick={onUpload}>Upload documents →</button>
              <button className="text-sm text-body underline decoration-hairline underline-offset-4 hover:text-ink" onClick={onStart}>or watch a recorded run on {docCount || 180} IonQ documents</button>
            </div>
          </Reveal>
        </div>
      </div>

      <Reveal delay={320} className="mt-8">
        <div className="hero-scene">
          <RoadmapScene />
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="pill"><i />This roadmap is a sketch of the output. Hover a block on the next screens to trace it to its sources.</span>
          </div>
        </div>
      </Reveal>

      <div className="mt-20 grid gap-6 border-t border-hairline pt-10 md:grid-cols-4">
        {[
          ["01", "Documents", "Filings, blogs, papers, memos — in date order."],
          ["02", "Knowledge structures", "The Router decides, passage by passage, where each fact lives: evidence, themes, relations, dates."],
          ["03", "Opportunity cards", "One card per opportunity, assembled from the structures — a topic roadmap each."],
          ["04", "Roadmap", "Models debate which opportunities lead; the agent writes the roadmap from those cards and cites it."],
        ].map(([n, h, p], i) => (
          <Reveal key={n} delay={80 * i}>
            <div>
              <p className="label">{n}</p>
              <h3 className="mt-2 text-lg font-medium text-ink">{h}</h3>
              <p className="mt-1 text-sm leading-relaxed text-body">{p}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
