/**
 * Butterbase REST client.
 * Data API: GET/POST https://api.butterbase.ai/v1/{app_id}/{table}
 * Update: PATCH https://api.butterbase.ai/v1/{app_id}/{table}/{id}
 */
import type {
  AtlasState,
  Concept,
  QuizQuestion,
  Source,
  TeachCard,
} from "./types";
import { BB_EMBEDDED } from "./bb-embedded";

const USER_ID = "lifelong-learner";

/** Platform reserves BUTTERBASE_* on Edge; SYNAPSE_BB_* aliases are settable via update_env. */
function bbApiKey() {
  return (
    process.env.BUTTERBASE_API_KEY ||
    process.env.SYNAPSE_BB_KEY ||
    process.env.SYNAPSE_DATA_API_KEY ||
    BB_EMBEDDED.apiKey ||
    ""
  );
}

function bbAppId() {
  return (
    process.env.BUTTERBASE_APP_ID ||
    process.env.SYNAPSE_BB_APP_ID ||
    process.env.SYNAPSE_APP_ID ||
    BB_EMBEDDED.appId ||
    ""
  );
}

function bbApiUrl() {
  return (
    process.env.BUTTERBASE_API_URL ||
    process.env.SYNAPSE_BB_URL ||
    BB_EMBEDDED.apiUrl ||
    "https://api.butterbase.ai/v1"
  );
}

export function butterbaseEnabled() {
  return Boolean(bbApiKey() && bbAppId());
}

export function butterbaseAppId() {
  return bbAppId() || null;
}

function baseUrl() {
  const root = bbApiUrl().replace(/\/$/, "");
  return `${root}/${bbAppId()}`;
}

function headers() {
  return {
    Authorization: `Bearer ${bbApiKey()}`,
    "Content-Type": "application/json",
  };
}

async function bbFetch(path: string, init?: RequestInit) {
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/** Coerce teach/quiz JSON into a string[] (Grok/DB sometimes store objects). */
export function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item == null) return "";
        if (typeof item === "object" && "text" in (item as object)) {
          return String((item as { text?: unknown }).text ?? "").trim();
        }
        return String(item).trim();
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return normalizeStringList(JSON.parse(trimmed));
    } catch {
      return [trimmed];
    }
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["bullets", "summary", "points", "items", "lines"]) {
      if (key in obj) return normalizeStringList(obj[key]);
    }
  }
  return [];
}

function asRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "rows", "items", "results"]) {
      if (Array.isArray(obj[key])) {
        return obj[key] as Record<string, unknown>[];
      }
    }
  }
  return [];
}

export async function upsertUser(user: AtlasState["user"]) {
  if (!butterbaseEnabled()) return { synced: false as const };
  const patch = await bbFetch(`/users/${encodeURIComponent(user.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      streak: user.streak,
      xp: user.xp,
      vitality: user.vitality,
      updated_at: new Date().toISOString(),
    }),
  });
  if (patch.status === 404) {
    await bbFetch(`/users`, {
      method: "POST",
      body: JSON.stringify({
        id: user.id,
        streak: user.streak,
        xp: user.xp,
        vitality: user.vitality,
      }),
    });
  }
  return { synced: true as const };
}

export async function insertSource(source: Source) {
  if (!butterbaseEnabled()) return;
  const patch = await bbFetch(`/sources/${encodeURIComponent(source.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: source.title,
      source_url: source.sourceUrl,
      ingested_at: source.ingestedAt,
      user_id: USER_ID,
    }),
  });
  if (patch.status === 404) {
    await bbFetch(`/sources`, {
      method: "POST",
      body: JSON.stringify({
        id: source.id,
        title: source.title,
        source_url: source.sourceUrl,
        ingested_at: source.ingestedAt,
        user_id: USER_ID,
      }),
    });
  }
}

export async function upsertConcepts(concepts: Concept[]) {
  if (!butterbaseEnabled()) return;
  for (const c of concepts) {
    const row = {
      id: c.id,
      title: c.title,
      region: c.region,
      x: c.x,
      y: c.y,
      mastery: c.mastery,
      next_review_at: c.nextReviewAt,
      last_reviewed_at: c.lastReviewedAt,
      source_id: c.sourceId,
      status: c.status,
      user_id: USER_ID,
    };
    const patch = await bbFetch(`/concepts/${encodeURIComponent(c.id)}`, {
      method: "PATCH",
      body: JSON.stringify(row),
    });
    if (patch.status === 404) {
      await bbFetch(`/concepts`, { method: "POST", body: JSON.stringify(row) });
    }
  }
}

