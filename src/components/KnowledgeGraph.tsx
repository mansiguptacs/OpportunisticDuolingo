"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Concept,
  ConceptStatus,
  QuizQuestion,
  Source,
  TeachCard,
} from "@/lib/types";

export type GraphEdgeReason = "source" | "quiz" | "synthesis";

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  reason: GraphEdgeReason;
  label: string;
};

type SimNode = {
  id: string;
  concept: Concept;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

function statusFill(status: ConceptStatus) {
  switch (status) {
    case "strong":
      return "#2a9d8f";
    case "fresh":
      return "#3d7dd9";
    case "due":
      return "#e8a017";
    case "overdue":
      return "#d94f6a";
    default:
      return "#3d7dd9";
  }
}

function statusLabel(status: ConceptStatus) {
  switch (status) {
    case "strong":
      return "thriving";
    case "fresh":
      return "sprout";
    case "due":
      return "drying";
    case "overdue":
      return "withered";
    default:
      return status;
  }
}

function reasonColor(reason: GraphEdgeReason) {
  switch (reason) {
    case "source":
      return "#3d7dd9";
    case "quiz":
      return "#2a9d8f";
    case "synthesis":
      return "#e4572e";
  }
}

export function buildKnowledgeEdges(
  concepts: Concept[],
  sources: Source[],
  quizBank: QuizQuestion[] = [],
  teachCards: TeachCard[] = []
): GraphEdge[] {
  const pairBest = new Map<string, GraphEdge>();
  const sourceTitle = new Map(sources.map((s) => [s.id, s.title]));
  const reasonRank: Record<GraphEdgeReason, number> = {
    synthesis: 3,
    quiz: 2,
    source: 1,
  };

  const add = (
    a: string,
    b: string,
    reason: GraphEdgeReason,
    label: string
  ) => {
    if (a === b) return;
    const [x, y] = a < b ? [a, b] : [b, a];
    const pairKey = `${x}:${y}`;
    const edge: GraphEdge = {
      id: `${reason}:${pairKey}`,
      source: a,
      target: b,
      reason,
      label,
    };
    const prev = pairBest.get(pairKey);
    if (!prev || reasonRank[reason] > reasonRank[prev.reason]) {
      pairBest.set(pairKey, edge);
    }
  };

  // Same article / note
  const bySource = new Map<string, Concept[]>();
  for (const c of concepts) {
    const list = bySource.get(c.sourceId) || [];
    list.push(c);
    bySource.set(c.sourceId, list);
  }
  for (const [sid, group] of Array.from(bySource.entries())) {
    if (group.length < 2) continue;
    const title = sourceTitle.get(sid) || "Same source";
    const label = `From “${title.length > 36 ? title.slice(0, 36) + "…" : title}”`;
    // Star + chain (not full clique) so clusters stay readable
    const ordered = [...group].sort((a, b) => b.mastery - a.mastery);
    const hub = ordered[0];
    for (let i = 1; i < ordered.length; i++) {
      add(hub.id, ordered[i].id, "source", label);
      if (i > 1) add(ordered[i - 1].id, ordered[i].id, "source", label);
    }
  }

  // Quiz co-occurrence / synthesis
  for (const q of quizBank) {
    const ids = q.conceptIds.filter((id) => concepts.some((c) => c.id === id));
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        add(
          ids[i],
          ids[j],
          q.synthesizesWith ? "synthesis" : "quiz",
          q.synthesizesWith
            ? `Synthesizes: ${q.synthesizesWith}`
            : "Practiced together in a quiz"
        );
      }
    }
  }

  // Teach cards that share a concept with quiz neighbors — light link via sequential teach on same ingest batch
  // (optional) link teach card concepts that appear in same source already covered

  // Ensure isolates get a soft thematic neighbor
  const linked = new Set<string>();
  Array.from(pairBest.values()).forEach((e) => {
    linked.add(e.source);
    linked.add(e.target);
  });
  const isolates = concepts.filter((c) => !linked.has(c.id));
  for (const iso of isolates) {
    const peers = concepts.filter(
      (c) => c.id !== iso.id && c.region === iso.region && linked.has(c.id)
    );
    const peer =
      peers.sort(
        (a, b) =>
          Math.abs(a.mastery - iso.mastery) - Math.abs(b.mastery - iso.mastery)
      )[0] ||
      concepts
        .filter((c) => c.id !== iso.id && c.region === iso.region)
        .sort((a, b) => b.mastery - a.mastery)[0];
    if (peer) {
      add(iso.id, peer.id, "source", "Nearby in the same learning theme");
    }
  }

  void teachCards;
  return Array.from(pairBest.values());
}

