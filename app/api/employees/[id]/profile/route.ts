import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { hasPermission, resolvePermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Employee profile. Authorization:
 *  - anyone may view their own profile;
 *  - owners may view every profile;
 *  - managers/employees need the `employees.view` permission AND may only view
 *    colleagues in their own store. The store check cannot be bypassed via the
 *    URL id — we compare the target's real storeId against the requester's.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requester = await requireUser(request);
  if (isApiError(requester)) return requester;
  const { id } = await params;

  const isSelf = requester.id === id;
  if (!isSelf && !hasPermission(requester, "employees.view")) {
    return NextResponse.json({ error: "You do not have permission to view this profile" }, { status: 403 });
  }

  const employee = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, image: true, role: true, companyStatus: true, active: true, createdAt: true,
      incentiveAmount: true,
      storeId: true, store: { select: { id: true, name: true } },
      companyRole: { select: { name: true, permissions: { select: { permission: true } } } },
      permissionOverrides: { select: { permission: true, granted: true } },
    },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Non-owners can only reach colleagues in their own store (self always allowed).
  if (!isSelf && requester.companyStatus !== "OWNER" && (!requester.storeId || employee.storeId !== requester.storeId)) {
    return NextResponse.json({ error: "You can only view profiles within your store" }, { status: 403 });
  }

  const permissions = resolvePermissions({
    companyStatus: employee.companyStatus,
    legacyRole: employee.role,
    rolePermissions: employee.companyRole?.permissions.map((item) => item.permission),
    overrides: employee.permissionOverrides,
  });

  const recentAudit = await prisma.auditLog.findMany({
    where: { userId: id },
    select: { id: true, action: true, entity: true, entityId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  // Performance metrics — only those a direct schema relation can support are
  // computed. Metrics with no per-user foreign key (e.g. who created a customer
  // or purchase) are returned as null so the UI can show "Not tracked yet"
  // rather than fabricating a number.
  const [
    leadsHandled,
    leadsConverted,
    stockMovements,
    stagesAssigned,
    stagesCompleted,
    incentivesByStatus,
  ] = await Promise.all([
    prisma.lead.count({ where: { stylistId: id } }),
    prisma.lead.count({ where: { stylistId: id, status: "CONVERTED" } }),
    prisma.stockMovement.count({ where: { createdById: id } }),
    prisma.productionStage.count({ where: { ownerId: id } }),
    prisma.productionStage.count({ where: { ownerId: id, status: "COMPLETED" } }),
    prisma.incentive.groupBy({ by: ["status"], where: { userId: id }, _count: { _all: true }, _sum: { amount: true } }),
  ]);

  const incentiveFor = (status: "PENDING" | "APPROVED" | "PAID") => {
    const row = incentivesByStatus.find((item) => item.status === status);
    return { count: row?._count._all ?? 0, amount: Number(row?._sum.amount ?? 0) };
  };

  const metrics = {
    crm: {
      leadsHandled,
      leadsConverted,
      customersCreated: null, // no creator FK on Customer
    },
    incentives: {
      pending: incentiveFor("PENDING"),
      approved: incentiveFor("APPROVED"),
      paid: incentiveFor("PAID"),
    },
    operations: {
      stockMovements,
      purchasesCreated: null, // no creator FK on Purchase
      purchasesReceived: null, // no receiver FK on Purchase
    },
    production: {
      stagesAssigned,
      stagesCompleted,
    },
  };

  return NextResponse.json({
    metrics,
    // Only the owner may configure incentive eligibility.
    canManageIncentive: requester.companyStatus === "OWNER",
    profile: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      image: employee.image,
      companyStatus: employee.companyStatus,
      role: employee.role,
      companyRoleName: employee.companyRole?.name ?? null,
      store: employee.store,
      active: employee.active,
      createdAt: employee.createdAt,
      incentiveAmount: employee.incentiveAmount != null ? Number(employee.incentiveAmount) : null,
      permissions,
    },
    recentAudit,
  });
}
