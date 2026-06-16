import bcrypt from "bcryptjs";
import { CompanyStatus, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { ALL_PERMISSIONS, LEGACY_ROLE_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80), email: z.string().email(), password: z.string().min(8).max(100),
  companyStatus: z.nativeEnum(CompanyStatus), companyRoleId: z.string().nullable().optional(), storeId: z.string().nullable().optional(),
  legacyRole: z.nativeEnum(Role).optional(), permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional(),
});

const employeeInclude = {
  store: { select: { id: true, name: true } }, companyRole: { include: { permissions: { select: { permission: true } } } },
  permissionOverrides: { select: { permission: true, granted: true } },
} as const;

function legacyRole(status: CompanyStatus, requested?: Role) {
  if (status === CompanyStatus.OWNER) return Role.OWNER;
  return requested ?? (status === CompanyStatus.MANAGER ? Role.STORE_MANAGER : Role.STYLIST);
}

export async function GET(request: NextRequest) {
  const user = await requireOwner(request);
  if (isApiError(user)) return user;
  const [employees, roles, stores] = await Promise.all([
    prisma.user.findMany({ include: employeeInclude, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.companyRole.findMany({ include: { permissions: { select: { permission: true } } }, orderBy: { name: "asc" } }),
    prisma.store.findMany({ orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ employees: employees.map(({ passwordHash, ...employee }) => employee), roles, stores, availablePermissions: ALL_PERMISSIONS });
}

export async function POST(request: NextRequest) {
  const user = await requireOwner(request);
  if (isApiError(user)) return user;
  try {
    const input = createSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(input.password, 12);
    const selectedRole = input.companyRoleId ? await prisma.companyRole.findUnique({ where: { id: input.companyRoleId }, include: { permissions: true } }) : null;
    if (input.companyRoleId && !selectedRole) return NextResponse.json({ error: "Selected role not found" }, { status: 400 });
    const assignedLegacyRole = legacyRole(input.companyStatus, input.legacyRole);
    const rolePermissions = new Set(selectedRole ? selectedRole.permissions.map((item) => item.permission) : LEGACY_ROLE_PERMISSIONS[assignedLegacyRole]);
    const exactPermissions = new Set(input.permissions ?? [...rolePermissions]);
    const overrides = ALL_PERMISSIONS.filter((permission) => rolePermissions.has(permission) !== exactPermissions.has(permission));
    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: {
        name: input.name, email: input.email.toLowerCase(), passwordHash, companyStatus: input.companyStatus,
        companyRoleId: input.companyRoleId || null, storeId: input.storeId || null, role: assignedLegacyRole,
        permissionOverrides: { create: overrides.map((permission) => ({ permission, granted: exactPermissions.has(permission) })) },
      }, include: employeeInclude });
      await writeAudit(tx, { userId: user.id, action: "CREATE", entity: "Employee", entityId: created.id, newValue: { ...created, passwordHash: undefined } });
      return created;
    });
    const { passwordHash: _, ...safeEmployee } = employee;
    return NextResponse.json({ employee: safeEmployee }, { status: 201 });
  } catch (error) { return validationError(error); }
}
