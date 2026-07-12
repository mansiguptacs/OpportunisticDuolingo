"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  MistakeAutopsy,
  QuizQuestion,
  TodayPath,
  TodayStep,
} from "@/lib/types";
import { MermaidDiagram } from "@/components/MermaidDiagram";

export const runtime = "edge";

type SessionStats = {
  xp: number;
  streak: number;
  vitality: number;
  reinforced: { id: string; title: string; mastery: number }[];
  linked: { id: string; title: string }[];
  lastAutopsy?: MistakeAutopsy;
  lastCorrect?: boolean;
};

function VitalityChip({
  hours,
  status,
}: {
  hours: number;
  status: string;
}) {
  const urgent = status === "overdue" || hours <= 6;
  return (
    <p
      className={`mt-2 text-xs ${
        urgent ? "text-[var(--amber)]" : "text-[var(--muted)]"
      }`}
    >
      {status === "overdue"
        ? "Already overdue — vitality at stake."
        : hours <= 0
          ? "Drops overdue very soon."
          : `Drops overdue in ~${hours}h if ignored.`}
    </p>
  );
}

function QuizBlock({
  label,
  question,
  timedSeconds,
  onDone,
}: {
  label: string;
  question: QuizQuestion;
  timedSeconds?: number;
  onDone: (payload: SessionStats & { correct: boolean }) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [left, setLeft] = useState(timedSeconds ?? 0);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<
    (SessionStats & { correct: boolean }) | null
  >(null);

  useEffect(() => {
    if (!timedSeconds) return;
    setLeft(timedSeconds);
    const id = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timedSeconds, question.id]);

  async function submit(forcedIndex?: number) {
    const idx = forcedIndex ?? choice;
    if (idx === null || busy) return;
    setBusy(true);
    const ephemeral = question.id.startsWith("probe-") ? question : undefined;
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        questionId: question.id,
        choiceIndex: idx,
        ephemeral,
      }),
    });
    const data = await res.json();
    const payload = {
      correct: Boolean(data.correct),
      xp: data.xpGained || 0,
      streak: data.streak || 0,
      vitality: data.vitality || 0,
      reinforced: data.reinforced || [],
      linked: data.linked || [],
      lastAutopsy: data.autopsy,
      lastCorrect: Boolean(data.correct),
    };
    setLocal(payload);
    setBusy(false);
  }

  useEffect(() => {
    if (timedSeconds && left === 0 && !local && choice === null && !busy) {
      // time up — auto-submit wrong-ish first choice if none picked, else choice
      void submit(choice ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  return (
    <article className="surface-card rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-widest text-[var(--amber)]">
          {label}
        </p>
        {typeof timedSeconds === "number" && !local && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              left <= 8
                ? "bg-[var(--amber)] text-[#1a1000]"
                : "bg-black/5 text-[var(--muted)]"
            }`}
          >
            {left}s
          </span>
        )}
      </div>
      <h1 className="font-display text-2xl md:text-3xl mt-2">
        {question.prompt}
      </h1>
      {question.synthesizesWith && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Blind-spot synthesis with{" "}
          <span className="text-[var(--rose)]">{question.synthesizesWith}</span>
        </p>
      )}
      <div className="mt-6 space-y-3">
        {question.choices.map((c, i) => (
          <button
            key={c}
            type="button"
            disabled={!!local || busy}
            onClick={() => setChoice(i)}
            className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
              choice === i
                ? "border-[var(--sky)] bg-[rgba(61,125,217,0.1)]"
                : "border-[var(--line)] bg-white/50 hover:border-[var(--muted)]"
            }`}
          >
            <span className="text-[var(--muted)] mr-2">
              {String.fromCharCode(65 + i)}.
            </span>
            {c}
          </button>
        ))}
      </div>

      {!local ? (
        <button
          type="button"
          disabled={choice === null || busy}
          onClick={() => submit()}
          className="mt-8 w-full rounded-xl bg-[var(--amber)] px-4 py-3 text-sm font-semibold text-[#1a1000] disabled:opacity-40"
        >
          {busy ? "Checking…" : "Submit"}
        </button>
      ) : (
        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-white/60 p-4">
            <p
              className={`font-display text-2xl ${
                local.correct ? "text-[var(--mint)]" : "text-[var(--amber)]"
              }`}
            >
              {local.correct ? "Synapses strengthened" : "Not quite — autopsy"}
            </p>
            <p className="text-sm text-[var(--muted)] mt-2">
              +{local.xp} XP · streak {local.streak} · vitality {local.vitality}%
            </p>
          </div>
          {local.lastAutopsy && (
            <div className="rounded-xl border border-[var(--line)] bg-white/70 p-4 text-sm space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                Mistake autopsy
              </p>
              <p>{local.lastAutopsy.whyCorrect}</p>
              <p className="text-[var(--muted)]">{local.lastAutopsy.whyTempting}</p>
              {!local.correct && (
                <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                  {local.lastAutopsy.distractorNotes.slice(0, 2).map((n) => (
                    <li key={n}>▸ {n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button
            type="button"
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => onDone(local)}
          >
            Continue
          </button>
        </div>
      )}
    </article>
  );
}

function ExplainBlock({
  label,
  prompt,
  conceptId,
  keyPoints,
  mode,
  onDone,
}: {
  label: string;
  prompt: string;
  conceptId: string;
  keyPoints: string[];
  mode: "feynman" | "explain_back";
  onDone: (payload: SessionStats) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    feedback: string;
    xp: number;
    streak: number;
    vitality: number;
    reinforced: SessionStats["reinforced"];
    linked: SessionStats["linked"];
  } | null>(null);

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/score-explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conceptId, text, mode, keyPoints }),
    });
    const data = await res.json();
    setResult({
      score: data.score || 0,
      feedback: data.feedback || "",
      xp: data.xpGained || 0,
      streak: data.streak || 0,
      vitality: data.vitality || 0,
      reinforced: data.reinforced || [],
      linked: data.linked || [],
    });
    setBusy(false);
  }

  return (
    <article className="surface-card rounded-2xl p-6 md:p-8">
      <p className="text-xs uppercase tracking-widest text-[var(--sky)]">
        {label}
      </p>
      <h1 className="font-display text-2xl md:text-3xl mt-2">{prompt}</h1>
      {!result ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Type your explanation…"
            className="mt-6 w-full rounded-xl border border-[var(--line)] bg-white/70 p-3 text-sm outline-none focus:border-[var(--sky)]"
          />
          <button
            type="button"
            disabled={text.trim().length < 8 || busy}
            onClick={submit}
            className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Scoring…" : "Submit explanation"}
          </button>
        </>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-white/60 p-4">
            <p className="font-display text-2xl text-[var(--ink)]">
              Score {result.score}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">{result.feedback}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              +{result.xp} XP · streak {result.streak} · vitality{" "}
              {result.vitality}%
            </p>
          </div>
          <button
            type="button"
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() =>
              onDone({
                xp: result.xp,
                streak: result.streak,
                vitality: result.vitality,
                reinforced: result.reinforced,
                linked: result.linked,
              })
            }
          >
            Continue
          </button>
        </div>
      )}
    </article>
  );
}

