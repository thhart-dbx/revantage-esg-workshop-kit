import "server-only";
import { databricksHost } from "./config";

// Reads files from a Unity Catalog volume with the Files API (GET /api/2.0/fs/files/<path>).
// Auth: the app's service principal (OAuth M2M with DATABRICKS_CLIENT_ID/SECRET, injected by
// Databricks Apps), or DATABRICKS_TOKEN in local dev. The SP needs READ VOLUME on the volume.

let cached: { token: string; expires: number } | undefined;

async function token(): Promise<string> {
  const id = process.env.DATABRICKS_CLIENT_ID;
  const secret = process.env.DATABRICKS_CLIENT_SECRET;
  if (!id || !secret) return process.env.DATABRICKS_TOKEN ?? "";
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${databricksHost()}/oidc/v1/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "all-apis" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OAuth token request failed: ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

export async function downloadVolumeFile(path: string): Promise<Response> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return fetch(`${databricksHost()}/api/2.0/fs/files${encoded}`, {
    headers: { Authorization: `Bearer ${await token()}` },
    cache: "no-store",
  });
}
