/**
 * 데이터 출처 두 가지.
 *   static — public/data/<run>/ 의 파일을 읽어 사건을 재생한다 (Vercel 등 정적 배포).
 *   server — NEXT_PUBLIC_API 가 가리키는 FastAPI(viz.server) 에서 받는다 (업로드 모드).
 *            문서를 올리면 서버가 작업(run)을 만들고, 사건은 SSE 로, 카드·선정·로드맵은 /api/v2/runs/<run>/site/<file> 로 온다.
 */
export type KbEvent = { seq: number; ts: string; type: string } & Record<string, unknown>;

export type Doc = { id: string; title: string; date: string; source_type: string; is_synthetic: boolean };
export type Profile = { company: string; cutoff: string; horizon: [number, number]; source: "demo" | "upload"; min_year: number | null };
export type Meta = {
  run: string;
  documents: Doc[];
  planned_total: number | null;
  profile?: Profile;
  entities: Record<string, { name: string; layer?: string | null }>;
  tree: { areas: { name: string; theme_ids: string[]; trend?: string; shares?: { year: number; share: number }[] }[]; root?: unknown } | null;
  glossary: { name: string; type: string; aliases: string[]; unit?: string | null; definition: string; status: string; count: number }[];
  stats: Record<string, unknown>;
};

/** 어느 run 의 데이터를 어디서 읽는가. static 은 public/data/<run>, server 는 업로드 작업의 run. */
export type RunRef = { kind: "static"; run: string } | { kind: "server"; run: string };

export type JobState = {
  run: string;
  status: "receiving" | "queued" | "running" | "done" | "error";
  stage: string;
  message: string;
  progress: { done: number; total: number };
  stages: Record<string, { started: string; ended?: string; seconds?: number }>;
  cost_usd: number;
  error: string | null;
  company?: string;
  passages?: number;
  cards?: number;
  seconds?: number;
  documents?: (Doc & { original_name: string; n_chars: number })[];
  skipped?: { file: string; reason: string }[];
  queue_position?: number | null;                                   // 대기 줄 순번 (1부터), 진행 중이면 null
  load?: { running: number; queued: number; max_parallel: number };
  estimate_usd?: number;
};

/**
 * 결과 링크가 곧 열쇠: 작업 이름(up_<무작위>)을 아는 사람만 결과를 연다. 서버 목록에는 업로드 작업이 나오지 않는다.
 * 이 브라우저에서 만든 작업은 localStorage 에 적어 두어 업로드 화면에서 다시 열 수 있게 한다 (다른 사람에게는 보이지 않음).
 */
export type MyRun = { run: string; company: string; docs: number; at: string };
const MY_RUNS_KEY = "trm.myRuns";

export function listMyRuns(): MyRun[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(MY_RUNS_KEY) || "[]") as MyRun[]; } catch { return []; }
}

export function rememberRun(r: MyRun): void {
  if (typeof window === "undefined") return;
  const rest = listMyRuns().filter((x) => x.run !== r.run);
  try { window.localStorage.setItem(MY_RUNS_KEY, JSON.stringify([r, ...rest].slice(0, 20))); } catch { /* 저장 불가(사생활 모드 등)면 생략 */ }
}

export function resultLink(run: string): string {
  return (typeof window !== "undefined" ? window.location.origin : "") + `/?job=${run}`;
}

export const API = process.env.NEXT_PUBLIC_API ?? "";
export const DEFAULT_RUN = process.env.NEXT_PUBLIC_RUN ?? "ionq";
export const STATIC_REF: RunRef = { kind: "static", run: DEFAULT_RUN };

function url(ref: RunRef, name: string): string {
  return ref.kind === "server" ? `${API}/api/v2/runs/${ref.run}/site/${name}` : `/data/${ref.run}/${name}`;
}

