import { NextResponse, connection } from "next/server";
import { getCampaign } from "@/lib/survey-data";
import { priorResponse } from "@/lib/lakebase";
import { isMockMode } from "@/lib/config";

// GET /api/health → can the app read Delta (warehouse) and Lakebase? No data is returned.
export async function GET() {
  await connection(); // run per request, never at build time
  const check = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return "ok";
    } catch (e) {
      console.error("[health]", e);
      return "error";
    }
  };
  const [warehouse, lakebase] = await Promise.all([
    check(() => getCampaign()),
    check(() => priorResponse("2000-Q1", -1)),
  ]);
  const ok = warehouse === "ok" && lakebase === "ok";
  return NextResponse.json({ ok, warehouse, lakebase, mock: isMockMode() }, { status: ok ? 200 : 503 });
}
