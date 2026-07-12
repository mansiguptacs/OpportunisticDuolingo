import type {
  AtlasState,
  BrainRegion,
  Concept,
  ConceptStatus,
  IngestRequest,
  IngestResult,
  QuizQuestion,
  TeachCard,
  TodayPath,
} from "./types";
import { writePracticeMemory, searchBlindSpots } from "./everos";
import { grokEnabled, refineWithGrok } from "./grok";
import {
  normalizeStringList,
  syncIngestToButterbase,
  upsertUser,
  upsertConcepts,
  logPracticeEvent,
  syncFullAtlasToButterbase,
  fetchAtlasFromButterbase,
} from "./butterbase";
import atlasFixture from "../../demo/fixtures/atlas.json";
import ingestFixture from "../../demo/fixtures/ingest-demo.json";

function computeStatus(nextReviewAt: string, mastery: number): ConceptStatus {
  const now = Date.now();
  const due = new Date(nextReviewAt).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (mastery >= 70 && due > now + day) return "strong";
  if (due < now - day) return "overdue";
  if (due <= now + day) return "due";
  if (mastery < 40) return "fresh";
  return "strong";
}

function refreshStatuses(state: AtlasState): AtlasState {
  return {
    ...state,
    concepts: state.concepts.map((c) => ({
      ...c,
      status: computeStatus(c.nextReviewAt, c.mastery),
    })),
    user: {
      ...state.user,
      vitality: computeVitality(state.concepts),
    },
  };
}

function computeVitality(concepts: Concept[]): number {
  if (concepts.length === 0) return 0;
  const ok = concepts.filter(
    (c) => c.status === "strong" || c.status === "fresh"
  ).length;
  return Math.round((ok / concepts.length) * 100);
}

declare global {
  // eslint-disable-next-line no-var
  var __synapseStore: AtlasState | undefined;
  // eslint-disable-next-line no-var
  var __synapseHydrateInflight: Promise<void> | undefined;
}

function fixtureState(): AtlasState {
  return refreshStatuses(
    JSON.parse(JSON.stringify(atlasFixture)) as AtlasState
  );
}

export function getStore(): AtlasState {
  if (!globalThis.__synapseStore) {
    globalThis.__synapseStore = fixtureState();
  }
  return globalThis.__synapseStore;
}

export function setStore(state: AtlasState) {
  const next = refreshStatuses(state);
  globalThis.__synapseStore = next;
  // Fire-and-forget cloud sync (edge-safe)
  void syncFullAtlasToButterbase(next);
  return next;
}

export function resetStore() {
  return setStore(fixtureState());
}

/** Hydrate memory from Butterbase (re-fetches each call; concurrent requests share one inflight). */
export async function hydrateStoreFromButterbase() {
  if (!globalThis.__synapseHydrateInflight) {
    globalThis.__synapseHydrateInflight = (async () => {
      try {
        const remote = await fetchAtlasFromButterbase();
        if (remote && remote.concepts.length > 0) {
          globalThis.__synapseStore = refreshStatuses(remote);
        } else if (!globalThis.__synapseStore) {
          globalThis.__synapseStore = fixtureState();
        }
      } finally {
        globalThis.__synapseHydrateInflight = undefined;
      }
    })();
  }
  await globalThis.__synapseHydrateInflight;
  return getStore();
}

export async function pushStoreToButterbase() {
  return syncFullAtlasToButterbase(getStore());
}

export function getAtlas() {
  const state = getStore();
  const dueCount = state.concepts.filter(
    (c) => c.status === "due" || c.status === "overdue"
  ).length;
  return {
    ...state,
    dueCount,
    recentlyMapped: [...state.sources]
      .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt))
      .slice(0, 3),
  };
}

