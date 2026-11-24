import "server-only";
import type { DbOrTx } from "../db/client";
import { auditLogs } from "../db/schema";

export interface AuditActor {
  id: string;
  ip?: string;
  userAgent?: string;
}

/** Append-only record of a sensitive (administrative) action. Call inside the mutating transaction. */
export async function audit(
  d: DbOrTx,
  actor: AuditActor,
  action: string,
  entity: { type: string; id?: string | null },
  change?: { before?: unknown; after?: unknown },
) {
  await d.insert(auditLogs).values({
    actorId: actor.id,
    action,
    entityType: entity.type,
    entityId: entity.id ?? null,
    before: (change?.before ?? null) as never,
    after: (change?.after ?? null) as never,
    ip: actor.ip?.slice(0, 64),
    userAgent: actor.userAgent?.slice(0, 300),
  });
}
