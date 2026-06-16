import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(100),
});

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (isApiError(user)) return user;
  try {
    const { currentPassword, newPassword } = schema.parse(await request.json());
    const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!record || !(await bcrypt.compare(currentPassword, record.passwordHash))) {
      return NextResponse.json({ error: "Your current password is incorrect" }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
      await writeAudit(tx, { userId: user.id, action: "PASSWORD_CHANGE", entity: "User", entityId: user.id });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return validationError(error);
  }
}
