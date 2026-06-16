
import { PurchaseStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { PURCHASE_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";

const lineSchema = z.object({
  itemName: z.string().min(2),
  quantity: z.coerce.number().positive(),
  unit: z.string().default("pcs"),
  rate: z.coerce.number().nonnegative(),
});

const schema = z.object({
  vendorName: z.string().min(2),
  storeId: z.string().optional().nullable(),
  status: z.nativeEnum(PurchaseStatus).default(PurchaseStatus.REQUESTED),
  expectedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "purchases.view");
  if (isApiError(user)) return user;

  const purchases = await prisma.purchase.findMany({
    where: optionalStoreScope(user),
    orderBy: { createdAt: "desc" },
    include: { lines: true },
  });

  return NextResponse.json({ purchases });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "purchases.create");
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    if (user.companyStatus !== "OWNER" && user.storeId && data.storeId && data.storeId !== user.storeId) return NextResponse.json({ error: "You cannot create purchases for another store" }, { status: 403 });
    const totalAmount = data.lines.reduce((sum, line) => sum + line.quantity * line.rate, 0);
    const count = await prisma.purchase.count();
    const purchaseNo = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({ data: {
        purchaseNo,
        vendorName: data.vendorName,
        storeId: user.companyStatus !== "OWNER" && user.storeId ? user.storeId : data.storeId,
        status: data.status,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        notes: data.notes,
        totalAmount,
        lines: {
          create: data.lines.map((line) => ({
            ...line,
            amount: line.quantity * line.rate,
          })),
        },
      }, include: { lines: true } });
      await writeAudit(tx, { userId: user.id, action: "CREATE", entity: "Purchase", entityId: created.id, newValue: created });
      return created;
    });

    return NextResponse.json({ purchase }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
