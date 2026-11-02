/**
 * 데이터 출처 두 가지.
 *   static — public/data/<run>/ 의 파일을 읽어 사건을 재생한다 (Vercel 등 정적 배포).
 *   server — NEXT_PUBLIC_API 가 가리키는 FastAPI(viz.server) 에서 SSE 로 받는다 (업로드 모드).
 */
export type KbEvent = { seq: number; ts: string; type: string } & Record<string, unknown>;

export type Doc = { id: string; title: string; date: string; source_type: string; is_synthetic: boolean };
export type Meta = {
  run: string;
  documents: Doc[];
  planned_total: number | null;
  entities: Record<string, { name: string; layer?: string | null }>;
  tree: { areas: { name: string; theme_ids: string[]; trend?: string; shares?: { year: number; share: number }[] }[]; root?: unknown } | null;
  glossary: { name: string; type: string; aliases: string[]; unit?: string | null; definition: string; status: string; count: number }[];
  stats: Record<string, unknown>;
};

export const API = process.env.NEXT_PUBLIC_API ?? "";
export const DEFAULT_RUN = process.env.NEXT_PUBLIC_RUN ?? "ionq";

export async function serverAvailable(): Promise<boolean> {
  if (!API) return false;
  try {
    const r = await fetch(`${API}/api/v2/runs`, { cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function loadMeta(run = DEFAULT_RUN): Promise<Meta> {
  const r = await fetch(`/data/${run}/meta.json`, { cache: "no-store" });
  return r.json();
}

export async function loadEvents(run = DEFAULT_RUN): Promise<KbEvent[]> {
  const r = await fetch(`/data/${run}/events.jsonl`, { cache: "no-store" });
  const text = await r.text();
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as KbEvent);
}

export async function loadJSON<T>(run: string, name: string): Promise<T | null> {
  try {
    const r = await fetch(`/data/${run}/${name}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
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