export async function serverAvailable(): Promise<boolean> {
  if (!API) return false;
  try {
    const r = await fetch(`${API}/api/v2/runs`, { cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function loadMeta(ref: RunRef = STATIC_REF): Promise<Meta> {
  const r = await fetch(url(ref, "meta.json"), { cache: "no-store" });
  if (!r.ok) throw new Error(`meta.json: ${r.status}`);
  return r.json();
}

export async function loadEvents(ref: RunRef = STATIC_REF): Promise<KbEvent[]> {
  const r = await fetch(url(ref, "events.jsonl"), { cache: "no-store" });
  const text = await r.text();
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as KbEvent);
}

export async function loadJSON<T>(ref: RunRef, name: string): Promise<T | null> {
  try {
    const r = await fetch(url(ref, name), { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function ok(r: Response) {
  if (!r.ok) {
    let detail = `${r.status}`;
    try { detail = (await r.json()).detail ?? detail; } catch { /* keep status */ }
    throw new Error(String(detail));
  }
  return r.json();
}

/**
 * 문서를 올려 작업을 만든다. 많은 문서(최대 500)는 요청 하나의 크기 제한(공개 터널 100MB)을 넘으므로 나눠 올린다:
 * 작업 열기(/jobs/new) → 파일 묶음(/jobs/<run>/files, 묶음당 최대 40개·60MB) → 시작(/jobs/<run>/start; 서버가 변환 후 파이프라인을 띄움).
 * onProgress(보낸 파일 수, 전체) 로 진행을 알린다. 오류 메시지는 서버의 detail 을 그대로 전한다.
 */
export async function createJob(company: string, files: File[],
  opts: { descriptor?: string; brief?: string; internal?: string[]; onProgress?: (sent: number, total: number) => void } = {}): Promise<JobState> {
  const fd0 = new FormData();
  fd0.set("company", company);
  if (opts.descriptor) fd0.set("descriptor", opts.descriptor);
  if (opts.brief) fd0.set("brief", opts.brief);
  const job = (await ok(await fetch(`${API}/api/v2/jobs/new`, { method: "POST", body: fd0 }))) as JobState;
  const MAX_N = 40, MAX_BYTES = 60 * 1024 * 1024;
  let sent = 0;
  opts.onProgress?.(0, files.length);
  for (let i = 0; i < files.length;) {
    const fd = new FormData();
    let n = 0, bytes = 0;
    while (i < files.length && n < MAX_N && (n === 0 || bytes + files[i].size <= MAX_BYTES)) {
      fd.append("files", files[i], files[i].name); bytes += files[i].size; n++; i++;
    }
    await ok(await fetch(`${API}/api/v2/jobs/${job.run}/files`, { method: "POST", body: fd }));
    sent += n; opts.onProgress?.(sent, files.length);
  }
  const fd1 = new FormData();
  if (opts.internal?.length) fd1.set("internal", opts.internal.join("\n"));
  return (await ok(await fetch(`${API}/api/v2/jobs/${job.run}/start`, { method: "POST", body: fd1 }))) as JobState;
}

export async function getJob(run: string): Promise<JobState | null> {
  try {
    const r = await fetch(`${API}/api/v2/jobs/${run}`, { cache: "no-store" });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

/** 작업이 끝날 때까지 기다린다 (done 또는 error). onTick 으로 중간 상태를 알린다. */
export async function waitJob(run: string, onTick?: (s: JobState) => void, intervalMs = 3000): Promise<JobState | null> {
  for (;;) {
    const s = await getJob(run);
    if (s) onTick?.(s);
    if (s && (s.status === "done" || s.status === "error")) return s;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}

/**
 * 기록된 사건을 시간 간격대로 재생한다. speed 배, 간격은 min~max 초로 묶는다.
 * 정적 배포에서 SSE 를 대신한다. stop() 으로 멈춘다.
 */
export function replay(
  events: KbEvent[],
  onEvent: (e: KbEvent) => void,
  onDone: () => void,
  opts: { speed?: number; minGap?: number; maxGap?: number; start?: number } = {},
): () => void {
  const { speed = 20, minGap = 0.02, maxGap = 1.2, start = 0 } = opts;
  let i = events.findIndex((e) => e.seq > start);
  if (i < 0) i = events.length;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const step = () => {
    if (stopped) return;
    if (i >= events.length) {
      onDone();
      return;
    }
    // 기록 앞부분의 읽기 단계(doc.read 가 연달아 180건)는 한 틱에 모두 처리한다 — 구조가 자라기 시작할 때까지 기다리지 않게
    while (i < events.length - 1 && events[i].type === "doc.read" && events[i + 1].type === "doc.read") {
      onEvent(events[i++]);
    }
    const e = events[i++];
    onEvent(e);
    let gap = minGap;
    if (speed > 0 && i < events.length) {
      const dt = (Date.parse(events[i].ts) - Date.parse(e.ts)) / 1000 / speed;
      gap = Math.min(Math.max(dt, minGap), maxGap);
    } else if (speed === 0) {
      gap = 0;
    }
    timer = setTimeout(step, gap * 1000);
  };
  step();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
