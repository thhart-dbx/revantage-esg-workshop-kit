import "server-only";
import { NextResponse } from "next/server";

/** Logs the real error server-side and returns a friendly message (no internals reach the browser). */
export function serverError(where: string, e: unknown) {
  console.error(`[${where}]`, e);
  return NextResponse.json(
    { error: "We couldn't reach the survey service just now. Please try again in a moment." },
    { status: 503 },
  );
}
