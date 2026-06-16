import { Prisma, PrismaClient } from "@prisma/client";
import { safeJsonParse } from "@/lib/json";

type DbClient = PrismaClient | Prisma.TransactionClient;

function snapshot(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  const serialized = JSON.stringify(value);
  return safeJsonParse<Prisma.InputJsonValue | undefined>(serialized, undefined);
}

export async function writeAudit(db: DbClient, input: {
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}) {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      oldValue: snapshot(input.oldValue),
      newValue: snapshot(input.newValue),
      metadata: snapshot(input.metadata),
    },
  });
}
