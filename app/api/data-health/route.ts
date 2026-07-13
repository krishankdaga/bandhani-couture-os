import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireOwner, validationError } from "@/lib/api";
import { syncDelayStates } from "@/lib/delay-sync";
import { stockStanding } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

/**
 * Owner-only Data Health Center.
 * Surfaces data-integrity and operational-hygiene issues across the system,
 * each with a count, a sample of affected records, and a link to act on them.
 */
export async function GET(request: NextRequest) {
  const user = await requireOwner(request);
  if (isApiError(user)) return user;
  try {
    await syncDelayStates();
    const now = new Date();

    const [
      customersNoAddress,
      usersNoRole,
      pendingPurchases,
      delayedStages,
      lowStockItems,
      overdueFollowUps,
      activeOrdersNoMaterials,
      unpaidDeliveredOrders,
    ] = await Promise.all([
      prisma.customer.findMany({ where: { OR: [{ address: null }, { address: "" }] }, select: { id: true, name: true, phone: true }, take: 8, orderBy: { createdAt: "desc" } }),
      prisma.user.findMany({ where: { active: true, companyStatus: { not: "OWNER" }, companyRoleId: null }, select: { id: true, name: true, email: true }, take: 8 }),
      prisma.purchase.findMany({ where: { status: { in: ["REQUESTED", "ORDERED"] } }, select: { id: true, purchaseNo: true, vendorName: true, expectedDate: true }, take: 8, orderBy: { expectedDate: "asc" } }),
      prisma.productionStage.findMany({ where: { status: { not: "COMPLETED" }, delayState: "RED", order: { status: { notIn: ["DELIVERED", "CANCELLED"] } } }, select: { id: true, type: true, order: { select: { id: true, orderNumber: true } } }, take: 8, orderBy: { dueDate: "asc" } }),
      prisma.inventoryItem.findMany({ where: { reorderAt: { not: null } }, select: { id: true, sku: true, name: true, quantity: true, reorderAt: true, unit: true } }),
      prisma.lead.findMany({ where: { followUpDate: { lt: now }, status: { in: ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED"] } }, select: { id: true, name: true, phone: true, followUpDate: true }, take: 8, orderBy: { followUpDate: "asc" } }),
      prisma.order.findMany({ where: { status: { in: ["CONFIRMED", "IN_PRODUCTION"] }, materials: { none: {} } }, select: { id: true, orderNumber: true, customer: { select: { name: true } } }, take: 8, orderBy: { createdAt: "desc" } }),
      prisma.order.findMany({ where: { status: "DELIVERED" }, select: { id: true, orderNumber: true, orderValue: true, payments: { select: { amount: true, kind: true } } }, take: 50, orderBy: { updatedAt: "desc" } }),
    ]);

    const lowStock = lowStockItems.filter((i) => Number(i.quantity) <= Number(i.reorderAt));
    const unpaidDelivered = unpaidDeliveredOrders.filter((o) => {
      const net = o.payments.reduce((s, p) => s + (p.kind === "REFUND" ? -Number(p.amount) : Number(p.amount)), 0);
      return net < Number(o.orderValue);
    });

    const checks = [
      { key: "customers-no-address", label: "Customers without an address", severity: "warning", count: customersNoAddress.length, href: "/customers", sample: customersNoAddress.map((c) => `${c.name} · ${c.phone}`) },
      { key: "users-no-role", label: "Active staff without a role assigned", severity: "warning", count: usersNoRole.length, href: "/employees", sample: usersNoRole.map((u) => `${u.name} · ${u.email}`) },
      { key: "pending-purchases", label: "Purchases pending receipt", severity: "info", count: pendingPurchases.length, href: "/purchases", sample: pendingPurchases.map((p) => `${p.purchaseNo} · ${p.vendorName}`) },
      { key: "delayed-stages", label: "Delayed production stages", severity: "critical", count: delayedStages.length, href: "/production/command-center", sample: delayedStages.map((s) => `${s.order.orderNumber} · ${s.type.replaceAll("_", " ")}`) },
      { key: "low-stock", label: "Inventory at or below reorder level", severity: "warning", count: lowStock.length, href: "/inventory", sample: lowStock.slice(0, 8).map((i) => `${i.name} (${i.quantity} ${i.unit})`) },
      { key: "overdue-followups", label: "Overdue lead follow-ups", severity: "warning", count: overdueFollowUps.length, href: "/leads", sample: overdueFollowUps.map((l) => `${l.name} · ${l.phone}`) },
      { key: "orders-no-materials", label: "Active orders with no materials allocated", severity: "info", count: activeOrdersNoMaterials.length, href: "/orders", sample: activeOrdersNoMaterials.map((o) => `${o.orderNumber} · ${o.customer.name}`) },
      { key: "unpaid-delivered", label: "Delivered orders with a balance due", severity: "critical", count: unpaidDelivered.length, href: "/orders", sample: unpaidDelivered.slice(0, 8).map((o) => o.orderNumber) },
    ];

    const totalIssues = checks.reduce((sum, c) => sum + c.count, 0);
    return NextResponse.json({ generatedAt: now, totalIssues, checks });
  } catch (error) {
    return validationError(error);
  }
}
