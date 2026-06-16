import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const roleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional().nullable(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).default([]),
});

export async function GET(request: NextRequest) {
  const user = await requireOwner(request);
  if (isApiError(user)) return user;
  const roles = await prisma.companyRole.findMany({
    include: { permissions: { select: { permission: true } }, _count: { select: { users: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ roles, availablePermissions: ALL_PERMISSIONS });
}

export async function POST(request: NextRequest) {
  const user = await requireOwner(request);
  if (isApiError(user)) return user;
  try {
    const input = roleSchema.parse(await request.json());
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.companyRole.create({
        data: { name: input.name, description: input.description || null, permissions: { create: input.permissions.map((permission) => ({ permission })) } },
        include: { permissions: true },
      });
      await writeAudit(tx, { userId: user.id, action: "PERMISSIONS_CREATE", entity: "CompanyRole", entityId: created.id, newValue: created });
      return created;
    });
    return NextResponse.json({ role }, { status: 201 });
  } catch (error) { return validationError(error); }
}
