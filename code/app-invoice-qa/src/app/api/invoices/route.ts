import { connection } from "next/server";
import { listInvoices } from "@/lib/invoices";
import { errorResponse } from "@/lib/http";

// GET /api/invoices?status=&from=&to=&supplier=&utility=&property=&flagged=1
export async function GET(req: Request) {
  await connection(); // always per request (live data, signed-in user)
  const p = new URL(req.url).searchParams;
  try {
    const invoices = await listInvoices({
      status: p.get("status") ?? undefined,
      from: p.get("from") ?? undefined,
      to: p.get("to") ?? undefined,
      supplier: p.get("supplier") ?? undefined,
      utility: p.get("utility") ?? undefined,
      property: p.get("property") ?? undefined,
      flagged: p.get("flagged") === "1",
    });
    return Response.json({ invoices });
  } catch (e) {
    return errorResponse(e);
  }
}
