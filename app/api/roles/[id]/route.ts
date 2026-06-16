import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional().nullable(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireOwner(request);
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const input = schema.parse(await request.json());
    const old = await prisma.companyRole.findUnique({ where: { id }, include: { permissions: true } });
    if (!old) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    const role = await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      const updated = await tx.companyRole.update({
        where: { id },
        data: { name: input.name, description: input.description || null, permissions: { create: input.permissions.map((permission) => ({ permission })) } },
        include: { permissions: true },
      });
      await writeAudit(tx, { userId: user.id, action: "PERMISSIONS_UPDATE", entity: "CompanyRole", entityId: id, oldValue: old, newValue: updated });
      return updated;
    });
    return NextResponse.json({ role });
  } catch (error) { return validationError(error); }
}
