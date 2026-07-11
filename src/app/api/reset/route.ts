import { NextResponse } from "next/server";
import {
  hydrateStoreFromButterbase,
  pushStoreToButterbase,
  resetStore,
  getAtlas,
} from "@/lib/store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST() {
  await hydrateStoreFromButterbase();
  const state = resetStore();
  await pushStoreToButterbase();
  return NextResponse.json({ ok: true, atlas: getAtlas(), reset: !!state });
}