function slugId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export async function ingestContent(input: IngestRequest): Promise<IngestResult> {
  const state = getStore();
  let usedFixture = false;
  let refined: {
    concepts: { title: string; region: BrainRegion; x: number; y: number }[];
    teachCards: { title: string; summary: string[]; diagramMermaid?: string }[];
    quiz: {
      prompt: string;
      choices: string[];
      correctIndex: number;
    };
  };

  const blindSpots = [
    ...state.blindSpots,
    ...(await searchBlindSpots("weak topics race conditions locking failed quiz")),
  ].slice(0, 5);

  if (grokEnabled()) {
    try {
      refined = await refineWithGrok(input.rawText, {
        title: input.title,
        sourceUrl: input.sourceUrl,
        blindSpots,
      });
    } catch (e) {
      console.error("Grok ingest failed, using fixture", e);
      usedFixture = true;
      refined = (ingestFixture as { refined: typeof refined }).refined;
    }
  } else {
    usedFixture = true;
    refined = (ingestFixture as { refined: typeof refined }).refined;
  }

  const sourceId = slugId("src");
  const source = {
    id: sourceId,
    title: input.title || "Ingested page",
    sourceUrl: input.sourceUrl || "about:blank",
    ingestedAt: new Date().toISOString(),
  };

  const concepts: Concept[] = refined.concepts.map((c, i) => {
    const id = slugId(`c${i}`);
    const nextReviewAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();
    return {
      id,
      title: c.title,
      region: c.region,
      x: Number(c.x) || 40 + i * 8,
      y: Number(c.y) || 45 + i * 5,
      mastery: 35,
      nextReviewAt,
      lastReviewedAt: null,
      sourceId,
      status: "fresh" as const,
    };
  });

  const teachCards: TeachCard[] = refined.teachCards.map((card, i) => ({
    id: slugId(`tc${i}`),
    conceptId: concepts[Math.min(i, concepts.length - 1)]?.id || concepts[0].id,
    title: card.title,
    summary: normalizeStringList(card.summary),
    diagramMermaid: card.diagramMermaid,
  }));

  const quiz: QuizQuestion = {
    id: slugId("q"),
    prompt: refined.quiz.prompt,
    choices: refined.quiz.choices,
    correctIndex: refined.quiz.correctIndex,
    conceptIds: concepts.slice(0, 2).map((c) => c.id),
    synthesizesWith: blindSpots[0]?.slice(0, 80),
  };

  const next: AtlasState = {
    ...state,
    blindSpots: blindSpots.length ? blindSpots.slice(0, 3) : state.blindSpots,
    sources: [source, ...state.sources],
    concepts: [...concepts, ...state.concepts],
    teachCards: [...teachCards, ...state.teachCards],
    quizBank: [quiz, ...state.quizBank],
  };
  setStore(next);

  void writePracticeMemory({
    topic: concepts.map((c) => c.title).join(", "),
    outcome: "ingested",
    sessionId: "synapse-ingest",
  });
  const bb = await syncIngestToButterbase({
    user: next.user,
    source,
    concepts,
    teachCards,
    quiz,
  });

  return {
    source,
    concepts,
    teachCards,
    quizBank: [quiz],
    usedFixture,
    butterbaseSynced: bb.synced,
    blindSpotsUsed: blindSpots.slice(0, 2),
  };
}

function hoursUntilCritical(concept: Concept): number {
  const ms = new Date(concept.nextReviewAt).getTime() - Date.now();
  if (concept.status === "overdue" || ms <= 0) return 0;
  return Math.max(1, Math.round(ms / (60 * 60 * 1000)));
}

function teachForConcept(state: AtlasState, concept: Concept): TeachCard {
  const found = state.teachCards.find((t) => t.conceptId === concept.id);
  if (found) {
    return {
      ...found,
      summary: normalizeStringList(found.summary),
    };
  }
  const fallback = state.teachCards[0];
  if (fallback) {
    return {
      ...fallback,
      conceptId: concept.id,
      title: fallback.title || concept.title,
      summary: normalizeStringList(fallback.summary),
    };
  }
  return {
    id: `teach-fallback-${concept.id}`,
    conceptId: concept.id,
    title: concept.title,
    summary: [
      `${concept.title} is a core idea in your atlas.`,
      "Revisit the source, then retrieve it from memory.",
      "Link it to a neighbor concept to lock it in.",
    ],
  };
}

