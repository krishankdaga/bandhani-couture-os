import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ notificationKeys: z.array(z.string().min(3).max(300)).max(100) });

export async function POST(request: NextRequest) {
  const user = await requireUser(request); if (isApiError(user)) return user;
  try {
    const { notificationKeys } = schema.parse(await request.json());
    await prisma.$transaction(async (tx) => {
      for (const notificationKey of notificationKeys) {
        await tx.userNotificationRead.upsert({ where: { userId_notificationKey: { userId: user.id, notificationKey } }, update: { readAt: new Date() }, create: { userId: user.id, notificationKey } });
      }
      await writeAudit(tx, { userId: user.id, action: "MARK_ALL_READ", entity: "Notification", entityId: user.id, metadata: { notificationKeys, count: notificationKeys.length } });
    });
    return NextResponse.json({ success: true, count: notificationKeys.length });
  } catch (error) { return validationError(error); }
}
