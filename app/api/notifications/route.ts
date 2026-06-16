import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { stockStanding } from "@/lib/inventory";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope, storeScope } from "@/lib/scope";

type Notification = { id: string; title: string; category: string; severity: "info" | "warning" | "critical"; date: Date | null; href: string };

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (isApiError(user)) return user;
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);

  const [stages, orders, stock, purchases, followUps, pardons] = await Promise.all([
    hasPermission(user, "production.view") ? prisma.productionStage.findMany({ where: { order: storeScope(user), status: { not: "COMPLETED" }, delayState: "RED" }, select: { id: true, type: true, dueDate: true, order: { select: { orderNumber: true } } }, take: 10, orderBy: { dueDate: "asc" } }) : Promise.resolve([]),
    hasPermission(user, "orders.view") ? prisma.order.findMany({ where: { ...storeScope(user), delayState: { in: ["RED", "YELLOW"] }, status: { notIn: ["DELIVERED", "CANCELLED"] } }, select: { id: true, orderNumber: true, delayState: true, deliveryDate: true, customer: { select: { name: true } } }, take: 10, orderBy: { deliveryDate: "asc" } }) : Promise.resolve([]),
    hasPermission(user, "inventory.view") ? prisma.inventoryItem.findMany({ where: { ...optionalStoreScope(user) }, select: { id: true, sku: true, name: true, quantity: true, reorderAt: true, unit: true, allocations: { select: { requiredQty: true, consumedQty: true, order: { select: { status: true } } } } }, orderBy: { updatedAt: "desc" } }) : Promise.resolve([]),
    hasPermission(user, "purchases.view") ? prisma.purchase.findMany({ where: { ...optionalStoreScope(user), status: { in: ["REQUESTED", "ORDERED"] } }, select: { id: true, purchaseNo: true, vendorName: true, status: true, expectedDate: true }, take: 10, orderBy: { expectedDate: "asc" } }) : Promise.resolve([]),
    hasPermission(user, "leads.view") ? prisma.lead.findMany({ where: { ...storeScope(user), followUpDate: { lte: tomorrow }, status: { in: ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED"] } }, select: { id: true, name: true, phone: true, followUpDate: true }, take: 10, orderBy: { followUpDate: "asc" } }) : Promise.resolve([]),
    user.companyStatus === "OWNER" ? prisma.delayPardon.findMany({ where: { status: "REQUESTED" }, select: { id: true, reason: true, createdAt: true }, take: 10, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
  ]);

  const notifications: Notification[] = [
    ...stages.map((item) => ({ id: `stage-${item.id}`, title: `${item.order.orderNumber}: ${item.type.replaceAll("_", " ")} is delayed`, category: "Production", severity: "critical" as const, date: item.dueDate, href: "/production" })),
    ...orders.map((item) => ({ id: `order-${item.id}`, title: `${item.orderNumber} for ${item.customer.name} is ${item.delayState === "RED" ? "delayed" : "at risk"}`, category: "Orders", severity: item.delayState === "RED" ? "critical" as const : "warning" as const, date: item.deliveryDate, href: "/orders" })),
    ...stock.flatMap((item) => {
      const standing = stockStanding(item);
      const out: Notification[] = [];
      if (standing.shortage > 0) out.push({ id: `shortage-${item.id}`, title: `${item.sku} ${item.name} is short ${standing.shortage} ${item.unit} against reserved orders`, category: "Inventory", severity: "critical", date: null, href: "/inventory" });
      else if (standing.belowReorder) out.push({ id: `stock-${item.id}`, title: `${item.sku} ${item.name} is low (${item.quantity} ${item.unit})`, category: "Inventory", severity: Number(item.quantity) <= 0 ? "critical" : "warning", date: null, href: "/inventory" });
      return out;
    }),
    ...purchases.map((item) => ({ id: `purchase-${item.id}`, title: `${item.purchaseNo} from ${item.vendorName} is pending receipt`, category: "Purchases", severity: item.expectedDate && item.expectedDate < now ? "critical" as const : "warning" as const, date: item.expectedDate, href: "/purchases" })),
    ...followUps.map((item) => ({ id: `followup-${item.id}`, title: `Follow up with ${item.name} (${item.phone})`, category: "Leads", severity: item.followUpDate && item.followUpDate < now ? "warning" as const : "info" as const, date: item.followUpDate, href: "/leads" })),
    ...pardons.map((item) => ({ id: `pardon-${item.id}`, title: `Delay pardon awaiting review: ${item.reason}`, category: "Pardons", severity: "warning" as const, date: item.createdAt, href: "/production" })),
  ].sort((a, b) => (a.severity === "critical" ? -1 : a.severity === "warning" ? 0 : 1) - (b.severity === "critical" ? -1 : b.severity === "warning" ? 0 : 1));

  const visible = notifications.slice(0, 40);
  const reads = await prisma.userNotificationRead.findMany({ where: { userId: user.id, notificationKey: { in: visible.map((item) => item.id) } }, select: { notificationKey: true, readAt: true } });
  const readMap = new Map(reads.map((item) => [item.notificationKey, item.readAt]));
  const withReadState = visible.map((item) => ({ ...item, read: readMap.has(item.id), readAt: readMap.get(item.id) ?? null }));
  return NextResponse.json({ notifications: withReadState, unreadCount: withReadState.filter((item) => !item.read).length, count: notifications.length, generatedAt: now });
}