function nodeRadius(c: Concept) {
  return 10 + Math.min(c.mastery, 100) / 12;
}

export function KnowledgeGraph({
  concepts,
  sources,
  quizBank = [],
  teachCards = [],
  selectedId,
  sparkIds,
  onSelect,
  onDeselect,
}: {
  concepts: Concept[];
  sources: Source[];
  quizBank?: QuizQuestion[];
  teachCards?: TeachCard[];
  selectedId?: string | null;
  sparkIds?: Set<string>;
  onSelect: (c: Concept) => void;
  onDeselect?: () => void;
}) {
  const edges = useMemo(
    () => buildKnowledgeEdges(concepts, sources, quizBank, teachCards),
    [concepts, sources, quizBank, teachCards]
  );

  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });

  // init positions
  useEffect(() => {
    const w = size.w;
    const h = size.h;
    const next: SimNode[] = concepts.map((c, i) => {
      const angle = (i / Math.max(concepts.length, 1)) * Math.PI * 2;
      const r = 80 + (i % 5) * 28;
      return {
        id: c.id,
        concept: c,
        x: w / 2 + Math.cos(angle) * r,
        y: h / 2 + Math.sin(angle) * r * 0.75,
        vx: 0,
        vy: 0,
      };
    });
    nodesRef.current = next;
    setNodes(next);
  }, [concepts, size.w, size.h]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(r.width, 640), h: Math.max(r.height, 480) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: Math.max(r.width, 640), h: Math.max(r.height, 480) });
    return () => ro.disconnect();
  }, []);

  // force simulation
  useEffect(() => {
    let frame = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      const ns = nodesRef.current;
      if (ns.length === 0) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const w = size.w;
      const h = size.h;
      const cx = w / 2;
      const cy = h / 2;

      for (const n of ns) {
        n.vx *= 0.86;
        n.vy *= 0.86;
        // center gravity
        n.vx += (cx - n.x) * 0.0018;
        n.vy += (cy - n.y) * 0.0018;
      }

      // repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i];
          const b = ns[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const minD = nodeRadius(a.concept) + nodeRadius(b.concept) + 28;
          if (dist < minD) {
            const push = ((minD - dist) / dist) * 0.35;
            dx *= push;
            dy *= push;
            if (dragId !== a.id) {
              a.vx -= dx;
              a.vy -= dy;
            }
            if (dragId !== b.id) {
              b.vx += dx;
              b.vy += dy;
            }
          } else {
            const force = 420 / (dist * dist);
            dx = (dx / dist) * force;
            dy = (dy / dist) * force;
            if (dragId !== a.id) {
              a.vx -= dx;
              a.vy -= dy;
            }
            if (dragId !== b.id) {
              b.vx += dx;
              b.vy += dy;
            }
          }
        }
      }

      // springs along edges
      const byId = new Map(ns.map((n) => [n.id, n]));
      for (const e of edges) {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const ideal =
          e.reason === "synthesis" ? 110 : e.reason === "quiz" ? 130 : 160;
        const k = e.reason === "synthesis" ? 0.028 : 0.018;
        const f = ((dist - ideal) / dist) * k;
        const fx = dx * f;
        const fy = dy * f;
        if (dragId !== a.id) {
          a.vx += fx;
          a.vy += fy;
        }
        if (dragId !== b.id) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      for (const n of ns) {
        if (dragId === n.id) continue;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(40, Math.min(w - 40, n.x));
        n.y = Math.max(40, Math.min(h - 40, n.y));
      }

      setNodes(ns.map((n) => ({ ...n })));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [edges, size.w, size.h, dragId]);

  const focusId = selectedId || hoveredId;
  const neighborIds = useMemo(() => {
    if (!focusId) return null;
    const s = new Set<string>([focusId]);
    for (const e of edges) {
      if (e.source === focusId) s.add(e.target);
      if (e.target === focusId) s.add(e.source);
    }
    return s;
  }, [focusId, edges]);

  const focusEdges = useMemo(() => {
    if (!selectedId) return [] as GraphEdge[];
    return edges.filter(
      (e) => e.source === selectedId || e.target === selectedId
    );
  }, [edges, selectedId]);

  function clientToSvg(clientX: number, clientY: number) {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * size.w,
      y: ((clientY - r.top) / r.height) * size.h,
    };
  }

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="h-full w-full touch-none"
        role="img"
        aria-label="Knowledge graph"
        onPointerUp={() => {
          setDragId(null);
          dragRef.current = null;
        }}
        onPointerLeave={() => {
          setDragId(null);
          dragRef.current = null;
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const p = clientToSvg(e.clientX, e.clientY);
          const ns = nodesRef.current;
          const n = ns.find((x) => x.id === dragRef.current!.id);
          if (!n) return;
          n.x = p.x;
          n.y = p.y;
          n.vx = 0;
          n.vy = 0;
          nodesRef.current = [...ns];
          setNodes(ns.map((x) => ({ ...x })));
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onDeselect?.();
        }}
      >
        <defs>
          <radialGradient id="graph-bg" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#fff9f2" />
            <stop offset="55%" stopColor="#f0ebe3" />
            <stop offset="100%" stopColor="#e4ddd2" />
          </radialGradient>
        </defs>
        <rect
          width={size.w}
          height={size.h}
          fill="url(#graph-bg)"
          onClick={() => onDeselect?.()}
        />

        {/* soft ambient dots */}
        {Array.from({ length: 24 }).map((_, i) => (
          <circle
            key={i}
            cx={(i * 97) % size.w}
            cy={(i * 53) % size.h}
            r={1.2}
            fill="#c4b8a8"
            opacity={0.35}
          />
        ))}

        {/* edges */}
        {edges.map((e) => {
          const a = nodes.find((n) => n.id === e.source);
          const b = nodes.find((n) => n.id === e.target);
          if (!a || !b) return null;
          const active =
            !neighborIds ||
            (neighborIds.has(e.source) && neighborIds.has(e.target));
          const hot =
            selectedId &&
            (e.source === selectedId || e.target === selectedId);
          return (
            <line
              key={e.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={reasonColor(e.reason)}
              strokeWidth={hot ? 2.4 : 1.2}
              opacity={active ? (hot ? 0.85 : 0.28) : 0.04}
              strokeLinecap="round"
            />
          );
        })}

        {/* nodes */}
        {nodes.map((n) => {
          const c = n.concept;
          const r = nodeRadius(c);
          const fill = statusFill(c.status);
          const dim = neighborIds && !neighborIds.has(n.id);
          const active = selectedId === n.id || hoveredId === n.id;
          const spark = sparkIds?.has(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${n.x} ${n.y})`}
              className="cursor-pointer"
              opacity={dim ? 0.18 : 1}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragId(n.id);
                dragRef.current = { id: n.id, ox: n.x, oy: n.y };
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(c);
              }}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <circle
                r={r + 8}
                fill={fill}
                opacity={active ? 0.2 : 0.08}
                className={spark ? "garden-pop" : undefined}
              />
              <circle
                r={r}
                fill={fill}
                stroke={active ? "#1c2433" : "#fff"}
                strokeWidth={active ? 2 : 1.5}
                opacity={c.status === "overdue" ? 0.75 : 0.95}
              />
              {/* withered ring */}
              {c.status === "overdue" && (
                <circle
                  r={r + 3}
                  fill="none"
                  stroke={fill}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.7}
                />
              )}
              {(active || spark) && (
                <foreignObject x={-70} y={-r - 28} width={140} height={24}>
                  <div
                    className="truncate rounded-md border bg-white/95 px-2 py-0.5 text-center text-[10px] shadow-sm"
                    style={{
                      borderColor: fill,
                      color: "#1c2433",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {c.title}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>

      {/* connection legend chip when selected */}
      {selectedId && focusEdges.length > 0 && (
        <div className="pointer-events-none absolute bottom-28 right-6 z-20 max-w-xs md:right-10">
          <div className="hud-glass rounded-2xl p-3 text-xs">
            <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">
              Why these connect
            </p>
            <ul className="mt-2 space-y-1.5">
              {focusEdges.slice(0, 4).map((e) => {
                const otherId =
                  e.source === selectedId ? e.target : e.source;
                const other = concepts.find((c) => c.id === otherId);
                return (
                  <li key={e.id} className="flex gap-2">
                    <i
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: reasonColor(e.reason) }}
                    />
                    <span className="text-[var(--ink)]">
                      <span className="font-medium">{other?.title || "…"}</span>
                      <span className="block text-[10px] text-[var(--muted)]">
                        {e.label}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* edge type key */}
      <div className="pointer-events-none absolute bottom-20 left-6 flex flex-wrap gap-3 text-[9px] uppercase tracking-wider text-[var(--muted)] md:left-10">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-0.5 w-3 rounded bg-[var(--sky)]" /> same source
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-0.5 w-3 rounded bg-[var(--mint)]" /> practiced together
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-0.5 w-3 rounded bg-[var(--accent)]" /> synthesis
        </span>
        <span className="ml-2 inline-flex items-center gap-1.5">
          <i className="h-1.5 w-1.5 rounded-full bg-[var(--mint)]" />{" "}
          {statusLabel("strong")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-1.5 w-1.5 rounded-full bg-[var(--amber)]" /> drying
        </span>
      </div>
    </div>
  );
}
