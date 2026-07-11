import { NextResponse } from "next/server";
import { grokEnabled } from "@/lib/grok";
import { butterbaseEnabled } from "@/lib/butterbase";
import { hydrateStoreFromButterbase, pushStoreToButterbase } from "@/lib/store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateStoreFromButterbase();
  return NextResponse.json({
    grok: grokEnabled(),
    butterbase: butterbaseEnabled(),
    everos: Boolean(process.env.EVEROS_API_KEY),
    appId: process.env.BUTTERBASE_APP_ID || null,
  });
}

export async function POST() {
  await hydrateStoreFromButterbase();
  const result = await pushStoreToButterbase();
  return NextResponse.json(result);
}