function makeSpeedProbe(concept: Concept, teach: TeachCard): QuizQuestion {
  const anchor = (teach.summary[0] || concept.title).slice(0, 110);
  return {
    id: `probe-${concept.id}`,
    prompt: `Speed round — which line best captures ${concept.title}?`,
    choices: [
      anchor,
      "It only matters in textbooks, never in production.",
      "It removes the need for monitoring or tests.",
      "It is unrelated to systems, data, or reliability.",
    ],
    correctIndex: 0,
    conceptIds: [concept.id],
  };
}

function linkedForConcepts(state: AtlasState, conceptIds: string[]) {
  const sources = new Set(
    conceptIds
      .map((id) => state.concepts.find((c) => c.id === id)?.sourceId)
      .filter(Boolean) as string[]
  );
  return state.concepts
    .filter(
      (c) => sources.has(c.sourceId) && !conceptIds.includes(c.id)
    )
    .slice(0, 6)
    .map((c) => ({ id: c.id, title: c.title }));
}

function buildAutopsy(
  question: QuizQuestion,
  choiceIndex: number,
  correct: boolean
) {
  const correctChoice = question.choices[question.correctIndex] || "";
  const chosenChoice = question.choices[choiceIndex] || "";
  const distractorNotes = question.choices
    .map((c, i) => ({ c, i }))
    .filter((x) => x.i !== question.correctIndex)
    .map(
      (x) =>
        `"${x.c.slice(0, 72)}${x.c.length > 72 ? "…" : ""}" sounds plausible but misses the core mechanism.`
    );
  return {
    correctChoice,
    chosenChoice,
    whyCorrect: correct
      ? `Yes — "${correctChoice.slice(0, 90)}" is the precise claim this concept hangs on.`
      : `The solid answer is "${correctChoice.slice(0, 90)}". It names the real mechanism, not a neighboring idea.`,
    whyTempting: correct
      ? "The distractors borrow nearby vocabulary so your brain almost accepts them."
      : `You picked "${chosenChoice.slice(0, 90)}" — a tempting near-miss that swaps precision for familiarity.`,
    distractorNotes,
  };
}

export function buildTodayPath(): TodayPath {
  const state = getStore();
  let due = state.concepts
    .filter((c) => c.status === "due" || c.status === "overdue")
    .sort(
      (a, b) =>
        new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()
    )
    .slice(0, 2);

  if (due.length === 0) {
    due = [...state.concepts]
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 2);
  }

  const steps: TodayPath["steps"] = [];

  for (const concept of due) {
    const teach = teachForConcept(state, concept);
    const source = state.sources.find((s) => s.id === concept.sourceId);
    const hours = hoursUntilCritical(concept);

    steps.push({
      type: "source_rewind",
      conceptId: concept.id,
      conceptTitle: concept.title,
      sourceTitle: source?.title || "Your notes",
      sourceUrl: source?.sourceUrl || "",
      quote: teach.summary[0] || `Remember: ${concept.title}`,
      hoursUntilCritical: hours,
      status: concept.status,
      mastery: concept.mastery,
    });

    steps.push({
      type: "teach",
      card: teach,
      conceptTitle: concept.title,
      hoursUntilCritical: hours,
      status: concept.status,
    });

    steps.push({
      type: "probe",
      mode: "speed",
      seconds: 30,
      question: makeSpeedProbe(concept, teach),
    });

    steps.push({
      type: "feynman",
      conceptId: concept.id,
      conceptTitle: concept.title,
      keyPoints: teach.summary,
      prompt: `Explain "${concept.title}" like I'm 12 — one or two plain sentences.`,
    });
  }

  const taughtIds = due.map((c) => c.id);
  const quiz =
    state.quizBank.find((q) => q.synthesizesWith) ||
    state.quizBank.find((q) =>
      q.conceptIds.some((id) => taughtIds.includes(id))
    ) ||
    state.quizBank[0];

  if (quiz) {
    steps.push({
      type: "quiz",
      mode: quiz.synthesizesWith ? "synthesis" : "standard",
      question: quiz,
    });
  }

  const deep = due[0];
  if (deep) {
    const teach = teachForConcept(state, deep);
    steps.push({
      type: "explain_back",
      conceptId: deep.id,
      conceptTitle: deep.title,
      keyPoints: teach.summary,
      prompt: `Deep round — in your own words, how does ${deep.title} actually work?`,
    });
  }

  return {
    id: `today-${new Date().toISOString().slice(0, 10)}`,
    title: "Today's Neural Path",
    steps,
    dueTitles: due.map((c) => c.title),
    linkedPreview: linkedForConcepts(state, taughtIds),
  };
}

