import type { BrainRegion } from "./types";

const XAI_URL = "https://api.x.ai/v1/chat/completions";

export function grokEnabled() {
  return Boolean(process.env.XAI_API_KEY) && process.env.SYNAPSE_FORCE_FIXTURE !== "1";
}

export interface RefinedIngest {
  concepts: { title: string; region: BrainRegion; x: number; y: number }[];
  teachCards: { title: string; summary: string[]; diagramMermaid?: string }[];
  quiz: {
    prompt: string;
    choices: string[];
    correctIndex: number;
  };
}

const SYSTEM = `You are Synapse-Coach, a lifelong learning alchemist.
Turn raw web/article text into a learnable neural-atlas payload.
Return ONLY valid JSON matching this schema:
{
  "concepts": [{"title": string, "region": "prefrontal"|"temporal"|"parietal"|"hippocampus", "x": number, "y": number}],
  "teachCards": [{"title": string, "summary": string[3], "diagramMermaid": string}],
  "quiz": {"prompt": string, "choices": string[4], "correctIndex": 0|1|2|3}
}
Rules:
- 2-3 concepts max
- region metaphors: prefrontal=systems/architecture, temporal=language/narrative, parietal=structural patterns, hippocampus=fresh encoding
- x,y are 20-80 coordinates on a brain SVG
- teachCards: 2 items, teach before test
- quiz must test concepts just taught
- diagramMermaid: short mermaid flowchart string`;

export async function refineWithGrok(
  rawText: string,
  meta: { title?: string; sourceUrl?: string; blindSpots?: string[] }
): Promise<RefinedIngest> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY missing");

  const blind =
    meta.blindSpots && meta.blindSpots.length
      ? `\nKnown learner blind spots from Raven/EverOS: ${meta.blindSpots.join("; ")}`
      : "";

  const res = await fetch(XAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL || "grok-3",
      temperature: 0.3,
      max_tokens: 1800,
      messages: [
        { role: "system", content: SYSTEM + blind },
        {
          role: "user",
          content: `Title: ${meta.title || "Untitled"}\nURL: ${meta.sourceUrl || ""}\n\nCONTENT:\n${rawText.slice(0, 12000)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Grok returned no JSON");
  return JSON.parse(jsonMatch[0]) as RefinedIngest;
}

export async function scoreWithGrok(input: {
  conceptTitle: string;
  mode: "feynman" | "explain_back";
  keyPoints: string[];
  text: string;
}): Promise<{ score: number; feedback: string }> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY missing");

  const res = await fetch(XAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL || "grok-3",
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            'Score a learner explanation. Return ONLY JSON: {"score":0-100,"feedback":string}. Be witty but fair. Feynman mode rewards plain language; explain_back rewards mechanism precision.',
        },
        {
          role: "user",
          content: `Concept: ${input.conceptTitle}\nMode: ${input.mode}\nKey points:\n- ${input.keyPoints.join("\n- ")}\n\nLearner said:\n${input.text.slice(0, 1200)}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Grok score failed (${res.status})`);
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Grok score returned no JSON");
  const parsed = JSON.parse(jsonMatch[0]) as {
    score?: number;
    feedback?: string;
  };
  return {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 50)),
    feedback: parsed.feedback || "Scored.",
  };
}
