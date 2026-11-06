import { config, isMock } from "@/lib/config";
import { downloadVolumeFile } from "@/lib/files";
import { getInvoice } from "@/lib/invoices";
import { errorResponse } from "@/lib/http";
import { mockInvoicePdf } from "@/lib/mock-pdf";

// GET /api/invoices/:id/pdf streams the invoice PDF from the volume (Files API). The path comes
// from the invoice row, never from the request, and must sit inside the configured volume.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const inv = await getInvoice(id);
    if (!inv) return Response.json({ error: `Invoice ${id} not found` }, { status: 404 });
    const headers = {
      "Content-Type": /\.jpe?g$/i.test(inv.file_path) ? "image/jpeg" : /\.png$/i.test(inv.file_path) ? "image/png" : "application/pdf",
      "Content-Disposition": `inline; filename="${inv.file_path.split("/").pop()?.replace(/[^\w.-]/g, "_") ?? "invoice.pdf"}"`,
      "Cache-Control": "private, max-age=300",
    };
    if (isMock()) return new Response(Buffer.from(mockInvoicePdf(inv)), { headers });

    const path = inv.file_path.replace(/^dbfs:/, "");
    if (!path.startsWith(config().volumeRoot) || path.includes(".."))
      return Response.json({ error: "File is outside the invoices volume" }, { status: 403 });
    const res = await downloadVolumeFile(path);
    if (!res.ok || !res.body)
      return Response.json({ error: `Could not read ${path} (${res.status})` }, { status: res.status === 404 ? 404 : 502 });
    return new Response(res.body, { headers });
  } catch (e) {
    return errorResponse(e);
  }
}
