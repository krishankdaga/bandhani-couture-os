import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(2, "Vendor name is required").max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  panNo: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().nullable(),
  active: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "vendors.view");
  if (isApiError(user)) return user;
  const search = request.nextUrl.searchParams.get("search") ?? "";
  const vendors = await prisma.vendor.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { panNo: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ vendors });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "vendors.create");
  if (isApiError(user)) return user;
  try {
    const data = createSchema.parse(await request.json());
    const vendor = await prisma.$transaction(async (tx) => {
      const created = await tx.vendor.create({
        data: {
          name: data.name,
          phone: data.phone || null,
          panNo: data.panNo || null,
          address: data.address || null,
          email: data.email || null,
          notes: data.notes || null,
          active: data.active,
        },
      });
      await writeAudit(tx, { userId: user.id, action: "CREATE", entity: "Vendor", entityId: created.id, newValue: created });
      return created;
    });
    return NextResponse.json({ vendor }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
