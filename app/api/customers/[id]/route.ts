import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  storeId: z.string().optional(),
  preferences: z.string().optional().nullable(),
  likedPieces: z.string().optional().nullable(),
  piecesTried: z.string().optional().nullable(),
});

const interactionSchema = z.object({
  type: z.enum(["STORE_VISIT", "CALL", "WHATSAPP", "EMAIL", "NOTE"]),
  summary: z.string().min(2, "Add a short summary of the interaction"),
});

function csvToArray(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (!value) return [] as string[];
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "customers.view");
  if (isApiError(user)) return user;
  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id },
    include: {
      store: true,
      interactions: { include: { user: { select: { name: true } } }, orderBy: { occurredAt: "desc" } },
      communicationHistory: { orderBy: { sentAt: "desc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        include: { stylist: { select: { name: true } }, payments: { select: { amount: true, kind: true } } },
      },
    },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // --- Customer 360 aggregates ---
  const ACTIVE = ["DRAFT", "CONFIRMED", "IN_PRODUCTION", "READY"];
  const orders = customer.orders;
  const billedOrders = orders.filter((o) => o.status !== "CANCELLED");
  const totalRevenue = billedOrders.reduce((sum, o) => sum + Number(o.orderValue), 0);
  const totalPaid = orders.reduce((sum, o) => sum + o.payments.reduce((s, p) => s + (p.kind === "REFUND" ? -Number(p.amount) : Number(p.amount)), 0), 0);
  const orderCount = billedOrders.length;
  const stylistTally = new Map<string, number>();
  const customisationTally = new Map<string, number>();
  for (const o of orders) {
    if (o.stylist?.name) stylistTally.set(o.stylist.name, (stylistTally.get(o.stylist.name) ?? 0) + 1);
    for (const c of (Array.isArray(o.customisations) ? o.customisations : []) as string[]) {
      const key = String(c).trim();
      if (key) customisationTally.set(key, (customisationTally.get(key) ?? 0) + 1);
    }
  }
  const topBy = (map: Map<string, number>, n: number) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  const summary = {
    totalOrders: orderCount,
    activeOrders: orders.filter((o) => ACTIVE.includes(o.status)).length,
    totalRevenue,
    totalPaid,
    outstanding: Math.max(0, totalRevenue - totalPaid),
    averageOrderValue: orderCount ? Math.round(totalRevenue / orderCount) : 0,
    preferredStylist: topBy(stylistTally, 1)[0]?.name ?? null,
    favoriteCategories: topBy(customisationTally, 5),
    interactions: customer.interactions.length,
    firstOrderDate: billedOrders.length ? billedOrders[billedOrders.length - 1].createdAt : null,
    lastOrderDate: billedOrders.length ? billedOrders[0].createdAt : null,
  };

  return NextResponse.json({ customer, summary });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request, "customers.edit");
  if (isApiError(user)) return user;

  try {
    const { id } = await params;
    const data = updateSchema.parse(await request.json());

    const existing = await prisma.customer.findFirst({
      where: { id },
      select: { id: true, name: true, phone: true, email: true, address: true, storeId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email === "" ? null : data.email,
          address: data.address,
          storeId: data.storeId,
          preferences: csvToArray(data.preferences),
          likedPieces: csvToArray(data.likedPieces),
          piecesTried: csvToArray(data.piecesTried),
        },
        include: {
          store: true,
          _count: { select: { orders: true, interactions: true } },
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: "UPDATE",
        entity: "Customer",
        entityId: id,
        oldValue: existing,
        newValue: { name: updated.name, phone: updated.phone, email: updated.email, address: updated.address },
      });
      return updated;
    });

    return NextResponse.json({ customer });
  } catch (error) {
    return validationError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request, "customers.edit");
  if (isApiError(user)) return user;

  try {
    const { id } = await params;
    const data = interactionSchema.parse(await request.json());

    const existing = await prisma.customer.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const interaction = await prisma.$transaction(async (tx) => {
      const created = await tx.interaction.create({
        data: { customerId: id, userId: user.id, type: data.type, summary: data.summary },
        include: { user: { select: { name: true } } },
      });
      // Touch the customer so "last updated" reflects the latest activity.
      await tx.customer.update({ where: { id }, data: { updatedAt: new Date() } });
      await writeAudit(tx, {
        userId: user.id,
        action: "INTERACTION_ADDED",
        entity: "Customer",
        entityId: id,
        newValue: { type: data.type, summary: data.summary },
      });
      return created;
    });

    return NextResponse.json({ interaction }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
