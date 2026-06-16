import { LeadStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { LEAD_WRITE_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(2).optional(), phone: z.string().min(8).optional(), stylistId: z.string().nullable().optional(),
  preferences: z.array(z.string()).optional(), budget: z.coerce.number().nonnegative().nullable().optional(),
  eventDate: z.string().date().nullable().optional(), followUpDate: z.string().datetime({ local: true }).nullable().optional(),
  status: z.nativeEnum(LeadStatus).optional(), notes: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "leads.edit");
  if (isApiError(user)) return user;
  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    const old = await prisma.lead.findUnique({ where: { id } });
    if (!old) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    const data: Prisma.LeadUpdateInput = { ...input, preferences: input.preferences };
    if (input.eventDate !== undefined) data.eventDate = input.eventDate ? new Date(input.eventDate) : null;
    if (input.followUpDate !== undefined) data.followUpDate = input.followUpDate ? new Date(input.followUpDate) : null;
    const lead = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({ where: { id }, data });
      await writeAudit(tx, { userId: user.id, action: "UPDATE", entity: "Lead", entityId: id, oldValue: old, newValue: updated });
      return updated;
    });
    return NextResponse.json({ lead });
  } catch (error) { return validationError(error); }
}
