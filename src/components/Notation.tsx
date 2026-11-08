/**
 * 구축 화면의 그래프 밑 범례 (notation). 통일안: 색은 로드맵 층에만, 모양은 지식 단위의 종류, 상태는 테두리·선.
 * 정의: 연구계획/2026-11-08_정의_KB요소_모양_색상.md
 */
const LAYERS: [string, string][] = [
  ["why", "drivers, markets, needs"],
  ["what", "products, milestones"],
  ["how", "technologies"],
  ["resource", "funding, facilities, partners"],
];

const Sw = ({ children, w = 14, h = 12 }: { children: React.ReactNode; w?: number; h?: number }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">{children}</svg>
);

/** 그래프 범례 안에 넣는 층 색 묶음: what = 무엇의 색인지 (예: "bar", "circle") */
function Layers({ what }: { what: string }) {
  return (
    <>
      <span className="sep">{what} colour =</span>
      {LAYERS.map(([l, d]) => (
        <span key={l} title={d}><Sw w={10} h={10}><rect width="10" height="10" rx="2" fill={`var(--${l})`} /></Sw><b style={{ color: `var(--${l})` }}>{l}</b>{d}</span>
      ))}
    </>
  );
}

/** (쓰지 않음) 화면 위 한 줄짜리 층 색 안내 — 각 그래프 범례로 옮김 */
export function LayerKey() {
  return (
    <div className="notation layer-key">
      <span className="label">Colour = roadmap layer</span>
      {LAYERS.map(([l, d]) => (
        <span key={l}><Sw w={10} h={10}><rect width="10" height="10" rx="2" fill={`var(--${l})`} /></Sw><b style={{ color: `var(--${l})` }}>{l}</b> {d}</span>
      ))}
      <span><Sw w={10} h={10}><circle cx="5" cy="5" r="3.5" fill="var(--internal)" /></Sw>internal document</span>
    </div>
  );
}

export function Notation({ panel }: { panel: string }) {
  if (panel === "k1")
    return (
      <div className="notation">
        <Layers what="left bar" />
        <span><span className="tag how" style={{ marginRight: 4 }}>how</span>layer tag (same as the bar)</span>
        <span className="sep">also sent to:</span>
        <span><span className="sys">tree</span>theme summary tree</span>
        <span><span className="sys">graph</span>relation graph</span>
        <span><span className="sys">time</span>temporal knowledge graph</span>
        <span><span className="sys">grid</span>opportunity candidates</span>
        <span className="muted-note">no tag = kept as evidence only</span>
        <span className="sep">right:</span>
        <span><Sw w={10} h={10}><circle cx="5" cy="5" r="3.5" fill="var(--internal)" /></Sw>internal = from an internal document</span>
        <span>new = new fact</span>
        <span>duplicate = already stored (row dimmed)</span>
        <span>irrelevant = boilerplate, not used (row crossed out)</span>
      </div>
    );
  if (panel === "k2")
    return (
      <div className="notation">
        <span><Sw><circle cx="7" cy="6" r="5" fill="var(--muted)" fillOpacity="0.55" /></Sw>circle = theme · size = passages</span>
        <Layers what="main layer of its passages:" />
        <span><Sw><circle cx="7" cy="6" r="5" fill="none" stroke="var(--muted)" strokeDasharray="2 2" /></Sw>area (group of themes)</span>
        <span><Sw><circle cx="7" cy="6" r="5" fill="none" stroke="var(--ink)" strokeWidth="1.5" /></Sw>just updated</span>
      </div>
    );
  if (panel === "k4")
    return (
      <div className="notation">
        <span><Sw><rect x="2" y="1" width="10" height="10" rx="3" fill="var(--muted)" /></Sw>square = subject · size = relations</span>
        <Layers what="main layer:" />
        <span><Sw w={22}><line x1="1" y1="6" x2="21" y2="6" stroke="var(--muted)" /></Sw>requires</span>
        <span><Sw w={22}><line x1="1" y1="6" x2="21" y2="6" stroke="var(--muted)" strokeDasharray="6 3" /></Sw>enables</span>
        <span><Sw w={22}><line x1="1" y1="6" x2="21" y2="6" stroke="var(--muted)" strokeDasharray="2 2" /></Sw>drives</span>
        <span><Sw w={22}><line x1="1" y1="6" x2="21" y2="6" stroke="var(--muted)" strokeWidth="2.6" strokeOpacity="0.45" /></Sw>part of</span>
        <span><Sw w={22}><line x1="1" y1="6" x2="21" y2="6" stroke="var(--hairline)" /></Sw>other (supplies, partners with, customer of …)</span>
      </div>
    );
  if (panel === "k5")
    return (
      <div className="notation">
        <span><Sw><circle cx="7" cy="6" r="4.5" fill="var(--time-fact)" /></Sw>metric value</span>
        <span><Sw><rect x="2.5" y="1.5" width="9" height="9" fill="var(--time-fact)" /></Sw>lifecycle stage</span>
        <span><Sw><path d="M7,0.5 L12.5,6 L7,11.5 L1.5,6 Z" fill="var(--time-fact)" /></Sw>milestone</span>
        <span className="sep">filled = achieved / current</span>
        <span><Sw><circle cx="7" cy="6" r="4.5" fill="none" stroke="var(--time-fact)" strokeWidth="1.4" /></Sw>planned / forecast</span>
        <span><Sw><circle cx="7" cy="6" r="4.5" fill="none" stroke="var(--time-fact)" strokeWidth="1.4" /><circle cx="7" cy="6" r="1.5" fill="var(--time-fact)" /></Sw>required</span>
        <span><Sw><circle cx="7" cy="6" r="4.5" fill="none" stroke="var(--time-fact)" strokeWidth="1.4" strokeDasharray="2 2" /></Sw>vision</span>
        <span><Sw w={22}><path d="M1,8 C7,1 15,1 21,8" fill="none" stroke="var(--muted)" /></Sw>same subject &amp; attribute over time</span>
        <span><Sw w={22}><path d="M1,8 C7,1 15,1 21,8" fill="none" stroke="var(--resource)" strokeDasharray="4 3" /></Sw>update</span>
        <span><Sw w={22}><path d="M1,8 C7,1 15,1 21,8" fill="none" stroke="var(--conflict)" strokeDasharray="2 2" /></Sw>conflict</span>
        <span className="muted-note">row = subject · x = time the fact is valid · symbols are one colour (no layer)</span>
        <Layers what="row marker" />
      </div>
    );
  return null;
}
