import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

type IncentiveStat = { count: number; amount: number };
const blankStat = (): IncentiveStat => ({ count: 0, amount: 0 });

// Incentives are configured per employee (a fixed amount set on the employee
// profile) and generated automatically when an order ships on time — there is
// no manual create here. This endpoint lists eligible employees with their
// generated incentive records so owners can approve and mark them paid.
export async function GET(request: NextRequest) {
  const user = await requireUser(request, "incentives.view");
  if (isApiError(user)) return user;

  const [incentives, users] = await Promise.all([
    prisma.incentive.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true, incentiveAmount: true, store: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  // Resolve order numbers for incentives tied to an order.
  const orderIds = [...new Set(incentives.map((item) => item.orderId).filter(Boolean))] as string[];
  const orders = orderIds.length
    ? await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNumber: true } })
    : [];
  const orderNumberById = new Map(orders.map((order) => [order.id, order.orderNumber]));

  // Group incentive records by employee.
  const byUser = new Map<string, Array<{ id: string; orderId: string | null; orderNumber: string | null; amount: number; status: string; notes: string | null; createdAt: Date }>>();
  for (const item of incentives) {
    const list = byUser.get(item.userId) ?? [];
    list.push({ id: item.id, orderId: item.orderId, orderNumber: item.orderId ? orderNumberById.get(item.orderId) ?? null : null, amount: Number(item.amount), status: item.status, notes: item.notes, createdAt: item.createdAt });
    byUser.set(item.userId, list);
  }

  // Show only employees who can earn an incentive: those with a configured
  // incentive amount, or who already have incentive records.
  const employees = users
    .filter((u) => u.incentiveAmount != null || byUser.has(u.id))
    .map((u) => {
      const records = byUser.get(u.id) ?? [];
      const totals: Record<string, IncentiveStat> = { PENDING: blankStat(), APPROVED: blankStat(), PAID: blankStat() };
      for (const record of records) {
        const stat = totals[record.status];
        if (stat) { stat.count += 1; stat.amount += record.amount; }
      }
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        store: u.store?.name ?? null,
        incentiveAmount: u.incentiveAmount != null ? Number(u.incentiveAmount) : null,
        totals,
        incentives: records,
      };
    });

  return NextResponse.json({ employees, canManage: hasPermission(user, "incentives.approve") || hasPermission(user, "incentives.pay") });
}
