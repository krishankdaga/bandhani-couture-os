import { IncentiveStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireAnyPermission, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

// Incentive amounts are fixed per employee, so management here only moves the
// record through its lifecycle (Pending → Approved → Paid).
const schema = z.object({ status: z.nativeEnum(IncentiveStatus), notes: z.string().optional().nullable() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAnyPermission(request, ["incentives.approve", "incentives.pay"]);
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const input = schema.parse(await request.json());
    const old = await prisma.incentive.findUnique({ where: { id } });
    if (!old) return NextResponse.json({ error: "Incentive not found" }, { status: 404 });
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.incentive.update({ where: { id }, data: { status: input.status, ...(input.notes !== undefined && { notes: input.notes }) } });
      await writeAudit(tx, { userId: user.id, action: old.status !== item.status ? "STATUS_CHANGE" : "UPDATE", entity: "Incentive", entityId: id, oldValue: old, newValue: item });
      return item;
    });
    return NextResponse.json({ incentive: updated });
  } catch (error) {
    return validationError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "incentives.approve");
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const old = await prisma.incentive.findUnique({ where: { id } });
    if (!old) return NextResponse.json({ error: "Incentive not found" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await writeAudit(tx, { userId: user.id, action: "DELETE", entity: "Incentive", entityId: id, oldValue: old });
      await tx.incentive.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return validationError(error);
  }
}