export async function insertTeachCards(cards: TeachCard[]) {
  if (!butterbaseEnabled()) return;
  for (const card of cards) {
    const row = {
      id: card.id,
      concept_id: card.conceptId,
      title: card.title,
      summary_json: JSON.stringify(card.summary),
      diagram_mermaid: card.diagramMermaid || null,
    };
    const patch = await bbFetch(`/teach_cards/${encodeURIComponent(card.id)}`, {
      method: "PATCH",
      body: JSON.stringify(row),
    });
    if (patch.status === 404) {
      const res = await bbFetch(`/teach_cards`, {
        method: "POST",
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        console.error("teach_cards insert failed", await res.text());
      }
    }
  }
}

export async function insertQuiz(q: QuizQuestion) {
  if (!butterbaseEnabled()) return;
  const row = {
    id: q.id,
    prompt: q.prompt,
    choices_json: JSON.stringify(q.choices),
    correct_index: q.correctIndex,
    concept_ids_json: JSON.stringify(q.conceptIds),
    synthesizes_with: q.synthesizesWith || null,
  };
  const patch = await bbFetch(`/quiz_bank/${encodeURIComponent(q.id)}`, {
    method: "PATCH",
    body: JSON.stringify(row),
  });
  if (patch.status === 404) {
    const res = await bbFetch(`/quiz_bank`, {
      method: "POST",
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      console.error("quiz_bank insert failed", await res.text());
    }
  }
}

export async function logPracticeEvent(topic: string, outcome: string) {
  if (!butterbaseEnabled()) return;
  await bbFetch(`/practice_events`, {
    method: "POST",
    body: JSON.stringify({
      topic,
      outcome,
      user_id: USER_ID,
    }),
  });
}

export async function syncIngestToButterbase(payload: {
  user: AtlasState["user"];
  source: Source;
  concepts: Concept[];
  teachCards: TeachCard[];
  quiz: QuizQuestion;
}) {
  if (!butterbaseEnabled()) return { synced: false as const };
  try {
    await upsertUser(payload.user);
    await insertSource(payload.source);
    await upsertConcepts(payload.concepts);
    await insertTeachCards(payload.teachCards);
    await insertQuiz(payload.quiz);
    return { synced: true as const };
  } catch (e) {
    console.error("Butterbase sync failed", e);
    return { synced: false as const, error: String(e) };
  }
}

/** Push a full atlas snapshot to Butterbase. */
export async function syncFullAtlasToButterbase(state: AtlasState) {
  if (!butterbaseEnabled()) return { synced: false as const };
  try {
    await upsertUser(state.user);
    for (const s of state.sources) await insertSource(s);
    await upsertConcepts(state.concepts);
    await insertTeachCards(state.teachCards);
    for (const q of state.quizBank) await insertQuiz(q);
    return { synced: true as const };
  } catch (e) {
    console.error("Butterbase full sync failed", e);
    return { synced: false as const, error: String(e) };
  }
}

/** Load atlas state from Butterbase tables (edge-safe). */
export async function fetchAtlasFromButterbase(): Promise<AtlasState | null> {
  if (!butterbaseEnabled()) return null;
  try {
    const [usersRes, sourcesRes, conceptsRes, teachRes, quizRes] =
      await Promise.all([
        bbFetch(`/users?limit=50`),
        bbFetch(`/sources?limit=200`),
        bbFetch(`/concepts?limit=500`),
        bbFetch(`/teach_cards?limit=500`),
        bbFetch(`/quiz_bank?limit=200`),
      ]);
    if (!conceptsRes.ok) return null;

    const users = asRows(await usersRes.json()) as unknown as AtlasState["user"][];
    const sourcesRaw = asRows(await sourcesRes.json());
    const conceptsRaw = asRows(await conceptsRes.json());
    const teachRaw = asRows(await teachRes.json());
    const quizRaw = asRows(await quizRes.json());

    if (conceptsRaw.length === 0) return null;

    const user =
      (Array.isArray(users) && users.find((u) => u.id === USER_ID)) ||
      users?.[0] || {
        id: USER_ID,
        streak: 0,
        xp: 0,
        vitality: 50,
      };

    return {
      user,
      sources: (Array.isArray(sourcesRaw) ? sourcesRaw : []).map((s) => ({
        id: String(s.id),
        title: String(s.title),
        sourceUrl: String(s.source_url || s.sourceUrl || ""),
        ingestedAt: String(
          s.ingested_at || s.ingestedAt || new Date().toISOString()
        ),
      })),
      concepts: conceptsRaw.map((c) => ({
        id: String(c.id),
        title: String(c.title),
        region: c.region as Concept["region"],
        x: Number(c.x),
        y: Number(c.y),
        mastery: Number(c.mastery || 0),
        nextReviewAt: String(
          c.next_review_at || c.nextReviewAt || new Date().toISOString()
        ),
        lastReviewedAt: (c.last_reviewed_at || c.lastReviewedAt || null) as
          | string
          | null,
        sourceId: String(c.source_id || c.sourceId || ""),
        status: (c.status || "fresh") as Concept["status"],
      })),
      teachCards: (Array.isArray(teachRaw) ? teachRaw : []).map((t) => ({
        id: String(t.id),
        conceptId: String(t.concept_id || t.conceptId),
        title: String(t.title),
        summary: normalizeStringList(
          parseJsonField(t.summary_json ?? t.summary, t.summary_json ?? t.summary)
        ),
        diagramMermaid: (t.diagram_mermaid || t.diagramMermaid || undefined) as
          | string
          | undefined,
      })),
      quizBank: (Array.isArray(quizRaw) ? quizRaw : []).map((q) => ({
        id: String(q.id),
        prompt: String(q.prompt),
        choices: normalizeStringList(
          parseJsonField(q.choices_json ?? q.choices, q.choices_json ?? q.choices)
        ),
        correctIndex: Number(q.correct_index ?? q.correctIndex ?? 0),
        conceptIds: normalizeStringList(
          parseJsonField(
            q.concept_ids_json ?? q.conceptIds,
            q.concept_ids_json ?? q.conceptIds
          )
        ),
        synthesizesWith: (q.synthesizes_with ||
          q.synthesizesWith ||
          undefined) as string | undefined,
      })),
      blindSpots: [],
    };
  } catch (e) {
    console.error("Butterbase fetch atlas failed", e);
    return null;
  }
}
