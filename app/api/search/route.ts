import { InventoryCategory, LeadSource, LeadStatus, OrderStatus, PurchaseStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope, storeScope } from "@/lib/scope";

function enumMatch<T extends Record<string, string>>(values: T, query: string) {
  const normalized = query.trim().toUpperCase().replace(/[ -]+/g, "_");
  return Object.values(values).includes(normalized) ? normalized as T[keyof T] : undefined;
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (isApiError(user)) return user;
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ query: q, groups: {}, generatedAt: new Date() });

  const [customers, leads, orders, inventory, purchases] = await Promise.all([
    hasPermission(user, "customers.view") ? prisma.customer.findMany({
      where: { ...storeScope(user), OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } }] },
      select: { id: true, name: true, phone: true, email: true, address: true }, take: 6, orderBy: { updatedAt: "desc" },
    }) : Promise.resolve([]),
    hasPermission(user, "leads.view") ? prisma.lead.findMany({
      where: { ...storeScope(user), OR: [
        { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } },
        ...(enumMatch(LeadStatus, q) ? [{ status: enumMatch(LeadStatus, q) }] : []),
        ...(enumMatch(LeadSource, q) ? [{ source: enumMatch(LeadSource, q) }] : []),
      ] }, select: { id: true, name: true, phone: true, status: true, source: true }, take: 6, orderBy: { updatedAt: "desc" },
    }) : Promise.resolve([]),
    hasPermission(user, "orders.view") ? prisma.order.findMany({
      where: { ...storeScope(user), OR: [
        { orderNumber: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } },
        ...(enumMatch(OrderStatus, q) ? [{ status: enumMatch(OrderStatus, q) }] : []),
      ] }, select: { id: true, orderNumber: true, status: true, delayState: true, customer: { select: { name: true } } }, take: 6, orderBy: { updatedAt: "desc" },
    }) : Promise.resolve([]),
    hasPermission(user, "inventory.view") ? prisma.inventoryItem.findMany({
      where: { ...optionalStoreScope(user), OR: [
        { sku: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } },
        ...(enumMatch(InventoryCategory, q) ? [{ category: enumMatch(InventoryCategory, q) }] : []),
      ] }, select: { id: true, sku: true, name: true, category: true, quantity: true, unit: true }, take: 6, orderBy: { updatedAt: "desc" },
    }) : Promise.resolve([]),
    hasPermission(user, "purchases.view") ? prisma.purchase.findMany({
      where: { ...optionalStoreScope(user), OR: [
        { purchaseNo: { contains: q, mode: "insensitive" } }, { vendorName: { contains: q, mode: "insensitive" } },
        { lines: { some: { itemName: { contains: q, mode: "insensitive" } } } },
        ...(enumMatch(PurchaseStatus, q) ? [{ status: enumMatch(PurchaseStatus, q) }] : []),
      ] }, select: { id: true, purchaseNo: true, vendorName: true, status: true, expectedDate: true }, take: 6, orderBy: { updatedAt: "desc" },
    }) : Promise.resolve([]),
  ]);

  return NextResponse.json({ query: q, generatedAt: new Date(), groups: {
    Customers: customers.map((item) => ({ id: item.id, title: item.name, subtitle: [item.phone, item.email, item.address].filter(Boolean).join(" · "), href: `/customers/${item.id}` })),
    Leads: leads.map((item) => ({ id: item.id, title: item.name, subtitle: `${item.phone} · ${item.status.replaceAll("_", " ")} · ${item.source.replaceAll("_", " ")}`, href: `/leads?search=${encodeURIComponent(item.phone)}` })),
    Orders: orders.map((item) => ({ id: item.id, title: item.orderNumber, subtitle: `${item.customer.name} · ${item.status.replaceAll("_", " ")} · ${item.delayState}`, href: `/orders?search=${encodeURIComponent(item.orderNumber)}` })),
    Inventory: inventory.map((item) => ({ id: item.id, title: `${item.sku} · ${item.name}`, subtitle: `${item.category.replaceAll("_", " ")} · ${item.quantity} ${item.unit}`, href: `/inventory?search=${encodeURIComponent(item.sku)}` })),
    Purchases: purchases.map((item) => ({ id: item.id, title: item.purchaseNo, subtitle: `${item.vendorName} · ${item.status.replaceAll("_", " ")}`, href: `/purchases?search=${encodeURIComponent(item.purchaseNo)}` })),
  } });
}
