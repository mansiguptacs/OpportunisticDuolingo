import { NextResponse } from "next/server";
import { buildNudge, hydrateStoreFromButterbase } from "@/lib/store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateStoreFromButterbase();
  return NextResponse.json(buildNudge());
}
