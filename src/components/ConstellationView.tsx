"use client";

import { useMemo, useState } from "react";
import type { BrainRegion, Concept, ConceptStatus } from "@/lib/types";
import { ZONE_META } from "@/components/KnowledgeGarden";
import { statusColor } from "@/components/brain/anchors";

const REGION_ORDER: BrainRegion[] = [
  "prefrontal",
  "parietal",
  "temporal",
  "hippocampus",
];

const HUBS: Record<BrainRegion, { x: number; y: number; color: string }> = {
  prefrontal: { x: 300, y: 200, color: "#3d7dd9" },
  parietal: { x: 900, y: 200, color: "#2a9d8f" },
  temporal: { x: 320, y: 480, color: "#e8a017" },
  hippocampus: { x: 880, y: 490, color: "#d94f6a" },
};

function hash01(seed: string, salt = 0) {
  let h = salt >>> 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

function starRadius(status: ConceptStatus, mastery: number) {
  const base =
    status === "overdue" ? 9 : status === "due" ? 8 : status === "fresh" ? 6 : 7;
  return base + Math.min(mastery, 80) / 35;
}

type StarPos = { id: string; x: number; y: number; concept: Concept };

function layoutStars(concepts: Concept[]): StarPos[] {
  const byRegion = new Map<BrainRegion, Concept[]>();
  for (const c of concepts) {
    const list = byRegion.get(c.region) || [];
    list.push(c);
    byRegion.set(c.region, list);
  }

  const out: StarPos[] = [];
  for (const region of REGION_ORDER) {
    const hub = HUBS[region];
    const items = byRegion.get(region) || [];
    items.forEach((c, i) => {
      const n = Math.max(items.length, 1);
      const angle =
        -Math.PI / 2 + (i / n) * Math.PI * 2 + hash01(c.id, 3) * 0.35;
      const radius = 55 + hash01(c.id, 5) * 70 + (i % 3) * 12;
      out.push({
        id: c.id,
        concept: c,
        x: hub.x + Math.cos(angle) * radius,
        y: hub.y + Math.sin(angle) * radius * 0.78,
      });
    });
  }
  return out;
}

export function ConstellationView({
  concepts,
  selectedId,
  sparkIds,
  vitality,
  onSelect,
  onDeselect,
}: {
  concepts: Concept[];
  selectedId?: string | null;
  sparkIds?: Set<string>;
  vitality: number;
  onSelect: (c: Concept) => void;
  onDeselect?: () => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const stars = useMemo(() => layoutStars(concepts), [concepts]);
  const byId = useMemo(() => new Map(stars.map((s) => [s.id, s])), [stars]);

  const edges = useMemo(() => {
    const lines: {
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
    }[] = [];
    for (const region of REGION_ORDER) {
      const hub = HUBS[region];
      const group = stars.filter((s) => s.concept.region === region);
      group.forEach((s) => {
        lines.push({
          key: `h-${s.id}`,
          x1: hub.x,
          y1: hub.y,
          x2: s.x,
          y2: s.y,
          color: hub.color,
        });
      });
      for (let i = 0; i < group.length - 1; i++) {
        lines.push({
          key: `e-${group[i].id}-${group[i + 1].id}`,
          x1: group[i].x,
          y1: group[i].y,
          x2: group[i + 1].x,
          y2: group[i + 1].y,
          color: hub.color,
        });
      }
    }
    return lines;
  }, [stars]);

  const skyGlow = 0.3 + (vitality / 100) * 0.4;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label="Knowledge constellation"
        onClick={() => onDeselect?.()}
      >
        <defs>
          <radialGradient id="cosmos" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor={`rgba(255,255,255,${skyGlow})`} />
            <stop offset="55%" stopColor="#c5d4ec" />
            <stop offset="100%" stopColor="#9eb0d0" />
          </radialGradient>
        </defs>
        <rect
          width="1200"
          height="700"
          fill="url(#cosmos)"
          onClick={() => onDeselect?.()}
        />

        {Array.from({ length: 70 }).map((_, i) => (
          <circle
            key={i}
            cx={hash01("bg", i) * 1200}
            cy={hash01("bg", i + 40) * 700}
            r={0.7 + hash01("bg", i + 80) * 1.6}
            fill="#ffffff"
            opacity={0.3 + hash01("bg", i + 90) * 0.4}
          />
        ))}

        {REGION_ORDER.map((region) => {
          const hub = HUBS[region];
          const meta = ZONE_META[region];
          const count = concepts.filter((c) => c.region === region).length;
          const due = concepts.filter(
            (c) =>
              c.region === region &&
              (c.status === "due" || c.status === "overdue")
          ).length;
          return (
            <g key={region} pointerEvents="none">
              <circle cx={hub.x} cy={hub.y} r={28} fill={hub.color} opacity={0.12} />
              <circle cx={hub.x} cy={hub.y} r={5} fill={hub.color} opacity={0.5} />
              <text
                x={hub.x}
                y={hub.y - 40}
                textAnchor="middle"
                fill="#1c2433"
                fontSize="20"
                fontFamily="Fraunces, Georgia, serif"
              >
                {meta.label}
              </text>
              <text
                x={hub.x}
                y={hub.y - 22}
                textAnchor="middle"
                fill="#667085"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {count} stars
                {due > 0 ? ` · ${due} flicker` : ""}
              </text>
            </g>
          );
        })}

        {edges.map((e) => (
          <line
            key={e.key}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke={e.color}
            strokeWidth={1.2}
            opacity={0.28}
          />
        ))}

        {stars.map((s) => {
          const color = statusColor(s.concept.status);
          const r = starRadius(s.concept.status, s.concept.mastery);
          const active = selectedId === s.id || hoveredId === s.id;
          const spark = sparkIds?.has(s.id);
          const flicker =
            s.concept.status === "due" || s.concept.status === "overdue";
          return (
            <g
              key={s.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(s.concept);
              }}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <circle cx={s.x} cy={s.y} r={r + 14} fill="transparent" />
              <circle
                cx={s.x}
                cy={s.y}
                r={r + 5}
                fill={color}
                opacity={0.2}
                className={flicker ? "star-flicker" : undefined}
              />
              <circle
                cx={s.x}
                cy={s.y}
                r={r}
                fill={color}
                opacity={active ? 1 : 0.92}
                className={
                  spark ? "garden-pop" : flicker ? "star-flicker" : undefined
                }
                stroke={active ? "#1c2433" : "white"}
                strokeWidth={active ? 1.6 : 0.9}
              />
              {active && (
                <foreignObject
                  x={s.x - 70}
                  y={s.y - r - 30}
                  width="140"
                  height="24"
                >
                  <div
                    className="truncate rounded-md border bg-white/95 px-2 py-0.5 text-center text-[10px] shadow-sm"
                    style={{
                      borderColor: color,
                      color: "#1c2433",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {s.concept.title}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}

        {selectedId && byId.get(selectedId) && (
          <line
            x1={HUBS[byId.get(selectedId)!.concept.region].x}
            y1={HUBS[byId.get(selectedId)!.concept.region].y}
            x2={byId.get(selectedId)!.x}
            y2={byId.get(selectedId)!.y}
            stroke={statusColor(byId.get(selectedId)!.concept.status)}
            strokeWidth={2.2}
            opacity={0.75}
          />
        )}
      </svg>
    </div>
  );
}
