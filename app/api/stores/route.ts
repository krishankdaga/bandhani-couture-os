import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).toUpperCase(),
  location: z.string().max(200).optional(),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "settings.view");
  if (isApiError(user)) return user;
  const stores = await prisma.store.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, customers: true, orders: true } } },
  });
  return NextResponse.json({ stores });
}

export async function POST(request: NextRequest) {
  const user = await requireOwner(request);
  if (isApiError(user)) return user;
  try {
    const data = schema.parse(await request.json());
    const store = await prisma.$transaction(async (tx) => {
      const created = await tx.store.create({ data });
      await writeAudit(tx, { userId: user.id, action: "CREATE", entity: "Store", entityId: created.id, newValue: created });
      return created;
    });
    return NextResponse.json({ store }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
