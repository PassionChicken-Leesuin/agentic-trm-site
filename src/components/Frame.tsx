import { STEPS, type Stage } from "./views";

/** 오른쪽 가장자리의 단계 점과 좌하단 출처. 구축 화면은 지면을 다 쓰므로 둘 다 숨긴다. */
export default function Frame({ stage }: { stage: Stage }) {
  if (stage === "build") return null;
  return (
    <>
      <div className="dots hidden md:flex" aria-hidden="true">
        <i data-on={stage === "gate"} />
        {STEPS.map((s) => <i key={s} data-on={stage === s} />)}
      </div>
      <p className="label fixed bottom-5 left-6 z-30 hidden sm:block" style={{ color: "var(--muted)" }}>SNU DDSI Lab · Suin Lee · research demo</p>
    </>
  );
}
