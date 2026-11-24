import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

/** Liveness + database readiness for load balancers / uptime checks. */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
