import { NextResponse } from "next/server";
import { hydrateStoreFromButterbase, scoreExplanation } from "@/lib/store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await hydrateStoreFromButterbase();
  const body = (await req.json()) as {
    conceptId?: string;
    text?: string;
    mode?: "feynman" | "explain_back";
    keyPoints?: string[];
  };
  if (
    !body.conceptId ||
    typeof body.text !== "string" ||
    !body.mode ||
    !Array.isArray(body.keyPoints)
  ) {
    return NextResponse.json(
      { error: "conceptId, text, mode, keyPoints required" },
      { status: 400 }
    );
  }
  const result = await scoreExplanation({
    conceptId: body.conceptId,
    text: body.text,
    mode: body.mode,
    keyPoints: body.keyPoints,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result);
}
