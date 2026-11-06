import { connection } from "next/server";
import { isMock } from "@/lib/config";
import { listProperties, listSuppliers } from "@/lib/invoices";
import { currentUser, errorResponse } from "@/lib/http";

// GET /api/meta: filter options + who is signed in.
export async function GET(req: Request) {
  await connection(); // always per request (live data, signed-in user)
  try {
    const [properties, suppliers] = await Promise.all([listProperties(), listSuppliers()]);
    return Response.json({ properties, suppliers, user: currentUser(req), mode: isMock() ? "mock" : "sql" });
  } catch (e) {
    return errorResponse(e);
  }
}