function Finale({
  path,
  stats,
}: {
  path: TodayPath;
  stats: SessionStats;
}) {
  const nodes = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    for (const r of stats.reinforced) map.set(r.id, r);
    for (const l of stats.linked) map.set(l.id, l);
    for (const p of path.linkedPreview) map.set(p.id, p);
    return Array.from(map.values()).slice(0, 8);
  }, [stats, path]);

  return (
    <article className="surface-card rounded-2xl p-6 md:p-8">
      <p className="text-xs uppercase tracking-widest text-[var(--mint)]">
        Streak theater
      </p>
      <h1 className="font-display text-3xl md:text-4xl mt-2">
        Path complete
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        +{stats.xp} XP this session · streak {stats.streak} · vitality{" "}
        {stats.vitality}%
      </p>

      <div className="mt-8">
        <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Synapse flash
        </p>
        <svg viewBox="0 0 320 220" className="mt-2 h-[200px] w-full">
          <circle
            cx="160"
            cy="100"
            r="70"
            fill="none"
            stroke="rgba(28,36,51,0.08)"
            strokeDasharray="4 6"
          />
          {nodes.map((n, i) => {
            const angle =
              -Math.PI / 2 + (i / Math.max(nodes.length, 1)) * Math.PI * 2;
            const x = 160 + Math.cos(angle) * 70;
            const y = 100 + Math.sin(angle) * 70;
            return (
              <g key={n.id}>
                <line
                  x1="160"
                  y1="100"
                  x2={x}
                  y2={y}
                  stroke="#3d7dd9"
                  strokeWidth="1.5"
                  opacity="0.45"
                />
                <circle cx={x} cy={y} r="9" fill="#e4572e" />
                <foreignObject x={x - 40} y={y + 12} width="80" height="36">
                  <div className="text-center text-[9px] leading-tight text-[var(--ink)]">
                    {n.title.length > 22 ? n.title.slice(0, 22) + "…" : n.title}
                  </div>
                </foreignObject>
              </g>
            );
          })}
          <circle cx="160" cy="100" r="16" fill="#2a9d8f" />
        </svg>
      </div>

      <p className="mt-2 text-xs text-[var(--muted)]">
        Reinforced today: {path.dueTitles.join(" · ") || "your due set"}
      </p>

      <Link
        href="/atlas"
        className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
      >
        See it light up on the atlas
      </Link>
    </article>
  );
}

