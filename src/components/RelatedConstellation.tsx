"use client";

import { useMemo } from "react";
import type { Concept } from "@/lib/types";
import type { GraphEdge } from "@/components/KnowledgeGraph";
import { statusColor } from "@/components/brain/anchors";
import { ZONE_META } from "@/components/KnowledgeGarden";

function reasonColor(reason: string) {
  if (reason === "synthesis") return "#e4572e";
  if (reason === "quiz") return "#2a9d8f";
  return "#3d7dd9";
}

function reasonShort(reason: string) {
  if (reason === "synthesis") return "synthesis";
  if (reason === "quiz") return "practiced together";
  return "same source";
}

export function RelatedConstellation({
  selected,
  concepts,
  edges,
  onSelect,
  onClear,
}: {
  selected: Concept;
  concepts: Concept[];
  edges: GraphEdge[];
  onSelect: (c: Concept) => void;
  onClear: () => void;
}) {
  const related = useMemo(() => {
    const out: { concept: Concept; edge: GraphEdge }[] = [];
    for (const e of edges) {
      const otherId =
        e.source === selected.id
          ? e.target
          : e.target === selected.id
            ? e.source
            : null;
      if (!otherId) continue;
      const concept = concepts.find((c) => c.id === otherId);
      if (concept) out.push({ concept, edge: e });
    }
    return out.slice(0, 8);
  }, [selected, concepts, edges]);

  const layout = useMemo(() => {
    const cx = 160;
    const cy = 130;
    const r = related.length <= 4 ? 78 : 92;
    return related.map((item, i) => {
      const angle =
        -Math.PI / 2 + (i / Math.max(related.length, 1)) * Math.PI * 2;
      return {
        ...item,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      };
    });
  }, [related]);

  return (
    <div className="pointer-events-auto hud-glass w-[min(320px,92vw)] overflow-hidden rounded-3xl">
      <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] px-4 pt-3 pb-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">
            Related constellation
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {related.length === 0
              ? "No linked concepts yet"
              : `${related.length} connected idea${related.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)]"
        >
          Close
        </button>
      </div>

      <svg viewBox="0 0 320 260" className="h-[220px] w-full">
        {/* orbit guide */}
        <circle
          cx="160"
          cy="130"
          r={related.length <= 4 ? 78 : 92}
          fill="none"
          stroke="rgba(28,36,51,0.08)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />

        {layout.map((n) => (
          <line
            key={`l-${n.concept.id}`}
            x1="160"
            y1="130"
            x2={n.x}
            y2={n.y}
            stroke={reasonColor(n.edge.reason)}
            strokeWidth="1.5"
            opacity={0.55}
          />
        ))}

        {/* center = selected */}
        <circle
          cx="160"
          cy="130"
          r="22"
          fill={statusColor(selected.status)}
          opacity={0.2}
        />
        <circle
          cx="160"
          cy="130"
          r="14"
          fill={statusColor(selected.status)}
          stroke="#fff"
          strokeWidth="2"
        />
        <foreignObject x="100" y="148" width="120" height="36">
          <div className="text-center text-[10px] font-medium leading-tight text-[var(--ink)]">
            {selected.title.length > 28
              ? selected.title.slice(0, 28) + "…"
              : selected.title}
          </div>
        </foreignObject>

        {layout.map((n) => (
          <g
            key={n.concept.id}
            className="cursor-pointer"
            onClick={() => onSelect(n.concept)}
          >
            <circle
              cx={n.x}
              cy={n.y}
              r="18"
              fill={statusColor(n.concept.status)}
              opacity={0.15}
            />
            <circle
              cx={n.x}
              cy={n.y}
              r="10"
              fill={statusColor(n.concept.status)}
              stroke="#fff"
              strokeWidth="1.5"
            />
            <foreignObject
              x={n.x - 48}
              y={n.y + 12}
              width="96"
              height="40"
            >
              <div className="text-center text-[9px] leading-tight text-[var(--ink)]">
                <div className="truncate font-medium">
                  {n.concept.title}
                </div>
                <div className="text-[var(--muted)]">
                  {reasonShort(n.edge.reason)}
                </div>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>

      <div className="space-y-1.5 border-t border-[var(--line)] px-3 py-2">
        {related.slice(0, 4).map(({ concept, edge }) => (
          <button
            key={concept.id}
            type="button"
            onClick={() => onSelect(concept)}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition hover:bg-black/[0.04]"
          >
            <i
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: statusColor(concept.status) }}
            />
            <span className="min-w-0 flex-1 truncate">{concept.title}</span>
            <span className="shrink-0 text-[9px] uppercase tracking-wider text-[var(--muted)]">
              {reasonShort(edge.reason)}
            </span>
          </button>
        ))}
        <p className="px-2 pb-1 text-[9px] text-[var(--muted)]">
          {ZONE_META[selected.region].label} · mastery {selected.mastery}
        </p>
      </div>
    </div>
  );
}
