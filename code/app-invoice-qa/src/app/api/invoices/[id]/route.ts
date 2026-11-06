import { getInvoice, listCorrections } from "@/lib/invoices";
import { errorResponse } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [invoice, corrections] = await Promise.all([getInvoice(id), listCorrections(id)]);
    if (!invoice) return Response.json({ error: `Invoice ${id} not found` }, { status: 404 });
    return Response.json({ invoice, corrections });
  } catch (e) {
    return errorResponse(e);
  }
}
