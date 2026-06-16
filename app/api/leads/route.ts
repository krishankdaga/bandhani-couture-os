import { LeadSource, LeadStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { LEAD_WRITE_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const leadSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  source: z.nativeEnum(LeadSource),
  storeId: z.string().min(1),
  stylistId: z.string().optional().nullable(),
  preferences: z.array(z.string()).default([]),
  budget: z.coerce.number().nonnegative().optional().nullable(),
  eventDate: z.string().date().optional().nullable(),
  followUpDate: z.string().datetime({ local: true }).optional().nullable(),
  status: z.nativeEnum(LeadStatus).default(LeadStatus.NEW),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "leads.view");
  if (isApiError(user)) return user;
  const status = request.nextUrl.searchParams.get("status") as LeadStatus | null;
  const search = request.nextUrl.searchParams.get("search") ?? "";
  const leads = await prisma.lead.findMany({
    where: {
      ...(user.storeId && !["OWNER", "PARTNER"].includes(user.role) ? { storeId: user.storeId } : {}),
      ...(status ? { status } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] } : {}),
    },
    include: { store: true, stylist: { select: { id: true, name: true } }, customer: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ leads });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "leads.create");
  if (isApiError(user)) return user;
  try {
    const data = leadSchema.parse(await request.json());
    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          ...data,
          stylistId: data.stylistId || null,
          budget: data.budget,
          preferences: data.preferences,
          eventDate: data.eventDate ? new Date(data.eventDate) : null,
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        },
      });
      await writeAudit(tx, { userId: user.id, action: "CREATE", entity: "Lead", entityId: created.id, newValue: created });
      return created;
    });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
