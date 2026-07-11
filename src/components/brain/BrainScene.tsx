"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { Concept } from "@/lib/types";
import { BrainAssembly } from "./BrainMesh";

function SceneContent({
  concepts,
  selectedId,
  hoveredId,
  sparkIds,
  vitality,
  onSelect,
  onHover,
  autoRotate,
}: {
  concepts: Concept[];
  selectedId?: string | null;
  hoveredId?: string | null;
  sparkIds?: Set<string>;
  vitality: number;
  onSelect: (c: Concept) => void;
  onHover: (id: string | null) => void;
  autoRotate: boolean;
}) {
  return (
    <>
      <color attach="background" args={["#f3efe8"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 6, 3]} intensity={1.35} color="#fff8f0" />
      <pointLight position={[-3, 2, -2]} intensity={0.55} color="#3d7dd9" />
      <pointLight position={[2, -1, 3]} intensity={0.45} color="#ff8f6b" />

      <BrainAssembly
        vitality={vitality}
        concepts={concepts}
        selectedId={selectedId}
        hoveredId={hoveredId}
        sparkIds={sparkIds}
        onSelect={onSelect}
        onHover={onHover}
      />

      {/* Soft fill so the mesh reads well without remote HDR env maps */}
      <hemisphereLight
        args={["#fff5eb", "#d4e4f7", 0.55]}
      />
      <ContactShadows
        position={[0, -1.6, 0]}
        opacity={0.14}
        scale={16}
        blur={3.2}
        far={6}
        color="#8a7a6a"
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={0.35}
        minPolarAngle={Math.PI * 0.22}
        maxPolarAngle={Math.PI * 0.62}
        minDistance={4}
        maxDistance={12}
        target={[0, 0.05, 0]}
      />
    </>
  );
}

export function BrainScene({
  concepts,
  selectedId,
  hoveredId,
  sparkIds,
  vitality,
  onSelect,
  onHover,
  onDeselect,
  onInteract,
}: {
  concepts: Concept[];
  selectedId?: string | null;
  hoveredId?: string | null;
  sparkIds?: Set<string>;
  vitality: number;
  onSelect: (c: Concept) => void;
  onHover: (id: string | null) => void;
  onDeselect: () => void;
  onInteract?: () => void;
}) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [webglOk, setWebglOk] = useState(true);
  const [hintVisible, setHintVisible] = useState(true);
  const dragRef = useRef({ x: 0, y: 0, dragging: false });

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setWebglOk(
        Boolean(
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
        )
      );
    } catch {
      setWebglOk(false);
    }
  }, []);

  if (!webglOk) {
    return (
      <div className="absolute inset-0 grid place-items-center text-sm text-[var(--muted)]">
        WebGL unavailable — enable hardware acceleration for the 3D atlas.
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[var(--bg)]">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 2.4, 6.2], fov: 40, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: false }}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, y: e.clientY, dragging: false };
          setAutoRotate(false);
          setHintVisible(false);
          onInteract?.();
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (
            Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5
          ) {
            d.dragging = true;
          }
        }}
        onPointerMissed={() => {
          // Only deselect on a true click-miss, not after a drag orbit
          if (!dragRef.current.dragging) onDeselect();
        }}
      >
        <SceneContent
          concepts={concepts}
          selectedId={selectedId}
          hoveredId={hoveredId}
          sparkIds={sparkIds}
          vitality={vitality}
          autoRotate={autoRotate}
          onSelect={(c) => {
            setAutoRotate(false);
            setHintVisible(false);
            onSelect(c);
          }}
          onHover={onHover}
        />
      </Canvas>

      {hintVisible && (
        <p className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]/80 transition-opacity">
          Drag to orbit · click a locus
        </p>
      )}

      <button
        type="button"
        className="hud-glass pointer-events-auto absolute bottom-6 right-6 z-20 rounded-full px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--ink)] hover:border-[var(--accent)]"
        onClick={() => setAutoRotate(true)}
      >
        Auto-rotate
      </button>
    </div>
  );
}
