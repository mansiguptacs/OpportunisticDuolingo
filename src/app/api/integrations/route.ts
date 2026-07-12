import { NextResponse } from "next/server";
import { grokEnabled } from "@/lib/grok";
import { butterbaseAppId, butterbaseEnabled } from "@/lib/butterbase";
import {
  getAtlas,
  hydrateStoreFromButterbase,
  pushStoreToButterbase,
} from "@/lib/store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateStoreFromButterbase();
  const atlas = getAtlas();
  return NextResponse.json({
    grok: grokEnabled(),
    butterbase: butterbaseEnabled(),
    everos: Boolean(process.env.EVEROS_API_KEY),
    appId: butterbaseAppId(),
    concepts: atlas.concepts.length,
  });
}

export async function POST() {
  await hydrateStoreFromButterbase();
  const result = await pushStoreToButterbase();
  return NextResponse.json(result);
}
