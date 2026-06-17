import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

// Owner sets (or clears) the fixed incentive an employee earns per on-time
// delivered order. Null disables incentives for that employee.
const schema = z.object({ incentiveAmount: z.coerce.number().min(0).max(99_999_999).nullable() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request);
  if (isApiError(owner)) return owner;
  try {
    const { id } = await params;
    const { incentiveAmount } = schema.parse(await request.json());
    const employee = await prisma.user.findUnique({ where: { id }, select: { id: true, incentiveAmount: true } });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    // Treat 0 as "no incentive" to keep the eligibility rule simple.
    const value = incentiveAmount && incentiveAmount > 0 ? incentiveAmount : null;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { incentiveAmount: value } });
      await writeAudit(tx, { userId: owner.id, action: "UPDATE", entity: "Employee", entityId: id, oldValue: { incentiveAmount: employee.incentiveAmount }, newValue: { incentiveAmount: value } });
    });
    return NextResponse.json({ incentiveAmount: value });
  } catch (error) {
    return validationError(error);
  }
}