export async function answerQuiz(
  questionId: string,
  choiceIndex: number,
  ephemeral?: QuizQuestion
) {
  const state = getStore();
  const q =
    state.quizBank.find((item) => item.id === questionId) ||
    (ephemeral && ephemeral.id === questionId ? ephemeral : undefined);

  if (!q) {
    return { ok: false as const, error: "Question not found" };
  }

  const correct = choiceIndex === q.correctIndex;
  const now = new Date();
  const concepts = state.concepts.map((c) => {
    if (!q.conceptIds.includes(c.id)) return c;
    const mastery = Math.max(
      0,
      Math.min(100, c.mastery + (correct ? 15 : -10))
    );
    const days = correct ? (mastery > 60 ? 7 : 3) : 1;
    const nextReviewAt = new Date(
      now.getTime() + days * 24 * 60 * 60 * 1000
    ).toISOString();
    return {
      ...c,
      mastery,
      lastReviewedAt: now.toISOString(),
      nextReviewAt,
    };
  });

  const xpGained = correct ? 50 : 10;
  const user = {
    ...state.user,
    xp: state.user.xp + xpGained,
    streak: correct
      ? state.user.streak + 1
      : Math.max(0, state.user.streak - 1),
  };

  setStore({ ...state, concepts, user });

  const topic = q.conceptIds
    .map((id) => state.concepts.find((c) => c.id === id)?.title)
    .filter(Boolean)
    .join(" + ");
  const outcome = correct ? "passed_challenge" : "failed_challenge";
  void writePracticeMemory({
    topic: topic || questionId,
    outcome,
  });
  void logPracticeEvent(topic || questionId, outcome);
  void upsertUser(user);
  void upsertConcepts(
    concepts.filter((c) => q.conceptIds.includes(c.id))
  );

  const fresh = getStore();
  const reinforced = fresh.concepts
    .filter((c) => q.conceptIds.includes(c.id))
    .map((c) => ({ id: c.id, title: c.title, mastery: c.mastery }));

  return {
    ok: true as const,
    correct,
    xpGained,
    streak: fresh.user.streak,
    vitality: fresh.user.vitality,
    autopsy: buildAutopsy(q, choiceIndex, correct),
    reinforced,
    linked: linkedForConcepts(fresh, q.conceptIds),
  };
}

