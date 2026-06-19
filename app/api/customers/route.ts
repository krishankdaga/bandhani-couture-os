import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  storeId: z.string().min(1),
  preferences: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "customers.view");
  if (isApiError(user)) return user;

  const search = request.nextUrl.searchParams.get("search") ?? "";

  // Customers are shared across all stores — a customer may visit either
  // boutique — so no store scoping is applied here (only search filtering).
  const customers = await prisma.customer.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { email: { contains: search, mode: "insensitive" } },
              { address: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      store: true,
      _count: {
        select: {
          orders: true,
          interactions: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return NextResponse.json({ customers });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "customers.create");
  if (isApiError(user)) return user;

  try {
    const data = createSchema.parse(await request.json());

    // Non-owners may only create customers within their own store.
    const storeId = user.companyStatus !== "OWNER" && user.storeId ? user.storeId : data.storeId;

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          storeId,
          preferences: data.preferences
            ? data.preferences.split(",").map((x) => x.trim()).filter(Boolean)
            : undefined,
        },
        include: {
          store: true,
          _count: { select: { orders: true, interactions: true } },
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: "CREATE",
        entity: "Customer",
        entityId: created.id,
        newValue: { name: created.name, phone: created.phone, storeId: created.storeId },
      });
      return created;
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
