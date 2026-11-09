/**
 * 화면 단계. 주소는 '/' 하나이고 단계만 바뀐다 (personal-site 의 Stage 방식).
 *
 *   gate    — 제목 한 줄. 누르면 들어간다.
 *   upload  — 문서를 올리거나, 준비된 IonQ 180건으로 시작한다.
 *   build   — 다섯 지식 구조가 실시간으로 자란다.
 *   cards   — 기회 카드가 조립된다.
 *   debate  — 세 에이전트가 카드마다 세 질문으로 토론하며 점수를 매긴다.
 *   roadmap — 선정된 카드로 로드맵을 만든다.
 */
export const STAGES = ["gate", "upload", "build", "cards", "debate", "roadmap"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Exclude<Stage, "gate">, string> = {
  upload: "Documents",
  build: "Knowledge structures",
  cards: "Opportunity cards",
  debate: "Agent debate",
  roadmap: "Roadmap",
};

export const STEPS = STAGES.filter((s): s is Exclude<Stage, "gate"> => s !== "gate");

export function stepIndex(s: Exclude<Stage, "gate">): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(STEPS.indexOf(s) + 1)} / ${pad(STEPS.length)}`;
}

export function isStage(v: unknown): v is Stage {
  return typeof v === "string" && (STAGES as readonly string[]).includes(v);
}
