import { NextResponse } from "next/server";
import {
  hydrateStoreFromButterbase,
  ingestContent,
  resetStore,
} from "@/lib/store";
import type { IngestRequest } from "@/lib/types";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await hydrateStoreFromButterbase();
  const body = (await req.json()) as IngestRequest & { reset?: boolean };
  if (body.reset) {
    resetStore();
  }
  if (!body.rawText || body.rawText.trim().length < 20) {
    return NextResponse.json(
      { error: "rawText is required (min 20 chars)" },
      { status: 400 }
    );
  }
  const result = await ingestContent({
    title: body.title,
    sourceUrl: body.sourceUrl,
    rawText: body.rawText,
  });
  return NextResponse.json(result);
}