export async function scoreExplanation(input: {
  conceptId: string;
  text: string;
  mode: "feynman" | "explain_back";
  keyPoints: string[];
}) {
  const state = getStore();
  const concept = state.concepts.find((c) => c.id === input.conceptId);
  if (!concept) {
    return { ok: false as const, error: "Concept not found" };
  }

  const text = input.text.trim();
  if (text.length < 12) {
    return {
      ok: true as const,
      score: 15,
      feedback: "Too thin — give the idea one concrete sentence.",
      xpGained: 5,
      streak: state.user.streak,
      vitality: state.user.vitality,
      reinforced: [] as { id: string; title: string; mastery: number }[],
      linked: linkedForConcepts(state, [concept.id]),
    };
  }

  let score = 35;
  const lower = text.toLowerCase();
  const hits = input.keyPoints.filter((p) => {
    const words = p
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4)
      .slice(0, 6);
    return words.some((w) => lower.includes(w));
  }).length;
  score += Math.min(45, hits * 15);
  if (input.mode === "feynman" && text.split(/\s+/).length < 40) score += 8;
  if (input.mode === "explain_back" && text.split(/\s+/).length > 25) score += 8;
  score = Math.max(10, Math.min(100, score));

  // Optional Grok polish
  let feedback =
    score >= 70
      ? "Clear enough to teach — synapses locked."
      : score >= 45
        ? "Halfway there — name the mechanism more precisely."
        : "Fuzzy — steal one concrete phrase from the teach card and try again.";

  try {
    const { scoreWithGrok } = await import("./grok");
    if (grokEnabled()) {
      const groked = await scoreWithGrok({
        conceptTitle: concept.title,
        mode: input.mode,
        keyPoints: input.keyPoints,
        text,
      });
      score = groked.score;
      feedback = groked.feedback;
    }
  } catch {
    // keep heuristic
  }

  const correctEnough = score >= 50;
  const now = new Date();
  const concepts = state.concepts.map((c) => {
    if (c.id !== concept.id) return c;
    const mastery = Math.max(
      0,
      Math.min(100, c.mastery + (correctEnough ? 10 : 2))
    );
    const days = correctEnough ? (mastery > 60 ? 5 : 2) : 1;
    return {
      ...c,
      mastery,
      lastReviewedAt: now.toISOString(),
      nextReviewAt: new Date(
        now.getTime() + days * 24 * 60 * 60 * 1000
      ).toISOString(),
    };
  });
  const xpGained = correctEnough ? 35 : 12;
  const user = {
    ...state.user,
    xp: state.user.xp + xpGained,
    streak: correctEnough
      ? state.user.streak + 1
      : state.user.streak,
  };
  setStore({ ...state, concepts, user });
  const fresh = getStore();

  return {
    ok: true as const,
    score,
    feedback,
    xpGained,
    streak: fresh.user.streak,
    vitality: fresh.user.vitality,
    reinforced: fresh.concepts
      .filter((c) => c.id === concept.id)
      .map((c) => ({ id: c.id, title: c.title, mastery: c.mastery })),
    linked: linkedForConcepts(fresh, [concept.id]),
  };
}

const NUDGE_TEMPLATES = [
  (d: {
    dueCount: number;
    weakest: string;
    streak: number;
    vitality: number;
  }) => ({
    title: "Cortex maintenance window",
    message: `Hey — ${d.weakest} is fading. Tap in and review before your atlas forgets you (${d.dueCount} due).`,
  }),
  (d: {
    dueCount: number;
    weakest: string;
    streak: number;
    vitality: number;
  }) => ({
    title: "Cortex maintenance window",
    message: `Your ${d.streak}d streak called. It wants you to review ${d.weakest}. Don't leave it on read.`,
  }),
  (d: {
    dueCount: number;
    weakest: string;
    streak: number;
    vitality: number;
  }) => ({
    title: "Cortex maintenance window",
    message: `Witty but serious: ${d.weakest} needs a revisit. ${d.dueCount} neurons are waiting — start today's path.`,
  }),
  (d: {
    dueCount: number;
    weakest: string;
    streak: number;
    vitality: number;
  }) => ({
    title: "Cortex maintenance window",
    message: `Vitality ${d.vitality}% and gossiping. Review ${d.weakest} now, or watch it slip to overdue.`,
  }),
  (d: {
    dueCount: number;
    weakest: string;
    streak: number;
    vitality: number;
  }) => ({
    title: "Cortex maintenance window",
    message: `Incoming call from your second brain: “Please review ${d.weakest}.” ${d.dueCount} concepts on the line.`,
  }),
];

export function buildNudge() {
  const state = getStore();
  const due = state.concepts.filter(
    (c) => c.status === "due" || c.status === "overdue"
  );
  const weakest =
    [...due].sort((a, b) => a.mastery - b.mastery)[0] ||
    [...state.concepts].sort((a, b) => a.mastery - b.mastery)[0] ||
    null;
  const dueCount = due.length;
  const payload = {
    dueCount,
    weakest: weakest?.title || "a fading concept",
    streak: state.user.streak,
    vitality: state.user.vitality,
  };
  const tpl =
    NUDGE_TEMPLATES[Math.floor(Math.random() * NUDGE_TEMPLATES.length)](
      payload
    );
  return {
    dueCount,
    weakestTitle: weakest?.title || null,
    streak: state.user.streak,
    vitality: state.user.vitality,
    title: tpl.title,
    message: tpl.message,
    todayUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://synapse.butterbase.dev"}/today`,
  };
}
