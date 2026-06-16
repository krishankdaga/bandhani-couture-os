import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "audit.view");
  if (isApiError(user)) return user;
  const logs = await prisma.auditLog.findMany({ include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ logs });
}
