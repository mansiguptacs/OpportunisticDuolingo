/**
 * EverOS cloud memory — Synapse-Coach practice + blind-spot recall.
 * Docs: https://docs.evermind.ai/llms-full.txt
 */
const BASE = process.env.EVEROS_BASE_URL || "https://api.evermind.ai";
const USER_ID = process.env.EVEROS_USER_ID || "lifelong-learner";

export function everosEnabled() {
  return Boolean(process.env.EVEROS_API_KEY);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.EVEROS_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function writePracticeMemory(event: {
  topic: string;
  outcome: "passed_challenge" | "failed_challenge" | "revised_card" | "ingested";
  sessionId?: string;
}) {
  if (!everosEnabled()) {
    return { ok: false as const, reason: "missing_key" };
  }

  const now = Date.now();
  const res = await fetch(`${BASE}/api/v1/memories`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      user_id: USER_ID,
      session_id: event.sessionId || "synapse-practice",
      async_mode: true,
      messages: [
        {
          role: "user",
          timestamp: now,
          content: `Synapse-Coach event: ${event.outcome} on topic "${event.topic}" at ${new Date(now).toISOString()}.`,
        },
        {
          role: "assistant",
          timestamp: now + 1,
          content:
            event.outcome === "failed_challenge"
              ? `Noted weakness on ${event.topic}. Prefer teach-then-test and synthesize with new material.`
              : `Reinforced ${event.topic}. Schedule spaced revisit.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false as const, status: res.status, error: text.slice(0, 200) };
  }

  // Best-effort flush so search is fresher in demos
  void fetch(`${BASE}/api/v1/memories/flush`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      user_id: USER_ID,
      session_id: event.sessionId || "synapse-practice",
    }),
  }).catch(() => undefined);

  return { ok: true as const, status: res.status };
}

export async function searchBlindSpots(query: string): Promise<string[]> {
  if (!everosEnabled()) return [];

  const res = await fetch(`${BASE}/api/v1/memories/search`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      query,
      filters: { user_id: USER_ID },
      method: "hybrid",
      top_k: 5,
      memory_types: ["episodic_memory", "profile", "raw_message"],
    }),
  });

  if (!res.ok) return [];
  const payload = await res.json();
  const data = payload?.data || payload;
  const out: string[] = [];

  for (const ep of data.episodes || []) {
    if (ep.summary) out.push(ep.summary);
    else if (ep.subject) out.push(ep.subject);
    else if (ep.episode) out.push(String(ep.episode).slice(0, 240));
  }
  for (const msg of data.raw_messages || []) {
    if (msg.content) out.push(String(msg.content).slice(0, 240));
  }

  return out.slice(0, 5);
}

export async function seedCoachProfile() {
  return writePracticeMemory({
    topic: "SQL race conditions / optimistic locking",
    outcome: "failed_challenge",
    sessionId: "synapse-seed",
  });
}
