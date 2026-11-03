"use client";

import { useCallback, useEffect, useState } from "react";
import Landing from "./Landing";
import Frame from "./Frame";
import TopNav from "./TopNav";
import ScrollProgress from "./ScrollProgress";
import Upload from "./Upload";
import Build, { type Source } from "./Build";
import Cards from "./Cards";
import RoadmapView, { type Roadmaps, type Selection, type CardV2 } from "./RoadmapView";
import { isStage, type Stage } from "./views";
import { DEFAULT_RUN, loadEvents, loadJSON, loadMeta, serverAvailable, type Meta } from "@/lib/data";

/** 깊은 링크: ?stage=upload|build|cards|roadmap (시연·점검용). build 는 아래 효과에서 준비된 문서로 시작한다. */
function stageFromUrl(): Stage {
  if (typeof window === "undefined") return "gate";
  const q = new URLSearchParams(window.location.search).get("stage");
  return isStage(q) && q !== "build" ? q : "gate";
}

export default function App() {
  const [stage, setStage] = useState<Stage>(stageFromUrl);
  const [reached, setReached] = useState<Set<Stage>>(() => (stageFromUrl() === "gate" ? new Set<Stage>(["upload"]) : new Set<Stage>(["upload", "build", "cards", "roadmap"])));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [serverOk, setServerOk] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [roadmaps, setRoadmaps] = useState<Roadmaps | null>(null);
  const [roadmapsV2, setRoadmapsV2] = useState<Roadmaps | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [cardsV2, setCardsV2] = useState<CardV2[]>([]);

  const go = useCallback((s: Stage) => {
    setReached((r) => new Set([...r, s]));
    setStage(s);
    window.history.pushState({ stage: s }, "", window.location.href);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const startPrepared = useCallback(async () => {
    // 먼저 화면을 바꾸고 나서 사건 파일(수 MB)을 읽는다 — 첫 화면에서 멈춘 것처럼 보이지 않게
    setReached((r) => new Set([...r, "upload", "build"]));
    go("build");
    const events = await loadEvents(DEFAULT_RUN);
    setSource({ kind: "static", events });
  }, [go]);

  useEffect(() => {
    loadMeta().then(setMeta).catch(() => setMeta(null));
    serverAvailable().then(setServerOk);
    loadJSON<Roadmaps>(DEFAULT_RUN, "roadmaps.json").then((r) => r && setRoadmaps(r));
    loadJSON<Roadmaps>(DEFAULT_RUN, "roadmaps_v2.json").then((r) => r && setRoadmapsV2(r));
    loadJSON<Selection>(DEFAULT_RUN, "selection.json").then((r) => r && setSelection(r));
    loadJSON<CardV2[]>(DEFAULT_RUN, "cards_v2.json").then((r) => r && setCardsV2(r));
    // 깊은 링크 ?stage=build — 준비된 문서로 바로 시작 (다음 틱에서, 렌더 중 갱신이 아니게)
    const t = setTimeout(() => { if (new URLSearchParams(window.location.search).get("stage") === "build") void startPrepared(); }, 0);
    return () => clearTimeout(t);
  }, [startPrepared]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => { const s = (e.state as { stage?: unknown } | null)?.stage; setStage(isStage(s) ? s : "gate"); window.scrollTo({ top: 0, behavior: "auto" }); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const startUpload = (files: File[]) => {
    // 서버 모드: 문서를 올리고 작업(run)을 만든 뒤 그 run 의 사건을 따라간다 — 서버 측 /api/v2/jobs 는 다음 단계.
    alert(`Upload mode needs the agent server (${files.length} file(s) selected). This copy replays a recorded session.`);
  };

  const docCount = meta?.planned_total ?? meta?.documents.length ?? 180;
  return (
    <>
      {stage !== "gate" && <ScrollProgress />}
      <TopNav stage={stage} reached={reached} onChange={go} onStart={startPrepared} />
      <main className={`relative z-10 w-full pb-28 ${stage === "gate" ? "" : stage === "build" ? "mx-auto max-w-[1700px] px-6 pt-24 sm:px-10" : "mx-auto max-w-5xl px-6 pt-28 sm:px-12"}`}>
        <div key={stage} className="view-enter">
          {stage === "gate" && <Landing onStart={startPrepared} docCount={docCount} />}
          {stage === "upload" && <Upload meta={meta} serverOk={serverOk} onPrepared={startPrepared} onUpload={startUpload} />}
          {stage === "build" && meta && source && <Build meta={meta} source={source} onDone={() => go("cards")} />}
          {stage === "build" && !source && (
            <div className="flex items-center gap-3 text-sm text-muted"><span className="spin" aria-hidden="true" />Loading the recorded session (180 documents, ~9 MB of events)…</div>
          )}
          {stage === "cards" && <Cards cards={cardsV2} onNext={() => go("roadmap")} />}
          {stage === "roadmap" && <RoadmapView data={roadmaps} v2={roadmapsV2} selection={selection} cards={cardsV2} serverOk={serverOk} />}
        </div>
      </main>
      <Frame stage={stage} />
    </>
  );
}