export default function TodayPage() {
  const [path, setPath] = useState<TodayPath | null>(null);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    xp: 0,
    streak: 0,
    vitality: 0,
    reinforced: [],
    linked: [],
  });

  useEffect(() => {
    fetch("/api/today", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: TodayPath) => setPath(d));
  }, []);

  const step: TodayStep | null = useMemo(() => {
    if (!path || finished) return null;
    return path.steps[index] ?? null;
  }, [path, index, finished]);

  function mergeStats(next: Partial<SessionStats> & { xp?: number }) {
    setStats((s) => ({
      xp: s.xp + (next.xp || 0),
      streak: next.streak ?? s.streak,
      vitality: next.vitality ?? s.vitality,
      reinforced: [
        ...s.reinforced,
        ...((next.reinforced || []).filter(
          (r) => !s.reinforced.some((x) => x.id === r.id)
        )),
      ],
      linked: [
        ...s.linked,
        ...((next.linked || []).filter(
          (r) => !s.linked.some((x) => x.id === r.id)
        )),
      ],
      lastAutopsy: next.lastAutopsy ?? s.lastAutopsy,
      lastCorrect: next.lastCorrect ?? s.lastCorrect,
    }));
  }

  function advance(partial?: Partial<SessionStats> & { xp?: number }) {
    if (partial) mergeStats(partial);
    if (!path) return;
    if (index >= path.steps.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
  }

  if (!path) {
    return (
      <main className="min-h-screen grid place-items-center text-[var(--muted)]">
        Building today&apos;s path…
      </main>
    );
  }

  if (finished || (!step && path.steps.length > 0 && index >= path.steps.length)) {
    return (
      <main className="min-h-screen px-6 py-8 md:px-10 max-w-3xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/atlas"
            className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
          >
            ← Atlas
          </Link>
          <p className="text-xs tracking-widest uppercase text-[var(--muted)]">
            {path.title} · done
          </p>
        </div>
        <Finale path={path} stats={stats} />
      </main>
    );
  }

  if (!step) {
    return (
      <main className="min-h-screen grid place-items-center text-[var(--muted)]">
        Path empty — map a concept first.
      </main>
    );
  }

  const progress = `${index + 1} / ${path.steps.length}`;

  return (
    <main className="min-h-screen px-6 py-8 md:px-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/atlas"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← Atlas
        </Link>
        <p className="text-xs tracking-widest uppercase text-[var(--muted)]">
          {path.title} · {progress}
        </p>
      </div>

      <ol className="flex gap-1.5 mb-8">
        {path.steps.map((s, i) => (
          <li
            key={`${s.type}-${i}`}
            className={`h-2 flex-1 rounded-full ${
              i < index
                ? "bg-[var(--accent)]"
                : i === index
                  ? "bg-[var(--amber)]"
                  : "bg-[var(--line)]"
            }`}
          />
        ))}
      </ol>

      {step.type === "source_rewind" && (
        <article className="surface-card rounded-2xl p-6 md:p-8">
          <p className="text-xs uppercase tracking-widest text-[var(--sky)]">
            Source rewind
          </p>
          <h1 className="font-display text-3xl md:text-4xl mt-2">
            {step.conceptTitle}
          </h1>
          <VitalityChip hours={step.hoursUntilCritical} status={step.status} />
          <blockquote className="mt-6 rounded-2xl border border-[var(--line)] bg-white/70 p-5 text-base leading-relaxed">
            “{step.quote}”
            <footer className="mt-3 text-xs text-[var(--muted)]">
              From {step.sourceTitle}
              {step.sourceUrl ? (
                <>
                  {" · "}
                  <a
                    href={step.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--sky)]"
                  >
                    open source
                  </a>
                </>
              ) : null}
            </footer>
          </blockquote>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Mastery {step.mastery} — re-enter the article before you retrieve.
          </p>
          <button
            type="button"
            className="mt-8 w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => advance()}
          >
            Continue to teach
          </button>
        </article>
      )}

      {step.type === "teach" && (
        <article className="surface-card rounded-2xl p-6 md:p-8">
          <p className="text-xs uppercase tracking-widest text-[var(--sky)]">
            Teach
          </p>
          <h1 className="font-display text-3xl md:text-4xl mt-2">
            {step.card.title}
          </h1>
          <VitalityChip hours={step.hoursUntilCritical} status={step.status} />
          <ul className="mt-6 space-y-3 text-base leading-relaxed">
            {(Array.isArray(step.card.summary)
              ? step.card.summary
              : []
            ).map((line) => (
              <li key={line} className="flex gap-3">
                <span className="text-[var(--accent)]">▸</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {step.card.diagramMermaid && (
            <MermaidDiagram chart={step.card.diagramMermaid} />
          )}
          <button
            type="button"
            className="mt-8 w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => advance()}
          >
            Got it — probe me
          </button>
        </article>
      )}

      {step.type === "probe" && (
        <QuizBlock
          key={step.question.id}
          label={step.mode === "speed" ? "Speed probe · 30s" : "Probe"}
          question={step.question}
          timedSeconds={step.mode === "speed" ? step.seconds : undefined}
          onDone={(payload) =>
            advance({
              xp: payload.xp,
              streak: payload.streak,
              vitality: payload.vitality,
              reinforced: payload.reinforced,
              linked: payload.linked,
              lastAutopsy: payload.lastAutopsy,
              lastCorrect: payload.correct,
            })
          }
        />
      )}

      {step.type === "feynman" && (
        <ExplainBlock
          key={`feynman-${step.conceptId}`}
          label="Feynman micro-lesson"
          prompt={step.prompt}
          conceptId={step.conceptId}
          keyPoints={step.keyPoints}
          mode="feynman"
          onDone={(payload) => advance(payload)}
        />
      )}

      {step.type === "explain_back" && (
        <ExplainBlock
          key={`explain-${step.conceptId}`}
          label="Deep retrieval"
          prompt={step.prompt}
          conceptId={step.conceptId}
          keyPoints={step.keyPoints}
          mode="explain_back"
          onDone={(payload) => advance(payload)}
        />
      )}

      {step.type === "quiz" && (
        <QuizBlock
          key={step.question.id}
          label={
            step.mode === "synthesis"
              ? "Blind-spot synthesis"
              : "Checkpoint quiz"
          }
          question={step.question}
          onDone={(payload) =>
            advance({
              xp: payload.xp,
              streak: payload.streak,
              vitality: payload.vitality,
              reinforced: payload.reinforced,
              linked: payload.linked,
              lastAutopsy: payload.lastAutopsy,
              lastCorrect: payload.correct,
            })
          }
        />
      )}
    </main>
  );
}
