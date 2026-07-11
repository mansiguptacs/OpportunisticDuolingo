"use client";

import type { BrainRegion, Concept } from "@/lib/types";
import { statusColor } from "@/components/brain/anchors";

export const REGION_META: Record<
  BrainRegion,
  { label: string; plain: string; color: string }
> = {
  prefrontal: {
    label: "Prefrontal",
    plain: "Planning & systems",
    color: "#3d7dd9",
  },
  parietal: {
    label: "Parietal",
    plain: "Structure & patterns",
    color: "#2a9d8f",
  },
  temporal: {
    label: "Temporal",
    plain: "Language & stories",
    color: "#e8a017",
  },
  hippocampus: {
    label: "Hippocampus",
    plain: "Memory & recall",
    color: "#d94f6a",
  },
};

const ORDER: BrainRegion[] = [
  "prefrontal",
  "parietal",
  "temporal",
  "hippocampus",
];

function statusLabel(status: string) {
  switch (status) {
    case "strong":
      return "Solid";
    case "fresh":
      return "New";
    case "due":
      return "Due today";
    case "overdue":
      return "Overdue";
    default:
      return status;
  }
}

export function MindMap({
  concepts,
  selectedId,
  activeRegion,
  sparkIds,
  onSelectConcept,
  onSelectRegion,
}: {
  concepts: Concept[];
  selectedId?: string | null;
  activeRegion: BrainRegion | null;
  sparkIds?: Set<string>;
  onSelectConcept: (c: Concept) => void;
  onSelectRegion: (r: BrainRegion | null) => void;
}) {
  return (
    <div className="grid w-full gap-4 md:grid-cols-2 md:gap-5">
      {ORDER.map((region, i) => {
        const meta = REGION_META[region];
        const items = concepts.filter((c) => c.region === region);
        const due = items.filter(
          (c) => c.status === "due" || c.status === "overdue"
        ).length;
        const focused = activeRegion === region;
        const dimmed = activeRegion !== null && !focused;

        return (
          <section
            key={region}
            className={`rounded-3xl border bg-white/85 p-5 transition duration-300 ${
              focused
                ? "border-[var(--accent)] shadow-md"
                : "border-[var(--line)] hover:border-[var(--muted)]"
            } ${dimmed ? "opacity-40" : "opacity-100"}`}
            style={{
              animation: "region-in 560ms ease both",
              animationDelay: `${i * 70}ms`,
            }}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onSelectRegion(focused ? null : region)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <h2 className="font-display text-2xl text-[var(--ink)]">
                      {meta.label}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{meta.plain}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold tabular-nums text-[var(--ink)]">
                    {items.length}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    {due > 0 ? (
                      <span className="text-[var(--amber)]">{due} due</span>
                    ) : (
                      "concepts"
                    )}
                  </p>
                </div>
              </div>
            </button>

            <ul className="mt-4 space-y-1.5">
              {items.length === 0 && (
                <li className="text-sm text-[var(--muted)]">
                  Nothing mapped yet
                </li>
              )}
              {items.map((c) => {
                const active = selectedId === c.id;
                const spark = sparkIds?.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectRegion(region);
                        onSelectConcept(c);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                        active
                          ? "bg-[rgba(228,87,46,0.1)] ring-1 ring-[var(--accent)]"
                          : "hover:bg-black/[0.03]"
                      } ${spark ? "ring-1 ring-[var(--sky)]" : ""}`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: statusColor(c.status) }}
                        title={statusLabel(c.status)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                        {c.title}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        {statusLabel(c.status)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <style jsx global>{`
        @keyframes region-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
