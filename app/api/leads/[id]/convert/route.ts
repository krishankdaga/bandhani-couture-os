import { LeadStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { LEAD_WRITE_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "leads.convert");
  if (isApiError(user)) return user;
  const { id } = await context.params;
  const lead = await prisma.lead.findUnique({ where: { id }, include: { customer: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.customer) return NextResponse.json({ customer: lead.customer });

  const existing = await prisma.customer.findUnique({ where: { phone: lead.phone } });
  if (existing) return NextResponse.json({ error: "A customer already exists with this phone number" }, { status: 409 });

  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({ data: { name: lead.name, phone: lead.phone, storeId: lead.storeId, leadId: lead.id, preferences: lead.preferences ?? undefined } });
    await tx.lead.update({ where: { id }, data: { status: LeadStatus.CONVERTED } });
    await writeAudit(tx, { userId: user.id, action: "CONVERT", entity: "Lead", entityId: id, oldValue: lead, newValue: created });
    return created;
  });
  return NextResponse.json({ customer }, { status: 201 });
}
