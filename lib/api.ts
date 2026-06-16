import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestUser, SessionUser } from "@/lib/auth";
import { hasPermission, Permission } from "@/lib/permissions";

export async function requireUser(request: NextRequest, access?: Role[] | Permission): Promise<SessionUser | NextResponse> {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (typeof access === "string" && !hasPermission(user, access)) return NextResponse.json({ error: "You do not have permission for this action" }, { status: 403 });
    if (Array.isArray(access) && !access.includes(user.role)) return NextResponse.json({ error: "You do not have permission for this action" }, { status: 403 });
    return user;
  } catch (error) {
    console.error("Authentication database error", error);
    return NextResponse.json({ error: "Database connection failed" }, { status: 503 });
  }
}

export function isApiError(value: SessionUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

/**
 * A predictable, user-facing business-rule violation (e.g. "not enough stock").
 * Thrown inside route handlers/transactions and surfaced verbatim by validationError
 * with the given status (default 400), without polluting the expected-message list.
 */
export class BusinessError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BusinessError";
    this.status = status;
  }
}

export async function requireOwner(request: NextRequest): Promise<SessionUser | NextResponse> {
  const user = await requireUser(request);
  if (isApiError(user)) return user;
  return user.companyStatus === "OWNER"
    ? user
    : NextResponse.json({ error: "Only the company owner can perform this action" }, { status: 403 });
}

export async function requireAnyPermission(request: NextRequest, permissions: Permission[]): Promise<SessionUser | NextResponse> {
  const user = await requireUser(request);
  if (isApiError(user)) return user;
  return permissions.some((permission) => hasPermission(user, permission))
    ? user
    : NextResponse.json({ error: "You do not have permission for this action" }, { status: 403 });
}

export function validationError(error: unknown) {
  if (error instanceof BusinessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || "Invalid request" }, { status: 400 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return NextResponse.json({ error: "A record with these details already exists" }, { status: 409 });
    if (error.code === "P2003") return NextResponse.json({ error: "A selected related record is invalid" }, { status: 400 });
    if (error.code === "P2025") return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json({ error: "Database connection failed" }, { status: 503 });
  }
  const message = error instanceof Error ? error.message : "Request failed";
  const expectedMessages = [
    "Delivery date must be in the future", "Invalid date", "A selected related record is invalid",
    "Select an active stylist", "Customer and order must belong to the same store",
    "Production stage not found", "Order not found", "A pardon can only be requested for a delayed stage",
    "A pardon can only be requested for a delayed order", "A pardon request is already pending",
    "Inventory item not found", "Purchase not found", "Purchase already received", "Invalid purchase line",
    "Incentive not found",
  ];
  const isExpected = error instanceof Error && expectedMessages.includes(error.message);
  if (!isExpected) console.error("API error", error);
  return NextResponse.json({ error: isExpected ? message : "The request could not be completed" }, { status: isExpected ? 400 : 500 });
}
