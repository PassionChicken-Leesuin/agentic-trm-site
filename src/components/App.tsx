"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Landing from "./Landing";
import Frame from "./Frame";
import TopNav from "./TopNav";
import ScrollProgress from "./ScrollProgress";
import Upload from "./Upload";
import Build, { type Source } from "./Build";
import Cards from "./Cards";
import RoadmapView, { type Roadmaps, type Selection, type CardV2 } from "./RoadmapView";
import type { Candidates } from "./Cards";
import { isStage, type Stage } from "./views";
import { API, STATIC_REF, createJob, getJob, loadEvents, loadJSON, loadMeta, rememberRun, resultLink, serverAvailable, waitJob, type JobState, type Meta, type RunRef } from "@/lib/data";

/** 깊은 링크: ?stage=upload|build|cards|roadmap (시연·점검용). build 는 아래 효과에서 준비된 문서로 시작한다. */
function stageFromUrl(): Stage {
  if (typeof window === "undefined") return "gate";
  const q = new URLSearchParams(window.location.search).get("stage");
  return isStage(q) && q !== "build" ? q : "gate";
}

export default function App() {
  const [stage, setStage] = useState<Stage>(stageFromUrl);
  const [reached, setReached] = useState<Set<Stage>>(() => (stageFromUrl() === "gate" ? new Set<Stage>(["upload"]) : new Set<Stage>(["upload", "build", "cards", "roadmap"])));
  const [ref, setRef] = useState<RunRef>(STATIC_REF);           // 지금 보고 있는 run (준비된 IonQ 또는 업로드 작업)
  const [meta, setMeta] = useState<Meta | null>(null);
  const [serverOk, setServerOk] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [roadmaps, setRoadmaps] = useState<Roadmaps | null>(null);
  const [roadmapsV2, setRoadmapsV2] = useState<Roadmaps | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [cardsV2, setCardsV2] = useState<CardV2[]>([]);
  const [candidates, setCandidates] = useState<Candidates | null>(null);
  const [job, setJob] = useState<JobState | null>(null);        // 업로드 작업 상태 (서버 모드)
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);  // 구축이 끝난 뒤 카드·로드맵을 기다리는 동안의 안내문
  const jobRef = useRef<string | null>(null);

  const go = useCallback((s: Stage) => {
    setReached((r) => new Set([...r, s]));
    setStage(s);
    window.history.pushState({ stage: s }, "", window.location.href);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  /** run 의 카드·선정·로드맵 파일을 읽는다 (정적이든 서버든 같은 파일 이름). */
  const loadOutputs = useCallback(async (r: RunRef) => {
    const [rm, rm2, sel, cards, cand] = await Promise.all([
      loadJSON<Roadmaps>(r, "roadmaps.json"), loadJSON<Roadmaps>(r, "roadmaps_v2.json"), loadJSON<Selection>(r, "selection.json"),
      loadJSON<CardV2[]>(r, "cards_v2.json"), loadJSON<Candidates>(r, "candidates.json"),
    ]);
    setRoadmaps(rm); setRoadmapsV2(rm2); setSelection(sel); setCardsV2(cards ?? []); setCandidates(cand);
  }, []);

  const startPrepared = useCallback(async () => {
    // 먼저 화면을 바꾸고 나서 사건 파일(수 MB)을 읽는다 — 첫 화면에서 멈춘 것처럼 보이지 않게
    setRef(STATIC_REF); setJob(null); jobRef.current = null;
    setReached((r) => new Set([...r, "upload", "build"]));
    go("build");
    const [m, events] = await Promise.all([loadMeta(STATIC_REF), loadEvents(STATIC_REF)]);
    setMeta(m);
    await loadOutputs(STATIC_REF);
    setSource({ kind: "static", events });
  }, [go, loadOutputs]);

  /** 서버 모드: 만들어진 작업(run)을 연다 — 업로드 직후와 ?job= 깊은 링크가 같은 길을 쓴다. */
  const openJob = useCallback(async (run: string) => {
    const r: RunRef = { kind: "server", run };
    const [state, m] = await Promise.all([getJob(run), loadMeta(r)]);
    setRef(r); setJob(state); jobRef.current = run;
    setRoadmaps(null); setRoadmapsV2(null); setSelection(null); setCardsV2([]); setCandidates(null);
    setMeta(m);
    setSource({ kind: "server", run });
    setReached(new Set<Stage>(["upload", "build"]));
    go("build");
  }, [go]);

  useEffect(() => {
    // ?job= 링크로 들어온 경우 IonQ 데모 정보를 읽지 않는다: 늦게 도착하면 작업 정보(회사·문서 수)를 덮어쓰기 때문
    const viaJob = typeof window !== "undefined" && !!new URLSearchParams(window.location.search).get("job") && !!API;
    if (!viaJob) loadMeta(STATIC_REF).then((m) => { if (jobRef.current === null) setMeta(m); }).catch(() => setMeta(null));
    serverAvailable().then(setServerOk);
    // 준비된 run 의 산출물과 깊은 링크 ?stage=build (준비된 문서로 바로 시작) — 다음 틱에서, 렌더 중 갱신이 아니게
    // ?job=<run> (서버 모드): 이미 만든 업로드 작업을 다시 연다 — 시연·점검용
    const t = setTimeout(() => {
      const q = new URLSearchParams(window.location.search);
      const jobRun = q.get("job");
      if (jobRun && API) { void openJob(jobRun); return; }
      void loadOutputs(STATIC_REF);
      if (q.get("stage") === "build") void startPrepared();
    }, 0);
    return () => clearTimeout(t);
  }, [startPrepared, loadOutputs, openJob]);

  // 서버 작업을 보는 동안 상태(대기 순번·단계)를 주기적으로 다시 읽는다
  useEffect(() => {
    if (ref.kind !== "server") return;
    const run = ref.run;
    let stop = false;
    const tick = async () => {
      const s = await getJob(run);
      if (stop) return;
      if (s) setJob(s);
      if (!s || (s.status !== "done" && s.status !== "error")) setTimeout(tick, 4000);
    };
    const t = setTimeout(tick, 4000);
    return () => { stop = true; clearTimeout(t); };
  }, [ref]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => { const s = (e.state as { stage?: unknown } | null)?.stage; setStage(isStage(s) ? s : "gate"); window.scrollTo({ top: 0, behavior: "auto" }); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** 서버 모드: 문서를 올려 작업(run)을 만들고, 그 run 의 사건을 실시간으로 따라간다. */
  const startUpload = async (files: File[], company: string, internal: string[]) => {
    setUploading(true); setUploadError(null);
    try {
      const state = await createJob(company, files, { internal, onProgress: (n, t) => setUploadMsg(n < t ? `Uploading ${n} / ${t} files…` : `Converting ${t} files…`) });
      rememberRun({ run: state.run, company, docs: state.documents?.length ?? files.length, at: new Date().toISOString() });
      window.history.replaceState(null, "", `/?job=${state.run}`);   // 주소창 자체가 결과 링크가 되게
      await openJob(state.run);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false); setUploadMsg(null);
    }
  };

  /** 구축 화면이 끝났을 때. 서버 run 이면 작업이 끝날 때까지 기다린 뒤 카드·로드맵을 읽는다. */
  const onBuildDone = async () => {
    if (ref.kind === "static") { go("cards"); return; }
    setWaiting("Finishing: consolidating subjects, assembling cards, panel debate, writing the roadmap…");
    const s = await waitJob(ref.run, (st) => { setJob(st); setWaiting(`${st.stage}: ${st.message || ""}`); });
    setWaiting(null);
    if (!s || s.status === "error") { setUploadError(s?.error ?? "The job ended without a result."); go("upload"); return; }
    const m = await loadMeta(ref).catch(() => null);
    if (m) setMeta(m);
    await loadOutputs(ref);
    go("cards");
  };

  const docCount = meta?.planned_total ?? meta?.documents.length ?? 180;
  const company = meta?.profile?.company ?? "IonQ";
  return (
    <>
      {stage !== "gate" && <ScrollProgress />}
      <TopNav stage={stage} reached={reached} onChange={go} onStart={startPrepared} />
      <main className={`relative z-10 w-full pb-28 ${stage === "gate" ? "" : stage === "build" ? "mx-auto max-w-[1700px] px-6 pt-24 sm:px-10" : "mx-auto max-w-5xl px-6 pt-28 sm:px-12"}`}>
        <div key={stage} className="view-enter">
          {stage === "gate" && <Landing onStart={startPrepared} onUpload={() => go("upload")} docCount={docCount} />}
          {stage === "upload" && <Upload meta={ref.kind === "static" ? meta : null} serverOk={serverOk} busy={uploading} busyText={uploadMsg} error={uploadError} onPrepared={startPrepared} onUpload={startUpload} />}
          {stage === "build" && meta && source && (
            <>
              {ref.kind === "server" && job && (
                <div className="mb-4 border border-hairline px-4 py-3 text-xs text-muted">
                  <p>
                    <span className="label mr-2">{company}</span>{job.documents?.length ?? docCount} uploaded document{(job.documents?.length ?? docCount) === 1 ? "" : "s"}{job.skipped?.length ? ` (${job.skipped.length} skipped: ${job.skipped.slice(0, 3).map((s) => s.file).join(", ")}${job.skipped.length > 3 ? ", …" : ""})` : ""}
                    {waiting && <span className="ml-3 text-ink"><span className="spin mr-2" aria-hidden="true" />{waiting}</span>}
                  </p>
                  {job.status === "queued" && (
                    <p className="mt-2 text-ink"><span className="spin mr-2" aria-hidden="true" />
                      Waiting in line{job.queue_position ? `: ${job.queue_position === 1 ? "you are next" : `${job.queue_position - 1} run(s) ahead of you`}` : ""}. Up to {job.load?.max_parallel ?? 3} runs are processed at a time; yours starts automatically.
                    </p>
                  )}
                  <p className="mt-2">
                    Your result link: <a className="text-ink underline underline-offset-2" href={`/?job=${ref.run}`}>{resultLink(ref.run)}</a>
                    <button className="btn-ghost ml-2 text-xs" onClick={() => navigator.clipboard?.writeText(resultLink(ref.run))}>Copy</button>
                  </p>
                  <p className="mt-1">Save this link to come back later; you can close this page while it runs. Anyone with the link can open these results, so share it only with people who should see them.</p>
                </div>
              )}
              <Build meta={meta} source={source} onDone={onBuildDone} live={ref.kind === "server" && job?.status !== "done" && job?.status !== "error"} />
            </>
          )}
          {stage === "build" && !source && (
            <div className="flex items-center gap-3 text-sm text-muted"><span className="spin" aria-hidden="true" />Loading the recorded session (180 documents, ~9 MB of events)…</div>
          )}
          {stage === "cards" && <Cards cards={cardsV2} candidates={candidates} onNext={() => go("roadmap")} />}
          {stage === "roadmap" && <RoadmapView data={roadmaps} v2={roadmapsV2} selection={selection} cards={cardsV2} serverOk={serverOk} />}
        </div>
      </main>
      <Frame stage={stage} />
    </>
  );
}
