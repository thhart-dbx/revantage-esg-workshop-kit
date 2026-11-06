import "server-only";
import { DBSQLClient } from "@databricks/sql";
import type IDBSQLClient from "@databricks/sql/dist/contracts/IDBSQLClient";

// Server-side SQL warehouse access. Import only from Route Handlers, Server Components, and
// Server Actions — never from client components.
//
// Auth, in order:
//   1. userToken (x-forwarded-access-token) — on-behalf-of-user; UC permissions apply per user
//   2. DATABRICKS_CLIENT_ID/SECRET — the app's service principal (injected by Databricks Apps)
//   3. DATABRICKS_TOKEN — local dev only (from `databricks auth token -p <profile>` in .env.local)

const host = (process.env.DATABRICKS_HOST ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const path = `/sql/1.0/warehouses/${process.env.DATABRICKS_WAREHOUSE_ID}`;

let appClient: Promise<IDBSQLClient> | undefined;

function connect(userToken?: string): Promise<IDBSQLClient> {
  const client = new DBSQLClient();
  if (userToken) return client.connect({ host, path, token: userToken });
  if (process.env.DATABRICKS_CLIENT_ID && process.env.DATABRICKS_CLIENT_SECRET) {
    return client.connect({
      host,
      path,
      authType: "databricks-oauth",
      oauthClientId: process.env.DATABRICKS_CLIENT_ID,
      oauthClientSecret: process.env.DATABRICKS_CLIENT_SECRET,
    });
  }
  return client.connect({ host, path, token: process.env.DATABRICKS_TOKEN ?? "" });
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  namedParameters?: Record<string, string | number | boolean | Date | null>,
  userToken?: string,
): Promise<T[]> {
  const client = userToken ? await connect(userToken) : await (appClient ??= connect());
  const session = await client.openSession();
  try {
    const op = await session.executeStatement(sql, { namedParameters });
    const rows = await op.fetchAll();
    await op.close();
    return rows as T[];
  } finally {
    await session.close();
    if (userToken) await client.close();
  }
}
