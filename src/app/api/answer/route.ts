import { NextResponse } from "next/server";
import { answerQuiz, hydrateStoreFromButterbase } from "@/lib/store";
import type { QuizQuestion } from "@/lib/types";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await hydrateStoreFromButterbase();
  const body = (await req.json()) as {
    questionId?: string;
    choiceIndex?: number;
    ephemeral?: QuizQuestion;
  };
  if (!body.questionId || typeof body.choiceIndex !== "number") {
    return NextResponse.json(
      { error: "questionId and choiceIndex required" },
      { status: 400 }
    );
  }
  const result = await answerQuiz(
    body.questionId,
    body.choiceIndex,
    body.ephemeral
  );
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result);
}
