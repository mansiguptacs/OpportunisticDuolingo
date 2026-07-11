import { NextResponse } from "next/server";
import { buildTodayPath, hydrateStoreFromButterbase } from "@/lib/store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateStoreFromButterbase();
  return NextResponse.json(buildTodayPath());
}
