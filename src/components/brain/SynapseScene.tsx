"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type {
  Concept,
  QuizQuestion,
  Source,
  TeachCard,
} from "@/lib/types";
import { BrainAssembly } from "./BrainMesh";
import {
  buildKnowledgeEdges,
  type GraphEdge,
} from "@/components/KnowledgeGraph";
import { RelatedConstellation } from "@/components/RelatedConstellation";

function SceneContent({
  concepts,
  edges,
  selectedId,
  hoveredId,
  sparkIds,
  vitality,
  onSelect,
  onHover,
  onDeselect,
  autoRotate,
}: {
  concepts: Concept[];
  edges: GraphEdge[];
  selectedId?: string | null;
  hoveredId?: string | null;
  sparkIds?: Set<string>;
  vitality: number;
  onSelect: (c: Concept) => void;
  onHover: (id: string | null) => void;
  onDeselect?: () => void;
  autoRotate: boolean;
}) {
  return (
    <>
      <color attach="background" args={["#efe8df"]} />
      <fog attach="fog" args={["#efe8df", 10, 22]} />

      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#fff6ee", "#b8c4d4", 0.55]} />

      <directionalLight
        position={[3.5, 7, 4]}
        intensity={1.55}
        color="#fff5ea"
        castShadow
      />
      <directionalLight position={[-4, 2, -2]} intensity={0.45} color="#c5d8f0" />
      <pointLight position={[0, 1.5, -4]} intensity={0.55} color="#ffb08a" />
      <pointLight position={[-2.5, 0.5, 2]} intensity={0.3} color="#7eb6ff" />

      <BrainAssembly
        vitality={vitality}
        concepts={concepts}
        edges={edges}
        selectedId={selectedId}
        hoveredId={hoveredId}
        sparkIds={sparkIds}
        onSelect={onSelect}
        onHover={onHover}
        onDeselect={onDeselect}
      />

      <ContactShadows
        position={[0, -1.55, 0]}
        opacity={0.22}
        scale={12}
        blur={2.4}
        far={4.5}
        color="#6a5a4a"
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={0.35}
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.68}
        minDistance={3.8}
        maxDistance={10}
        target={[0, 0.1, 0]}
      />
    </>
  );
}

export function SynapseScene({
  concepts,
  sources,
  quizBank = [],
  teachCards = [],
  selectedId,
  sparkIds,
  vitality,
  onSelect,
  onDeselect,
}: {
  concepts: Concept[];
  sources: Source[];
  quizBank?: QuizQuestion[];
  teachCards?: TeachCard[];
  selectedId?: string | null;
  sparkIds?: Set<string>;
  vitality: number;
  onSelect: (c: Concept) => void;
  onDeselect: () => void;
}) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [webglOk, setWebglOk] = useState(true);
  const [hint, setHint] = useState(true);
  const dragRef = useRef({ x: 0, y: 0, dragging: false });

  const edges = useMemo(
    () => buildKnowledgeEdges(concepts, sources, quizBank, teachCards),
    [concepts, sources, quizBank, teachCards]
  );

  const selected = useMemo(
    () => concepts.find((c) => c.id === selectedId) || null,
    [concepts, selectedId]
  );

  const litIds = useMemo(() => {
    const s = new Set(sparkIds ?? []);
    if (!selectedId) return s;
    for (const e of edges) {
      if (e.source === selectedId) s.add(e.target);
      if (e.target === selectedId) s.add(e.source);
    }
    return s;
  }, [sparkIds, selectedId, edges]);

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setWebglOk(
        Boolean(c.getContext("webgl") || c.getContext("experimental-webgl"))
      );
    } catch {
      setWebglOk(false);
    }
  }, []);

  if (!webglOk) {
    return (
      <div className="absolute inset-0 grid place-items-center text-sm text-[var(--muted)]">
        WebGL unavailable for the 3D brain atlas.
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[var(--bg)]">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [1.4, 2.2, 4.8], fov: 38, near: 0.1, far: 60 }}
        gl={{ antialias: true }}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, y: e.clientY, dragging: false };
          setAutoRotate(false);
          setHint(false);
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) {
            d.dragging = true;
          }
        }}
        onPointerMissed={() => {
          if (!dragRef.current.dragging) onDeselect();
        }}
      >
        <SceneContent
          concepts={concepts}
          edges={edges}
          selectedId={selectedId}
          hoveredId={hoveredId}
          sparkIds={litIds}
          vitality={vitality}
          autoRotate={autoRotate}
          onSelect={(c) => {
            setAutoRotate(false);
            setHint(false);
            onSelect(c);
          }}
          onHover={setHoveredId}
          onDeselect={onDeselect}
        />
      </Canvas>

      {hint && !selected && (
        <p className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]/80">
        Drag to orbit · click a labeled pin to open it
        </p>
      )}

      <button
        type="button"
        className="hud-glass pointer-events-auto absolute bottom-6 right-6 z-20 rounded-full px-3 py-2 text-[10px] uppercase tracking-wider hover:border-[var(--accent)]"
        onClick={() => setAutoRotate(true)}
      >
        Auto-rotate
      </button>

      {selected && (
        <div className="pointer-events-auto absolute bottom-24 right-6 z-20 md:right-24">
          <RelatedConstellation
            selected={selected}
            concepts={concepts}
            edges={edges}
            onSelect={(c) => {
              setAutoRotate(false);
              onSelect(c);
            }}
            onClear={onDeselect}
          />
        </div>
      )}

      {!selected && (
        <div className="pointer-events-none absolute bottom-20 left-6 z-10 text-[9px] uppercase tracking-wider text-[var(--muted)] md:left-10">
          Click a pin · related ideas open as a constellation
        </div>
      )}
    </div>
  );
}
