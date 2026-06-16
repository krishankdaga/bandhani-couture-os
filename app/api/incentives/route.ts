
import { IncentiveStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { INCENTIVE_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

const schema = z.object({
  userId: z.string().min(1),
  orderId: z.string().optional().nullable(),
  orderValue: z.coerce.number().positive(),
  percentage: z.coerce.number().default(1.5),
  status: z.nativeEnum(IncentiveStatus).default(IncentiveStatus.PENDING),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "incentives.view");
  if (isApiError(user)) return user;

  const incentives = await prisma.incentive.findMany({ orderBy: { createdAt: "desc" } });
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ incentives, users, canManage: hasPermission(user, "incentives.create") || hasPermission(user, "incentives.approve") || hasPermission(user, "incentives.pay") });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "incentives.create");
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    const incentive = await prisma.$transaction(async (tx) => { const created = await tx.incentive.create({ data: {
        ...data,
        amount: Math.round(data.orderValue * data.percentage / 100),
      } }); await writeAudit(tx,{userId:user.id,action:"CREATE",entity:"Incentive",entityId:created.id,newValue:created}); return created; });

    return NextResponse.json({ incentive }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
