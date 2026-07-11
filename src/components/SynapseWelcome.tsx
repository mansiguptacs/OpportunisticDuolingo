"use client";

import Link from "next/link";

const STEPS = [
  { n: "1", title: "Capture", body: "Alchemize a page into concepts" },
  { n: "2", title: "Revise", body: "Teach → probe → quiz before fade" },
  { n: "3", title: "Remember", body: "Witty nudges keep the atlas alive" },
];

export function SynapseWelcome({
  dueCount,
  onDismiss,
  onAlchemize,
}: {
  dueCount: number;
  onDismiss: () => void;
  onAlchemize: () => void;
}) {
  return (
    <aside className="pointer-events-auto absolute bottom-28 left-6 z-30 w-[min(340px,calc(100vw-3rem))] md:left-10">
      <div className="hud-glass overflow-hidden rounded-3xl p-4 shadow-[0_16px_48px_rgba(28,36,51,0.12)] md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">
              How Synapse works
            </p>
            <p className="mt-1.5 text-sm leading-snug text-[var(--ink)]">
              Turn anything you read into a{" "}
              <span className="text-[var(--accent)]">living second brain</span> —
              then revise before you forget.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)]"
            aria-label="Dismiss welcome"
          >
            Got it
          </button>
        </div>

        <ol className="mt-3 space-y-1.5">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="flex items-baseline gap-2 text-[11px] leading-snug"
            >
              <span className="font-display text-sm text-[var(--accent)]">
                {step.n}
              </span>
              <span>
                <span className="font-medium text-[var(--ink)]">{step.title}</span>
                <span className="text-[var(--muted)]"> — {step.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/today"
            className="inline-flex items-center rounded-full bg-[var(--accent)] px-3.5 py-2 text-[11px] font-semibold text-white"
          >
            Today&apos;s path
            {dueCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-black/15 px-1.5 py-0.5 text-[9px]">
                {dueCount}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={onAlchemize}
            className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-2 text-[11px] text-[var(--ink)] hover:border-[var(--sky)]"
          >
            Alchemize
          </button>
        </div>

        <p className="mt-3 text-[9px] leading-relaxed text-[var(--muted)]">
          The brain behind you is your atlas — click a pin anytime. Chrome
          extension sends revisit nudges.
        </p>
      </div>
    </aside>
  );
}
