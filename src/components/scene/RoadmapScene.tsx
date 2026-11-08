"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { useThemeColors } from "./useThemeColors";

/**
 * 히어로의 3D: 등각(isometric)으로 본 기술 로드맵 판.
 *   네 단(段) = Why / What / How / Resources 층. 가로 = 시간(2025 → 2030).
 *   단 위의 블록 = 로드맵 항목. 단 사이를 잇는 관 = 항목 사이의 연결(동인 → 제품 → 기술 → 자원).
 *   관 위를 흐르는 빛 = 지식이 층을 건너가는 것. 블록은 차례로 켜진다.
 * 라벨은 drei 의 Html 이 아니라 직접 투영한 DOM 이다 — Html 은 라벨마다 React 루트를 만들어 React 19 에서 경고를 낸다.
 */

type Layer = "why" | "what" | "how" | "resource";
const LAYERS: Layer[] = ["why", "what", "how", "resource"];
// 층 색은 globals.css 의 --why/--what/--how/--resource 에서 읽는다 (통일안: 색 정의는 한 곳). Rig 가 받아 아래로 넘긴다.
type LayerColors = Record<Layer, string>;
const LABELS: Record<Layer, string> = { why: "Drivers & markets", what: "Products & milestones", how: "Technologies", resource: "Enablers" };
const W = 12, D = 2.1, GAP = 0.25, H0 = 0.28, STEP = 0.22;

type Block = { id: number; layer: Layer; x: number; w: number; label: string };
const BLOCKS: Block[] = [
  { id: 0, layer: "why", x: -4.6, w: 2.2, label: "Pharma R&D cost pressure" },
  { id: 1, layer: "why", x: -1.4, w: 2.6, label: "Government quantum programs" },
  { id: 2, layer: "why", x: 2.4, w: 2.0, label: "Battery materials demand" },
  { id: 3, layer: "what", x: -4.2, w: 1.9, label: "#AQ 64 system" },
  { id: 4, layer: "what", x: -1.6, w: 2.4, label: "Networked multi-QPU" },
  { id: 5, layer: "what", x: 1.8, w: 2.2, label: "Chemistry simulation service" },
  { id: 6, layer: "how", x: -4.4, w: 2.0, label: "Barium qubits" },
  { id: 7, layer: "how", x: -1.8, w: 2.2, label: "Photonic interconnect" },
  { id: 8, layer: "how", x: 1.2, w: 2.0, label: "Error correction" },
  { id: 9, layer: "resource", x: -3.6, w: 2.4, label: "Manufacturing facility" },
  { id: 10, layer: "resource", x: 0.2, w: 2.2, label: "Partners & funding" },
];
const LINKS: [number, number][] = [[0, 5], [1, 4], [2, 5], [3, 6], [4, 7], [5, 8], [6, 9], [7, 10], [8, 10], [3, 4]];
const YEARS = ["2025", "2026", "2027", "2028", "2029", "2030"];

function layerZ(l: Layer) { return (LAYERS.indexOf(l) - 1.5) * (D + GAP); }
function layerTop(l: Layer) { return H0 + (3 - LAYERS.indexOf(l)) * STEP; }
function blockPos(b: Block) { return new THREE.Vector3(b.x + b.w / 2, layerTop(b.layer) + 0.16, layerZ(b.layer)); }

/** 라벨 하나 = 월드 좌표 + DOM 요소. 매 프레임 투영해 자리를 옮긴다. */
type LabelDef = { key: string; pos: THREE.Vector3; text: string; tone?: Layer; cls: string; anchor: "center" | "right" };
function labelDefs(): LabelDef[] {
  const out: LabelDef[] = BLOCKS.map((b) => { const p = blockPos(b); return { key: "b" + b.id, pos: new THREE.Vector3(p.x, p.y + 0.3, p.z), text: b.label, tone: b.layer, cls: "scene-label", anchor: "center" as const }; });
  LAYERS.forEach((l) => out.push({ key: "l" + l, pos: new THREE.Vector3(-W / 2 - 0.3, layerTop(l) + 0.05, layerZ(l)), text: LABELS[l], tone: l, cls: "scene-label", anchor: "right" }));
  YEARS.forEach((y, i) => out.push({ key: "y" + y, pos: new THREE.Vector3(-W / 2 + (i + 0.5) * (W / 6), 0.05, layerZ("resource") + D / 2 + 0.45), text: y, cls: "label", anchor: "center" }));
  return out;
}

function Projector({ group, overlay, defs }: { group: React.RefObject<THREE.Group | null>; overlay: React.RefObject<HTMLDivElement | null>; defs: LabelDef[] }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const g = group.current, o = overlay.current;
    if (!g || !o) return;
    defs.forEach((d, i) => {
      const el = o.children[i] as HTMLElement | undefined; if (!el) return;
      v.copy(d.pos); g.localToWorld(v); v.project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width, y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = d.anchor === "right" ? `translate(${x}px,${y}px) translate(-100%,-50%)` : `translate(${x}px,${y}px) translate(-50%,-140%)`;
    });
  });
  return null;
}

