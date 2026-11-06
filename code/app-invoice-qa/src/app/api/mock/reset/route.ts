import { isMock } from "@/lib/config";
import { resetMockStore } from "@/lib/mock-data";

// Mock mode only (local UI work and tests): restore the in-memory seed.
export async function POST() {
  if (!isMock()) return Response.json({ error: "Not available" }, { status: 404 });
  resetMockStore();
  return Response.json({ ok: true });
}
