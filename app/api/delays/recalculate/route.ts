import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { syncDelayStates } from "@/lib/delay-sync";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "production.edit");
  if (isApiError(user)) return user;
  const changed = await syncDelayStates({ force: true });
  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, { userId: user.id, action: "RECALCULATE", entity: "DelayState", entityId: "batch", newValue: { changed } });
  });
  return NextResponse.json({ changed });
}
