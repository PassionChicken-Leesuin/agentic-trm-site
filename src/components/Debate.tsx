"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Reveal from "./Reveal";
import { stepIndex } from "./views";
import type { Debate as DebateData, DebateRecord } from "@/lib/data";
import type { CardV2, Selection } from "./RoadmapView";

/**
 * 04 · 에이전트 토론. 세 에이전트가 둥근 탁자에 앉아 카드마다 세 질문(why go / where are we / can we get there)에 점수를 매긴다.
 * 기록된 토론을 카드 하나씩 재생한다: 카드 제시 → 1라운드 점수·이유 → 2라운드 답변 → 최종 점수(바뀐 값은 화살표).
 * 오른쪽 순위표는 토론이 끝난 카드부터 채워지고, 선정(상위 10)이 나오면 표시된다. 서버 작업은 토론 중에도 기록이 늘어나므로 들어오는 대로 이어 재생한다.
 */
const Q: { key: "q1" | "q2" | "q3"; short: string; colour: string }[] = [
  { key: "q1", short: "why go", colour: "var(--why)" },
  { key: "q2", short: "where now", colour: "var(--what)" },
  { key: "q3", short: "path", colour: "var(--how)" },
];
const AGENT_LABEL: Record<string, string> = { "gpt-4.1": "Agent A · GPT-4.1", "claude-sonnet-4.6": "Agent B · Claude Sonnet 4.6", "gemini-2.5-flash": "Agent C · Gemini 2.5 Flash" };
const SEAT = [
  { left: "4%", top: "6%" },           // 왼쪽 위
  { right: "4%", top: "6%" },          // 오른쪽 위
  { left: "50%", bottom: "2%", transform: "translateX(-50%)" },   // 아래 가운데
] as const;
const STEP_MS = [900, 2600, 2600, 1800];   // 카드 제시 · 1라운드 · 2라운드 · 최종

function cut(s: string | undefined, n: number) { return !s ? "" : s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s; }

