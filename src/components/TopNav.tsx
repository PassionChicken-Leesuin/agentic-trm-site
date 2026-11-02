"use client";

import Mark from "./Mark";
import { STAGE_LABELS, STEPS, type Stage } from "./views";

/** 상단 바. 왼쪽 마크+이름, 가운데 단계, 오른쪽 링크와 시작 버튼. */
export default function TopNav({ stage, reached, onChange, onStart }: { stage: Stage; reached: Set<Stage>; onChange: (s: Stage) => void; onStart: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-hairline-soft bg-[color-mix(in_oklab,var(--canvas)_78%,transparent)] backdrop-blur-[6px]">
      <nav aria-label="Site" className="mx-auto flex max-w-[1700px] items-center gap-6 px-5 py-3 sm:px-8">
        <button type="button" onClick={() => onChange("gate")} className="flex cursor-pointer items-center gap-3 text-ink">
          <Mark className="h-6 w-6" />
          <span className="text-[13.5px] font-medium tracking-[-0.01em]">Agentic TRM</span>
        </button>
        <ol className="ml-4 hidden items-center gap-1 md:flex">
          {STEPS.map((key, i) => {
            const ok = reached.has(key);
            return (
              <li key={key}>
                <button type="button" disabled={!ok} onClick={() => onChange(key)} data-active={stage === key}
                  className="btn-ghost text-xs disabled:opacity-35 data-[active=true]:text-ink">
                  <span className="label mr-2 !text-[9px]">{String(i + 1).padStart(2, "0")}</span>{STAGE_LABELS[key]}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="ml-auto flex items-center gap-4">
          <a className="btn-ghost text-xs" href="https://github.com/PassionChicken-Leesuin/agentic-trm-site" target="_blank" rel="noopener noreferrer">GitHub</a>
          <button className="btn" data-primary="true" onClick={onStart} style={{ padding: "0.55em 1em", fontSize: 12.5 }}>Start with IonQ documents</button>
        </div>
      </nav>
    </header>
  );
}
