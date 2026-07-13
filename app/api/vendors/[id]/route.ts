import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  panNo: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "vendors.view");
  if (isApiError(user)) return user;
  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  return NextResponse.json({ vendor });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "vendors.edit");
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    const data = updateSchema.parse(await request.json());
    const vendor = await prisma.$transaction(async (tx) => {
      const updated = await tx.vendor.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.phone !== undefined && { phone: data.phone || null }),
          ...(data.panNo !== undefined && { panNo: data.panNo || null }),
          ...(data.address !== undefined && { address: data.address || null }),
          ...(data.email !== undefined && { email: data.email || null }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          ...(data.active !== undefined && { active: data.active }),
        },
      });
      await writeAudit(tx, { userId: user.id, action: "UPDATE", entity: "Vendor", entityId: id, oldValue: existing, newValue: updated });
      return updated;
    });
    return NextResponse.json({ vendor });
  } catch (error) {
    return validationError(error);
  }
}
