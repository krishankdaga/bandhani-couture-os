
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { PRICING_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  baseCost: z.coerce.number().nonnegative(),
  fabricCost: z.coerce.number().default(0),
  embroideryCost: z.coerce.number().default(0),
  stitchingCost: z.coerce.number().default(0),
  overheadPercent: z.coerce.number().default(20),
  marginPercent: z.coerce.number().default(35),
  notes: z.string().optional().nullable(),
});

function finalPrice(data: z.infer<typeof schema>) {
  const subtotal = data.baseCost + data.fabricCost + data.embroideryCost + data.stitchingCost;
  const withOverhead = subtotal * (1 + data.overheadPercent / 100);
  return Math.round(withOverhead * (1 + data.marginPercent / 100));
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "pricing.view");
  if (isApiError(user)) return user;

  const templates = await prisma.pricingTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "pricing.create");
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    const template = await prisma.pricingTemplate.create({
      data: { ...data, finalPrice: finalPrice(data) },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
