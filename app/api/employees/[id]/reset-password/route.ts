import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({ password: z.string().min(8).max(100) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request);
  if (isApiError(owner)) return owner;
  try {
    const { id } = await params;
    const { password } = schema.parse(await request.json());
    const employee = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
      await writeAudit(tx, { userId: owner.id, action: "PASSWORD_RESET", entity: "Employee", entityId: id, metadata: { email: employee.email } });
    });
    return NextResponse.json({ success: true });
  } catch (error) { return validationError(error); }
}
