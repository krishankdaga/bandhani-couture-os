import { CompanyStatus, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { ALL_PERMISSIONS, LEGACY_ROLE_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(2).max(80), email: z.string().email(), active: z.boolean(), companyStatus: z.nativeEnum(CompanyStatus),
  companyRoleId: z.string().nullable(), storeId: z.string().nullable(), legacyRole: z.nativeEnum(Role).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request);
  if (isApiError(owner)) return owner;
  try {
    const { id } = await params;
    const input = schema.parse(await request.json());
    const old = await prisma.user.findUnique({ where: { id }, include: { permissionOverrides: true } });
    if (!old) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    if (old.companyStatus === "OWNER" && (!input.active || input.companyStatus !== "OWNER")) {
      const owners = await prisma.user.count({ where: { companyStatus: "OWNER", active: true } });
      if (owners <= 1) return NextResponse.json({ error: "The last active owner cannot be deactivated or demoted" }, { status: 400 });
    }
    const selectedRole = input.companyRoleId ? await prisma.companyRole.findUnique({ where: { id: input.companyRoleId }, include: { permissions: true } }) : null;
    if (input.companyRoleId && !selectedRole) return NextResponse.json({ error: "Selected role not found" }, { status: 400 });
    const assignedLegacyRole = input.companyStatus === "OWNER" ? Role.OWNER : input.legacyRole ?? (input.companyStatus === "MANAGER" ? Role.STORE_MANAGER : Role.STYLIST);
    const rolePermissions = new Set(selectedRole ? selectedRole.permissions.map((item) => item.permission) : LEGACY_ROLE_PERMISSIONS[assignedLegacyRole]);
    const exactPermissions = new Set(input.permissions);
    const overrides = ALL_PERMISSIONS.filter((permission) => rolePermissions.has(permission) !== exactPermissions.has(permission));
    const employee = await prisma.$transaction(async (tx) => {
      await tx.userPermissionOverride.deleteMany({ where: { userId: id } });
      const updated = await tx.user.update({ where: { id }, data: {
        name: input.name, email: input.email.toLowerCase(), active: input.active, companyStatus: input.companyStatus,
        companyRoleId: input.companyRoleId, storeId: input.storeId,
        role: assignedLegacyRole,
        permissionOverrides: { create: overrides.map((permission) => ({ permission, granted: exactPermissions.has(permission) })) },
      }, include: { store: true, companyRole: { include: { permissions: true } }, permissionOverrides: true } });
      const action = old.active && !input.active ? "DEACTIVATE" : "UPDATE";
      await writeAudit(tx, { userId: owner.id, action, entity: "Employee", entityId: id, oldValue: { ...old, passwordHash: undefined }, newValue: { ...updated, passwordHash: undefined } });
      return updated;
    });
    const { passwordHash: _, ...safeEmployee } = employee;
    return NextResponse.json({ employee: safeEmployee });
  } catch (error) { return validationError(error); }
}
