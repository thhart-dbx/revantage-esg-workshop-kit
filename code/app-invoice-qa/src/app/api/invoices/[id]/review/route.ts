import { review } from "@/lib/invoices";
import { currentUser, errorResponse } from "@/lib/http";
import type { ReviewRequest } from "@/lib/types";

// POST /api/invoices/:id/review
//   { action: "approve" }                                   → qa_status Approved
//   { action: "save", changes: [{ field, value, error_type, comment }] } → Corrected + corrections rows
//   { action: "reject", error_type?, comment }               → Rejected + one corrections row
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await req.json()) as ReviewRequest;
    return Response.json(await review(id, body, currentUser(req)));
  } catch (e) {
    return errorResponse(e);
  }
}
