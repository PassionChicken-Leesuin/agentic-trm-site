"use client";

/**
 * 토론 화면의 에이전트 얼굴. 세 모델을 세 가지 로봇 모양으로 구분한다 (선 그림, 사이트의 단색 톤 + 에이전트별 강조색).
 *   0 — 둥근 네모 머리, 동그란 눈 두 개, 안테나 하나         (Agent A)
 *   1 — 돔 머리, 가로 바이저(눈 한 줄), 양쪽 귀                (Agent B)
 *   2 — 각진 머리, 네모 눈 두 개, 안테나 두 개                 (Agent C)
 * thinking: 카드를 읽는 중 (살짝 떠다님), active: 말하는 중 (눈이 켜짐).
 */
const ACCENT = ["#8fb4ff", "#f0b36a", "#7fd1a8"];

export default function AgentAvatar({ variant, active, thinking, size = 56 }: { variant: number; active?: boolean; thinking?: boolean; size?: number }) {
  const v = ((variant % 3) + 3) % 3;
  const accent = ACCENT[v];
  const eye = active ? accent : "var(--hairline)";
  const stroke = "var(--ink)";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      className={thinking ? "animate-pulse" : ""} style={{ flex: "0 0 auto", filter: active ? `drop-shadow(0 0 6px ${accent}66)` : undefined, transition: "filter 300ms ease" }} aria-hidden="true">
      {v === 0 && (
        <>
          <line x1="32" y1="6" x2="32" y2="14" /><circle cx="32" cy="5" r="2.2" fill={eye} stroke="none" />
          <rect x="14" y="14" width="36" height="28" rx="8" />
          <circle cx="24" cy="27" r="4" fill={eye} stroke="none" /><circle cx="40" cy="27" r="4" fill={eye} stroke="none" />
          <path d="M25 35 q7 4 14 0" />
          <line x1="10" y1="24" x2="14" y2="24" /><line x1="50" y1="24" x2="54" y2="24" />
          <path d="M22 42 v4 h20 v-4" /><rect x="18" y="46" width="28" height="12" rx="4" />
          <circle cx="32" cy="52" r="2" fill={accent} stroke="none" />
        </>
      )}
      {v === 1 && (
        <>
          <path d="M14 38 v-8 a18 18 0 0 1 36 0 v8 z" />
          <rect x="19" y="26" width="26" height="8" rx="4" fill={eye} stroke="none" />
          <rect x="8" y="26" width="6" height="10" rx="2" /><rect x="50" y="26" width="6" height="10" rx="2" />
          <path d="M14 38 h36" /><path d="M24 38 v5 h16 v-5" />
          <rect x="17" y="43" width="30" height="14" rx="5" />
          <line x1="26" y1="50" x2="38" y2="50" stroke={accent} />
        </>
      )}
      {v === 2 && (
        <>
          <line x1="24" y1="6" x2="22" y2="13" /><line x1="40" y1="6" x2="42" y2="13" />
          <circle cx="24" cy="5" r="2" fill={eye} stroke="none" /><circle cx="40" cy="5" r="2" fill={eye} stroke="none" />
          <path d="M16 13 h32 l4 6 v18 l-4 6 h-32 l-4 -6 v-18 z" />
          <rect x="21" y="23" width="8" height="8" rx="1.5" fill={eye} stroke="none" /><rect x="35" y="23" width="8" height="8" rx="1.5" fill={eye} stroke="none" />
          <line x1="25" y1="37" x2="39" y2="37" />
          <path d="M24 43 v4 h16 v-4" /><rect x="16" y="47" width="32" height="11" rx="3" />
          <circle cx="26" cy="52.5" r="1.6" fill={accent} stroke="none" /><circle cx="32" cy="52.5" r="1.6" fill={accent} stroke="none" /><circle cx="38" cy="52.5" r="1.6" fill={accent} stroke="none" />
        </>
      )}
    </svg>
  );
}