function Tier({ layer, colors }: { layer: Layer; colors: LayerColors }) {
  const h = layerTop(layer);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.001, D)), []);
  return (
    <group position={[0, 0, layerZ(layer)]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[W, h, D]} />
        <meshStandardMaterial color="#17171b" roughness={0.95} metalness={0} />
      </mesh>
      <lineSegments position={[0, h + 0.001, 0]} geometry={edges}>
        <lineBasicMaterial color={colors[layer]} transparent opacity={0.55} />
      </lineSegments>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-W / 2 + (i + 0.5) * (W / 6), h + 0.002, D / 2 - 0.12]}>
          <boxGeometry args={[0.02, 0.002, 0.14]} />
          <meshBasicMaterial color="#3a3a42" />
        </mesh>
      ))}
    </group>
  );
}

function Blocks({ t, colors }: { t: React.RefObject<number>; colors: LayerColors }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const edges = useMemo(() => BLOCKS.map((b) => new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w, 0.32, 1.1))), []);
  useFrame(() => {
    const time = t.current;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const on = ((time * 0.35 + i * 0.37) % (BLOCKS.length * 0.37)) < 0.9;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity += ((on ? 0.55 : 0.08) - mat.emissiveIntensity) * 0.08;
    });
  });
  return (
    <>
      {BLOCKS.map((b, i) => {
        const p = blockPos(b);
        return (
          <group key={b.id} position={[p.x, p.y, p.z]}>
            <mesh ref={(el) => { refs.current[i] = el; }}>
              <boxGeometry args={[b.w, 0.32, 1.1]} />
              <meshStandardMaterial color="#232329" emissive={colors[b.layer]} emissiveIntensity={0.1} roughness={0.8} />
            </mesh>
            <lineSegments geometry={edges[i]}>
              <lineBasicMaterial color={colors[b.layer]} transparent opacity={0.9} />
            </lineSegments>
          </group>
        );
      })}
    </>
  );
}

function Pipes({ t, colors }: { t: React.RefObject<number>; colors: LayerColors }) {
  const curves = useMemo(() => LINKS.map(([a, b]) => {
    const A = blockPos(BLOCKS[a]), B = blockPos(BLOCKS[b]);
    const mid = A.clone().add(B).multiplyScalar(0.5); mid.y = Math.max(A.y, B.y) + 0.55;
    return { curve: new THREE.CatmullRomCurve3([A, mid, B]), color: colors[BLOCKS[b].layer] };
  }), [colors]);
  const dots = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => { dots.current.forEach((d, i) => { if (!d) return; const u = (t.current * 0.22 + i * 0.13) % 1; curves[i].curve.getPointAt(u, d.position); }); });
  return (
    <>
      {curves.map((c, i) => (
        <group key={i}>
          <mesh>
            <tubeGeometry args={[c.curve, 24, 0.035, 8, false]} />
            <meshStandardMaterial color="#2a2a31" roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh ref={(el) => { dots.current[i] = el; }}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial color={c.color} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Rig({ overlay, defs, colors }: { overlay: React.RefObject<HTMLDivElement | null>; defs: LabelDef[]; colors: LayerColors }) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame((_, delta) => { t.current += delta; if (g.current) g.current.rotation.y = -Math.PI / 4 + Math.sin(t.current * 0.12) * 0.05; });
  return (
    <group position={[0, -0.9, 0]}>
      <group ref={g} rotation={[0, -Math.PI / 4, 0]}>
        {LAYERS.map((l) => <Tier key={l} layer={l} colors={colors} />)}
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[W + 0.4, 0.4, 4 * D + 3 * GAP + 0.4]} />
          <meshStandardMaterial color="#111114" roughness={1} />
        </mesh>
        <Blocks t={t} colors={colors} />
        <Pipes t={t} colors={colors} />
        <Projector group={g} overlay={overlay} defs={defs} />
      </group>
    </group>
  );
}

export default function RoadmapScene() {
  const overlay = useRef<HTMLDivElement>(null);
  const defs = useMemo(() => labelDefs(), []);
  const theme = useThemeColors();
  const colors = useMemo<LayerColors>(() => ({ why: theme.why, what: theme.what, how: theme.how, resource: theme.resource }), [theme]);
  useEffect(() => { if (overlay.current) overlay.current.style.opacity = "1"; }, []);
  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ touchAction: "pan-y" }} aria-hidden="true"
        fallback={<div className="label absolute inset-0 grid place-items-center">3D preview needs WebGL</div>}>
        <OrthographicCamera makeDefault position={[10, 9, 10]} zoom={62} near={0.1} far={100} onUpdate={(c) => c.lookAt(0, 0.2, 0)} />
        <hemisphereLight args={["#2b2b33", "#0b0b0d", 1.1]} />
        <directionalLight position={[6, 10, 4]} intensity={1.2} color="#ffffff" />
        <Rig overlay={overlay} defs={defs} colors={colors} />
      </Canvas>
      <div ref={overlay} className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: 0 }} aria-hidden="true">
        {defs.map((d) => (
          <span key={d.key} className={d.cls} data-tone={d.tone} style={{ position: "absolute", left: 0, top: 0, transform: "translate(-9999px,-9999px)", color: d.cls === "label" ? "var(--muted)" : undefined }}>{d.text}</span>
        ))}
      </div>
    </div>
  );
}
