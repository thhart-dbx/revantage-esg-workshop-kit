import "server-only";
import { HttpError } from "./invoices";

/** The signed-in user. Databricks Apps' proxy sets x-forwarded-email from the user's login. */
export function currentUser(req: Request): string {
  return req.headers.get("x-forwarded-email") ?? process.env.LOCAL_USER_EMAIL ?? "local.dev@revantage.example";
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  const msg = e instanceof Error ? e.message : String(e);
  return Response.json({ error: `Server error: ${msg}` }, { status: 500 });
}
