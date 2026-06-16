import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ notificationKey: z.string().min(3).max(300) });

export async function POST(request: NextRequest) {
  const user = await requireUser(request); if (isApiError(user)) return user;
  try {
    const { notificationKey } = schema.parse(await request.json());
    const read = await prisma.$transaction(async (tx) => {
      const item = await tx.userNotificationRead.upsert({ where: { userId_notificationKey: { userId: user.id, notificationKey } }, update: { readAt: new Date() }, create: { userId: user.id, notificationKey } });
      await writeAudit(tx, { userId: user.id, action: "MARK_READ", entity: "Notification", entityId: notificationKey, newValue: { readAt: item.readAt } });
      return item;
    });
    return NextResponse.json({ read });
  } catch (error) { return validationError(error); }
}
