import { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateRangeScope } from "@/lib/report-filters";
import { resolveStoreScope } from "@/lib/scope";

export type EmployeePerformanceRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyRoleName: string | null;
  storeName: string | null;
  activityCount: number;
  leadsHandled: number;
  conversions: number;
  purchasesHandled: number;
  inventoryMovements: number;
  incentiveAmount: number;
};

export type EmployeePerformanceParams = {
  storeId?: string | null;
  role?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
};

const ROLE_VALUES = new Set<string>(Object.values(Role));

/**
 * Per-employee activity from records that actually attribute work to a user.
 * Store scope is enforced via {@link resolveStoreScope}, so managers/employees
 * only ever see their own store regardless of the requested storeId. Every
 * figure is real: leads/conversions from the stylist relation, inventory
 * movements from StockMovement.createdById, incentives from Incentive.userId,
 * and activity/purchases handled from the audit trail (actor userId).
 */
export async function getEmployeePerformance(
  user: Pick<SessionUser, "companyStatus" | "storeId">,
  params: EmployeePerformanceParams,
): Promise<EmployeePerformanceRow[]> {
  const storeScope = resolveStoreScope(user, params.storeId);
  const dated = dateRangeScope(params.dateFrom, params.dateTo);
  const role = params.role && ROLE_VALUES.has(params.role) ? (params.role as Role) : undefined;
  const search = params.search?.trim();

  const employees = await prisma.user.findMany({
    where: {
      ...storeScope,
      ...(role ? { role } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}),
    },
    select: { id: true, name: true, email: true, role: true, companyRole: { select: { name: true } }, store: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const ids = employees.map((employee) => employee.id);
  if (ids.length === 0) return [];

  const [leadsAgg, conversionsAgg, movementsAgg, incentivesAgg, activityAgg, purchasesAgg] = await Promise.all([
    prisma.lead.groupBy({ by: ["stylistId"], where: { stylistId: { in: ids }, ...dated }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["stylistId"], where: { stylistId: { in: ids }, status: "CONVERTED", ...dated }, _count: { _all: true } }),
    prisma.stockMovement.groupBy({ by: ["createdById"], where: { createdById: { in: ids }, ...dated }, _count: { _all: true } }),
    prisma.incentive.groupBy({ by: ["userId"], where: { userId: { in: ids }, ...dated }, _sum: { amount: true } }),
    prisma.auditLog.groupBy({ by: ["userId"], where: { userId: { in: ids }, ...dated }, _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ["userId"], where: { userId: { in: ids }, entity: "Purchase", ...dated }, _count: { _all: true } }),
  ]);

  const leads = new Map(leadsAgg.map((row) => [row.stylistId, row._count._all]));
  const conversions = new Map(conversionsAgg.map((row) => [row.stylistId, row._count._all]));
  const movements = new Map(movementsAgg.map((row) => [row.createdById, row._count._all]));
  const activity = new Map(activityAgg.map((row) => [row.userId, row._count._all]));
  const purchases = new Map(purchasesAgg.map((row) => [row.userId, row._count._all]));
  const incentives = new Map(incentivesAgg.map((row) => [row.userId, Number(row._sum.amount ?? 0)]));

  return employees
    .map((employee) => ({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      companyRoleName: employee.companyRole?.name ?? null,
      storeName: employee.store?.name ?? null,
      activityCount: activity.get(employee.id) ?? 0,
      leadsHandled: leads.get(employee.id) ?? 0,
      conversions: conversions.get(employee.id) ?? 0,
      purchasesHandled: purchases.get(employee.id) ?? 0,
      inventoryMovements: movements.get(employee.id) ?? 0,
      incentiveAmount: incentives.get(employee.id) ?? 0,
    }))
    .sort((a, b) => b.activityCount - a.activityCount || a.name.localeCompare(b.name));
}