export default function Debate({ cards, debate, selection, live, waiting, onNext }: {
  cards: CardV2[]; debate: DebateData | null; selection: Selection | null; live: boolean; waiting?: string | null; onNext: () => void;
}) {
  const records = useMemo(() => debate?.records ?? [], [debate]);
  const models = useMemo(() => debate?.models?.length ? debate.models : ["gpt-4.1", "claude-sonnet-4.6", "gemini-2.5-flash"], [debate]);
  const cardOf = useMemo(() => new Map(cards.map((c) => [c.eid, c])), [cards]);
  const selected = useMemo(() => new Set(selection?.stances.balanced?.selected ?? []), [selection]);
  const rankOf = useMemo(() => { const m = new Map<string, number>(); (selection?.stances.balanced?.order ?? []).forEach((e, i) => m.set(e, i + 1)); return m; }, [selection]);
  const total = Math.max(debate?.total ?? 0, records.length, cards.length);
  const finished = !!debate?.done && !!selection?.stances.balanced;

  // 재생 커서: 몇 번째 기록의 몇 번째 단계를 보여 주는가. idx === records.length 이면 다 재생함(기록이 더 오면 이어 간다).
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);   // 순위표에서 고른 카드 (재생 멈추고 그 토론을 보여 줌)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!playing || picked || idx >= records.length) return;
    timer.current = setTimeout(() => {
      if (step < 3) setStep(step + 1);
      else { setIdx(idx + 1); setStep(0); }
    }, STEP_MS[step]);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, picked, idx, step, records.length]);

  const skip = () => { setIdx(records.length); setStep(3); setPlaying(true); setPicked(null); };
  const replay = () => { setIdx(0); setStep(0); setPlaying(true); setPicked(null); };
  const donePlaying = idx >= records.length;
  const shown: DebateRecord | null = picked ? records.find((r) => r.eid === picked) ?? null : donePlaying ? records[records.length - 1] ?? null : records[idx] ?? null;
  const shownStep = picked || donePlaying ? 3 : step;
  const completed = donePlaying ? records.length : idx;   // 순위표에 올라온 기록 수
  const board = useMemo(() => {
    const rows = records.slice(0, completed).map((r) => ({ ...r, score: r.profile.q1 + r.profile.q2 + r.profile.q3 }));
    rows.sort((a, b) => (rankOf.get(a.eid) ?? 999) - (rankOf.get(b.eid) ?? 999) || b.score - a.score);
    return rows;
  }, [records, completed, rankOf]);

  return (
    <section>
      <Reveal>
        <div className="flex items-center gap-4"><p className="label">{stepIndex("debate")} · Agent debate</p><span className="h-px w-16 bg-hairline" aria-hidden="true" /></div>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="display mt-6 text-[clamp(1.8rem,4.4vw,3rem)] leading-[1.15]">Three agents debate and score every card.</h1>
      </Reveal>
      <Reveal delay={160}>
        <p className="mt-5 max-w-2xl text-[0.95rem] leading-[1.85] text-body">
          Each opportunity card goes to a panel of three AI agents, each on a different model. Every agent first scores the card alone on the three
          questions a roadmapping workshop asks (Phaal &amp; Palmer, 2010): why should the company go for it, where is it now, and can it get there.
          Then each agent reads the other two assessments and replies, keeping or changing its scores. Only scores backed by evidence in the card
          count towards the average; the ten cards with the best averages are selected for the roadmap.
        </p>
      </Reveal>

      <Reveal delay={240}>
        <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="label">{live && !debate?.done ? "Debating live" : "Recorded debate"}</span>
          <span className="h-px w-8 bg-hairline" aria-hidden="true" />
          <span>{Math.min(completed, records.length)} of {total} cards scored{live && !debate?.done ? ` · ${records.length} debated so far on the server` : ""}</span>
          {live && !debate?.done && <span className="spin" aria-hidden="true" />}
          <div className="ml-auto flex items-center gap-2">
            {playing && !donePlaying && !picked
              ? <button className="btn" onClick={() => setPlaying(false)}>Pause</button>
              : <button className="btn" onClick={() => { setPicked(null); setPlaying(true); if (donePlaying) replay(); }}>{donePlaying || picked ? "Replay" : "Resume"}</button>}
            <button className="btn" onClick={skip} disabled={donePlaying || records.length === 0}>Skip to end</button>
          </div>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* 둥근 탁자: 가운데 카드, 양옆과 아래에 세 에이전트 (격자라 어떤 폭에서도 겹치지 않음) */}
        <Reveal delay={300}>
          <div className="relative min-h-[560px] overflow-hidden border border-hairline bg-[color-mix(in_oklab,var(--surface-card)_92%,transparent)] p-5" style={{ borderRadius: 12 }}>
            <div aria-hidden="true" className="absolute left-1/2 top-[46%] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-hairline opacity-60" />
            {!shown && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                {live ? <><span className="spin mr-2" aria-hidden="true" />Waiting for the first card to be debated…</> : "No recorded debate in this copy."}
              </div>
            )}
            {shown && (() => {
              const seat = (m: string, extra = "") => {
                const side = shown.models[m];
                const view = shownStep >= 3 ? side?.final : side?.r1;
                return (
                  <div className={`relative text-xs ${extra}`}>
                    <p className="label">{AGENT_LABEL[m] ?? m}</p>
                    {!side && <p className="mt-1 text-muted">—</p>}
                    {side && shownStep === 0 && <p className="mt-1 text-muted">reading the card…</p>}
                    {side && shownStep >= 1 && view && (
                      <div className="mt-1 border border-hairline-soft bg-[var(--canvas)] p-3" style={{ borderRadius: 8 }}>
                        <p>
                          {Q.map((q) => {
                            const a = side.r1[q.key], b = side.final[q.key];
                            return (
                              <span key={q.key} className="mr-3" style={{ color: q.colour }}>
                                {q.short} {shownStep >= 3 && b !== a ? <><span className="text-muted line-through">{a}</span> → {b}</> : shownStep >= 3 ? b : a}
                              </span>
                            );
                          })}
                          {shownStep >= 3 && side.final.changed && <span className="label ml-1">revised</span>}
                        </p>
                        {shownStep === 1 && <p className="mt-2 leading-relaxed text-body">{cut(side.r1.reasons?.q1, 190)}</p>}
                        {shownStep === 2 && (
                          <div className="mt-2 leading-relaxed text-body">
                            <p className="label">reply to the others</p>
                            {(side.final.replies ?? []).slice(0, 2).map((r, k) => <p key={k} className="mt-1">{cut(r, 140)}</p>)}
                            {!(side.final.replies ?? []).length && <p className="mt-1 text-muted">no reply recorded</p>}
                          </div>
                        )}
                        {shownStep >= 3 && <p className="mt-2 leading-relaxed text-body">{cut(side.final.reasons?.q1, 160)}</p>}
                      </div>
                    )}
                  </div>
                );
              };
              return (
                <div className="relative grid items-start gap-5" style={{ gridTemplateColumns: "minmax(0,1fr) 250px minmax(0,1fr)" }}>
                  {seat(models[0])}
                  <div key={shown.eid} className="view-enter border border-hairline bg-[var(--canvas)] p-4 text-center" style={{ borderRadius: 10 }}>
                    <p className="label">Card {Math.min((picked ? records.findIndex((r) => r.eid === picked) : idx) + 1, records.length)} of {total}</p>
                    <p className="mt-2 text-sm text-ink">{shown.name}</p>
                    {cardOf.get(shown.eid) && (
                      <p className="label mt-2">{cardOf.get(shown.eid)!.kind === "product_type" ? "product" : "application"} · {cardOf.get(shown.eid)!.docs_public}+{cardOf.get(shown.eid)!.docs_internal}i docs</p>
                    )}
                    {shownStep >= 3 && (
                      <p className="mt-3 text-xs">
                        {Q.map((q) => <span key={q.key} className="mr-2" style={{ color: q.colour }}>{q.short} {shown.profile[q.key]}</span>)}
                        {selected.has(shown.eid) && <span className="label ml-1 text-ink">· selected</span>}
                      </p>
                    )}
                  </div>
                  {seat(models[1])}
                  <div className="col-span-3 flex justify-center pt-2">{seat(models[2] ?? models[0], "w-full max-w-[520px]")}</div>
                  <p className="label col-span-3 pt-2">
                    {shownStep === 0 ? "card presented" : shownStep === 1 ? "round 1 · independent scores" : shownStep === 2 ? "round 2 · replies" : "final scores"}
                  </p>
                </div>
              );
            })()}
          </div>
        </Reveal>

        {/* 순위표 */}
        <Reveal delay={360}>
          <div className="border border-hairline p-4" style={{ borderRadius: 12 }}>
            <p className="label">Scoreboard · average of grounded scores</p>
            <p className="mt-1 text-xs text-muted">{finished ? "Top 10 selected for the roadmap (balanced stance)." : live && !debate?.done ? "Ranking appears when every card has been debated." : "Rows fill in as each card is scored."}</p>
            <ol className="mt-3 max-h-[470px] divide-y divide-hairline-soft overflow-auto text-xs">
              {board.map((r, i) => {
                const rk = rankOf.get(r.eid);
                return (
                  <li key={r.eid}>
                    <button className="flex w-full items-baseline gap-2 py-1.5 text-left hover:text-ink" data-on={picked === r.eid} onClick={() => { setPicked(picked === r.eid ? null : r.eid); setPlaying(false); }}>
                      <span className="label w-6 text-muted">{String(rk ?? i + 1).padStart(2, "0")}</span>
                      <span className={`flex-1 truncate ${selected.has(r.eid) ? "text-ink" : "text-body"}`}>{r.name}</span>
                      {Q.map((q) => <span key={q.key} className="w-7 text-right" style={{ color: q.colour }}>{r.profile[q.key]}</span>)}
                      {finished && <span className="label ml-1 w-16 text-right !text-[8.5px]">{selected.has(r.eid) ? "selected" : ""}</span>}
                    </button>
                  </li>
                );
              })}
              {board.length === 0 && <li className="py-2 text-muted">—</li>}
            </ol>
          </div>
        </Reveal>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        {finished
          ? <button className="btn" data-primary="true" onClick={onNext}>See the selected cards and the roadmap →</button>
          : <span className="flex items-center gap-3 text-sm text-muted"><span className="spin" aria-hidden="true" />{waiting || (live ? "The agents are still debating; the selection appears when every card has been scored." : "No selection in this copy.")}</span>}
        {finished && waiting && <span className="flex items-center gap-2 text-xs text-muted"><span className="spin" aria-hidden="true" />{waiting}</span>}
      </div>
    </section>
  );
}
