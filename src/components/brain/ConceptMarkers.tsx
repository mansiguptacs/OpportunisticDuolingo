"use client";

import { useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Concept } from "@/lib/types";
import {
  conceptSurfacePosition,
  shortTopicLabel,
  statusColor,
} from "./anchors";
import { conceptEmoji } from "./conceptGlyph";
import { ZONE_META } from "@/components/KnowledgeGarden";

function Marker({
  concept,
  selected,
  hoveredExternal,
  spark,
  linkedCount,
  onSelect,
  onHover,
  onDeselect,
}: {
  concept: Concept;
  selected: boolean;
  hoveredExternal: boolean;
  spark: boolean;
  linkedCount: number;
  onSelect: (c: Concept) => void;
  onHover: (id: string | null) => void;
  onDeselect?: () => void;
}) {
  const root = useRef<THREE.Group>(null);
  const [hoveredLocal, setHoveredLocal] = useState(false);
  const hovered = hoveredLocal || hoveredExternal;
  const color = statusColor(concept.status);
  const emoji = useMemo(
    () => conceptEmoji(concept.title, concept.region),
    [concept.title, concept.region]
  );
  const label = useMemo(
    () => shortTopicLabel(concept.title, hovered || selected ? 18 : 12),
    [concept.title, hovered, selected]
  );

  const position = useMemo(
    () =>
      conceptSurfacePosition(concept.region, concept.x, concept.y, concept.id),
    [concept]
  );

  const isDecaying =
    concept.status === "overdue" || concept.status === "due";

  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.getElapsedTime();
    let y = 0;
    if (spark) y = Math.sin(t * 7) * 0.035;
    else if (isDecaying) y = Math.sin(t * 2.4) * 0.018;
    else y = Math.sin(t * 1.6 + position.x) * 0.01;
    root.current.position.y = position.y + y;
  });

  const statusText =
    concept.status === "due" || concept.status === "overdue"
      ? "needs review"
      : concept.status === "fresh"
        ? "newly mapped"
        : "holding strong";

  const ring =
    concept.status === "overdue"
      ? "1.5px solid rgba(217,79,106,0.85)"
      : concept.status === "due"
        ? "1.5px solid rgba(232,160,23,0.75)"
        : selected || spark
          ? `1.5px solid ${color}`
          : "1px solid rgba(28,36,51,0.14)";

  return (
    <group ref={root} position={position}>
      <mesh
        renderOrder={20}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(concept);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLocal(true);
          onHover(concept.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHoveredLocal(false);
          onHover(null);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.42, 12, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <mesh raycast={() => null} renderOrder={18}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected || spark ? 0.5 : isDecaying ? 0.32 : 0.16}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      {/* Always-visible emoji + topic name */}
      <Html
        distanceFactor={12}
        center
        zIndexRange={[30, 0]}
        occlude={false}
        style={{ pointerEvents: "none", transform: "translate(-50%, -50%)" }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            maxWidth: selected || hovered ? 140 : 108,
            padding: selected || hovered ? "3px 7px 3px 5px" : "2px 6px 2px 4px",
            borderRadius: 999,
            background:
              selected || hovered
                ? "rgba(255,255,255,0.97)"
                : "rgba(255,252,248,0.9)",
            border: ring,
            boxShadow: selected
              ? `0 8px 20px rgba(28,36,51,0.16), 0 0 0 2px ${color}22`
              : "0 2px 8px rgba(28,36,51,0.08)",
            opacity: selected || hovered || spark || isDecaying ? 1 : 0.88,
            whiteSpace: "nowrap",
          }}
          title={concept.title}
        >
          <span style={{ fontSize: selected || spark ? 12 : 10, lineHeight: 1 }}>
            {emoji}
          </span>
          <span
            style={{
              fontFamily: "JetBrains Mono, ui-monospace, monospace",
              fontSize: selected || hovered ? 9 : 8,
              fontWeight: 500,
              color: "#1c2433",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: "-0.01em",
            }}
          >
            {label}
          </span>
        </div>
      </Html>

      {selected && (
        <Html
          distanceFactor={10}
          position={[0, 0.55, 0]}
          style={{ transform: "translate(-50%, -100%)" }}
          center
          zIndexRange={[60, 0]}
          occlude={false}
        >
          <div
            className="pointer-events-auto w-[240px] rounded-2xl border bg-white p-3.5 shadow-xl"
            style={{
              borderColor: color,
              boxShadow: `0 12px 40px rgba(28,36,51,0.18), 0 0 0 1px ${color}33`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p
              className="text-[9px] uppercase tracking-[0.2em]"
              style={{ color: "#667085" }}
            >
              {emoji} {ZONE_META[concept.region].label} · {statusText}
            </p>
            <h3
              className="mt-1 text-lg leading-tight"
              style={{
                color: "#1c2433",
                fontFamily: "Fraunces, Georgia, serif",
              }}
            >
              {concept.title}
            </h3>
            <p className="mt-1.5 text-[11px]" style={{ color: "#667085" }}>
              Mastery {concept.mastery}
              {linkedCount > 0
                ? ` · ${linkedCount} linked`
                : " · no links yet"}
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href="/today"
                className="rounded-full px-3.5 py-1.5 text-[10px] font-semibold text-white"
                style={{ background: "#e4572e" }}
              >
                Review
              </a>
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-[10px] uppercase tracking-wider"
                style={{ color: "#667085" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeselect?.();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function ConceptMarkers({
  concepts,
  selectedId,
  hoveredId,
  sparkIds,
  linkCounts,
  onSelect,
  onHover,
  onDeselect,
}: {
  concepts: Concept[];
  selectedId?: string | null;
  hoveredId?: string | null;
  sparkIds?: Set<string>;
  linkCounts?: Map<string, number>;
  onSelect: (c: Concept) => void;
  onHover: (id: string | null) => void;
  onDeselect?: () => void;
}) {
  return (
    <group>
      {concepts.map((c) => (
        <Marker
          key={c.id}
          concept={c}
          selected={selectedId === c.id}
          hoveredExternal={hoveredId === c.id}
          spark={Boolean(sparkIds?.has(c.id))}
          linkedCount={linkCounts?.get(c.id) || 0}
          onSelect={onSelect}
          onHover={onHover}
          onDeselect={onDeselect}
        />
      ))}
    </group>
  );
}
