"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NeuralAtlas } from "@/components/NeuralAtlas";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { KnowledgeGarden, ZONE_META } from "@/components/KnowledgeGarden";
import { SynapseWelcome } from "@/components/SynapseWelcome";
import type {
  Concept,
  QuizQuestion,
  Source,
  TeachCard,
  UserState,
} from "@/lib/types";

type AtlasResponse = {
  user: UserState;
  concepts: Concept[];
  sources: Source[];
  teachCards?: TeachCard[];
  quizBank?: QuizQuestion[];
  blindSpots: string[];
  dueCount: number;
  recentlyMapped: Source[];
};

type AtlasView = "neural" | "graph" | "garden";

const VIEW_KEY = "synapse-atlas-view";
const HERO_KEY = "synapse-hero-seen";

export function AtlasHome() {
  const searchParams = useSearchParams();
  const [atlas, setAtlas] = useState<AtlasResponse | null>(null);
  const [selected, setSelected] = useState<Concept | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sparkIds, setSparkIds] = useState<Set<string>>(new Set());
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [view, setView] = useState<AtlasView>("neural");
  const [showHero, setShowHero] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "neural" || saved === "graph" || saved === "garden") {
        setView(saved);
      } else if (saved === "constellation") {
        setView("neural");
      }
      const seen = localStorage.getItem(HERO_KEY);
      // First visit, or explicit ?welcome=1 for judges
      const forceWelcome = searchParams.get("welcome") === "1";
      if (forceWelcome || !seen) setShowHero(true);
    } catch {
      setShowHero(true);
    }
  }, [searchParams]);

  function dismissHero() {
    setShowHero(false);
    try {
      localStorage.setItem(HERO_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function chooseView(next: AtlasView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const load = useCallback(
    async (opts?: {
      sparkNew?: boolean;
      knownIds?: Set<string>;
      selectId?: string | null;
      sparkIds?: string[];
    }) => {
      const res = await fetch("/api/atlas", { cache: "no-store" });
      const data = (await res.json()) as AtlasResponse;
      setAtlas(data);

      const sparkFromParam = opts?.sparkIds?.filter(Boolean) || [];
      if (sparkFromParam.length > 0) {
        setSparkIds(new Set(sparkFromParam));
        window.setTimeout(() => setSparkIds(new Set()), 4500);
      } else if (opts?.sparkNew) {
        const known = opts.knownIds || new Set<string>();
        const fresh = new Set(
          data.concepts.filter((c) => !known.has(c.id)).map((c) => c.id)
        );
        if (fresh.size > 0) {
          setSparkIds(fresh);
          window.setTimeout(() => setSparkIds(new Set()), 4500);
        }
      }

      const pickId =
        opts?.selectId ||
        sparkFromParam[0] ||
        (opts?.sparkNew
          ? data.concepts.find((c) => !(opts.knownIds || new Set()).has(c.id))
              ?.id
          : null);
      if (pickId) {
        const concept = data.concepts.find((c) => c.id === pickId) || null;
        if (concept) {
          setSelected(concept);
          setView("neural");
          dismissHero();
          setToast(`Mapped · now reading “${concept.title}”`);
          window.setTimeout(() => setToast(null), 4000);
        }
      }
    },
    []
  );

  useEffect(() => {
    const selectId = searchParams.get("select");
    const sparkParam = searchParams.get("spark");
    const ingested = searchParams.get("ingested") === "1";
    const sparkIds = sparkParam
      ? sparkParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    load({
      selectId,
      sparkIds,
      sparkNew: ingested && sparkIds.length === 0,
    });
  }, [load, searchParams]);

  const dueConcepts = useMemo(() => {
    if (!atlas) return [] as Concept[];
    return atlas.concepts.filter(
      (c) => c.status === "due" || c.status === "overdue"
    );
  }, [atlas]);

  const searchHits = useMemo(() => {
    if (!atlas) return [] as Concept[];
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return atlas.concepts
      .filter((c) => {
        const zone = ZONE_META[c.region];
        return (
          c.title.toLowerCase().includes(q) ||
          zone.label.toLowerCase().includes(q) ||
          zone.plain.toLowerCase().includes(q) ||
          c.region.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [atlas, searchQuery]);

  function pickFromSearch(concept: Concept) {
    setSelected(concept);
    dismissHero();
    setSearchQuery("");
    setSearchOpen(false);
  }

  async function ingestPaste() {
    if (pasteText.trim().length < 20) return;
    setBusy(true);
    try {
      const knownIds = new Set((atlas?.concepts || []).map((c) => c.id));
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Pasted knowledge",
          sourceUrl: "paste://local",
          rawText: pasteText,
        }),
      });
      const data = await res.json();
      const newConcepts = (data.concepts || []) as Concept[];
      const newIds = newConcepts.map((c) => c.id);
      setToast(
        newConcepts[0]
          ? `Mapped ${newIds.length} · opening “${newConcepts[0].title}”`
          : `Mapped ${newIds.length} concepts into your network`
      );
      setPasteOpen(false);
      setPasteText("");
      dismissHero();
      await load({
        sparkNew: true,
        knownIds,
        selectId: newIds[0] || null,
        sparkIds: newIds,
      });
      if (newConcepts[0]) setSelected(newConcepts[0]);
      window.setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(false);
    }
  }

  if (!atlas) {
    return (
      <main className="relative h-dvh w-full overflow-hidden bg-[var(--bg)]">
        <div className="absolute inset-0 grid place-items-center text-[var(--muted)]">
          Waking neurons…
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[var(--bg)]">
      {view === "neural" ? (
        <NeuralAtlas
          concepts={atlas.concepts}
          sources={atlas.sources}
          quizBank={atlas.quizBank}
          teachCards={atlas.teachCards}
          selectedId={selected?.id}
          sparkIds={sparkIds}
          vitality={atlas.user.vitality}
          onSelect={setSelected}
          onDeselect={() => setSelected(null)}
        />
      ) : view === "graph" ? (
        <KnowledgeGraph
          concepts={atlas.concepts}
          sources={atlas.sources}
          quizBank={atlas.quizBank}
          teachCards={atlas.teachCards}
          selectedId={selected?.id}
          sparkIds={sparkIds}
          onSelect={setSelected}
          onDeselect={() => setSelected(null)}
        />
      ) : (
        <KnowledgeGarden
          concepts={atlas.concepts}
          selectedId={selected?.id}
          sparkIds={sparkIds}
          vitality={atlas.user.vitality}
          onSelect={setSelected}
          onDeselect={() => setSelected(null)}
        />
      )}

      <div className="pointer-events-none absolute left-6 top-6 z-20 md:left-10 md:top-8">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">
          {view === "neural"
            ? "Neural atlas"
            : view === "graph"
              ? "Knowledge graph"
              : "Knowledge grove"}
        </p>
        <h1 className="font-display text-4xl leading-none text-[var(--accent)] md:text-6xl mt-1">
          Synapse
        </h1>
        <p className="mt-2 max-w-xs text-xs text-[var(--muted)]">
          {view === "neural"
            ? "Turn anything you read into a living second brain — revise before you forget."
            : view === "graph"
              ? "Edges show why ideas belong together."
              : "What you revise stays green. What you ignore dries out."}
        </p>
      </div>

      <div className="pointer-events-auto absolute inset-x-6 top-[8.5rem] z-30 md:inset-x-auto md:left-1/2 md:top-7 md:w-[min(22rem,calc(100vw-22rem))] md:-translate-x-1/2">
        <label className="sr-only" htmlFor="atlas-concept-search">
          Search concepts
        </label>
        <div className="relative w-full">
          <input
            id="atlas-concept-search"
            type="search"
            value={searchQuery}
            autoComplete="off"
            placeholder="Search concepts…"
            onFocus={() => setSearchOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setSearchOpen(false), 150);
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                setSearchOpen(false);
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Enter" && searchHits[0]) {
                e.preventDefault();
                pickFromSearch(searchHits[0]);
              }
            }}
            className="w-full rounded-full border border-[var(--line)] bg-white/80 py-2.5 pl-4 pr-10 text-sm text-[var(--ink)] shadow-sm outline-none backdrop-blur-md placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path
                d="M20 20l-3.5-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          {searchOpen && searchQuery.trim().length > 0 && (
            <ul
              role="listbox"
              aria-label="Concept matches"
              className="absolute left-0 right-0 top-[calc(100%+0.4rem)] max-h-64 overflow-auto rounded-2xl border border-[var(--line)] bg-white/95 py-1 shadow-lg backdrop-blur-md"
            >
              {searchHits.length === 0 ? (
                <li className="px-4 py-3 text-xs text-[var(--muted)]">
                  No concepts match “{searchQuery.trim()}”
                </li>
              ) : (
                searchHits.map((c) => (
                  <li key={c.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left hover:bg-[var(--accent)]/8"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickFromSearch(c)}
                    >
                      <span className="truncate text-sm text-[var(--ink)]">
                        {c.title}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        {ZONE_META[c.region].label}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute right-6 top-6 z-20 flex flex-col items-end gap-2 md:right-10 md:top-8">
        <div className="flex flex-wrap justify-end gap-2">
          <span className="hud-chip">
            {atlas.dueCount > 0
              ? `${atlas.dueCount} fading`
              : `${atlas.user.streak}d streak`}
          </span>
          <span className="hud-chip">XP {atlas.user.xp}</span>
          <span className="hud-chip">
            Vitality{" "}
            <span className="text-[var(--sky)]">{atlas.user.vitality}%</span>
          </span>
        </div>
        <div
          className="pointer-events-auto inline-flex rounded-full border border-[var(--line)] bg-white/75 p-1 text-xs backdrop-blur-md"
          role="group"
          aria-label="Atlas view"
        >
          <button
            type="button"
            onClick={() => chooseView("neural")}
            className={`rounded-full px-3 py-1.5 transition ${
              view === "neural"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Neural
          </button>
          <button
            type="button"
            onClick={() => chooseView("graph")}
            className={`rounded-full px-3 py-1.5 transition ${
              view === "graph"
                ? "bg-[var(--sky)] text-white"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Graph
          </button>
          <button
            type="button"
            onClick={() => chooseView("garden")}
            className={`rounded-full px-3 py-1.5 transition ${
              view === "garden"
                ? "bg-[var(--mint)] text-white"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Garden
          </button>
        </div>
      </div>

      {selected && (
        <div className="pointer-events-auto absolute bottom-28 left-6 z-20 max-w-sm hud-glass rounded-2xl p-4 md:left-10">
          <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">
            {ZONE_META[selected.region].label} · {selected.status}
            {sparkIds.has(selected.id) ? " · just added" : ""}
          </p>
          <h2 className="font-display mt-1 text-2xl text-[var(--ink)]">
            {selected.title}
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Mastery {selected.mastery} ·{" "}
            {selected.status === "due" || selected.status === "overdue"
              ? "needs review"
              : selected.status === "fresh"
                ? "newly mapped"
                : "holding strong"}
          </p>
          {(() => {
            const teach =
              atlas.teachCards?.find((t) => t.conceptId === selected.id) ||
              null;
            if (!teach?.summary?.length) {
              return (
                <p className="mt-2 text-[10px] text-[var(--muted)]">
                  Linked neurons stay lit — click a neighbor to traverse.
                </p>
              );
            }
            return (
              <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-[var(--ink)]">
                {teach.summary.slice(0, 3).map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            );
          })()}
          <div className="mt-3 flex gap-3">
            <Link
              href="/today"
              className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-[10px] font-semibold text-white"
            >
              Review in path
            </Link>
            <button
              type="button"
              className="text-[10px] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)]"
              onClick={() => setSelected(null)}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {showHero && !pasteOpen && !selected && (
        <SynapseWelcome
          dueCount={atlas.dueCount}
          onDismiss={dismissHero}
          onAlchemize={() => {
            setPasteOpen(true);
          }}
        />
      )}

      {(!showHero || pasteOpen) && (
        <div className="pointer-events-auto absolute bottom-6 left-6 z-20 flex items-end gap-2 md:left-10">
          {!pasteOpen ? (
            <button
              type="button"
              onClick={() => setPasteOpen(true)}
              className="hud-glass rounded-full px-4 py-2 text-xs uppercase tracking-wider hover:border-[var(--accent)]"
            >
              Alchemize
            </button>
          ) : (
            <div className="hud-glass w-[min(340px,80vw)] space-y-2 rounded-2xl p-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={4}
                placeholder="Paste an article or note…"
                className="w-full rounded-xl border border-[var(--line)] bg-white/70 p-2 text-xs outline-none focus:border-[var(--sky)]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || pasteText.trim().length < 20}
                  onClick={ingestPaste}
                  className="rounded-full bg-[var(--amber)] px-4 py-1.5 text-xs font-semibold text-[#1a1000] disabled:opacity-40"
                >
                  {busy ? "Mapping…" : "Map"}
                </button>
                <button
                  type="button"
                  onClick={() => setPasteOpen(false)}
                  className="rounded-full px-3 py-1.5 text-xs text-[var(--muted)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!pasteOpen && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMemoryOpen((v) => !v)}
                className="hud-glass rounded-full px-3 py-2 text-[10px] uppercase tracking-wider"
              >
                Memory
              </button>
              {memoryOpen && (
                <div className="hud-glass absolute bottom-12 left-0 w-64 space-y-3 rounded-2xl p-3 text-xs">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">
                      Recently mapped
                    </p>
                    <ul className="mt-1 space-y-1">
                      {atlas.recentlyMapped.slice(0, 3).map((s: Source) => (
                        <li key={s.id} className="truncate text-[var(--ink)]">
                          {s.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-[var(--rose)]">
                      Blind spots
                    </p>
                    <ul className="mt-1 space-y-1">
                      {atlas.blindSpots.slice(0, 2).map((b) => (
                        <li key={b} className="line-clamp-2 text-[var(--muted)]">
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="pointer-events-auto absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
        <Link
          href="/today"
          className="inline-flex items-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(228,87,46,0.25)] transition hover:brightness-105"
        >
          {atlas.dueCount > 0 ? "Start today's path" : "Open today's path"}
          {atlas.dueCount > 0 ? (
            <span className="ml-2 rounded-full bg-black/15 px-2 py-0.5 text-[10px]">
              {atlas.dueCount} due
            </span>
          ) : null}
        </Link>
      </div>

      {atlas.dueCount > 0 && !selected && !showHero && (
        <div className="pointer-events-none absolute left-1/2 top-28 z-10 hidden -translate-x-1/2 md:block">
          <p className="rounded-full border border-[rgba(232,160,23,0.35)] bg-[rgba(255,248,230,0.85)] px-4 py-1.5 text-[11px] text-[var(--ink)] backdrop-blur-sm">
            {dueConcepts
              .slice(0, 2)
              .map((c) => c.title)
              .join(" · ")}
            {dueConcepts.length > 2 ? "…" : ""} need review
          </p>
        </div>
      )}

      {toast && (
        <div className="pointer-events-auto fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--line)] bg-white/95 px-5 py-3 text-sm shadow-md">
          {toast}
          <button
            type="button"
            className="ml-3 text-[var(--accent)]"
            onClick={() => setToast(null)}
          >
            dismiss
          </button>
        </div>
      )}
    </main>
  );
}
