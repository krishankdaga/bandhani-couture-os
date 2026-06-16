import { CompanyStatus, Role } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePermissions } from "@/lib/permissions";

const COOKIE_NAME = "cbos_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "development-only-secret-change-me");

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  companyStatus: CompanyStatus;
  companyRoleId: string | null;
  companyRoleName: string | null;
  storeId: string | null;
  permissions: string[];
};

export async function createSessionToken(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

async function verifyToken(token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getRequestUser(request?: NextRequest): Promise<SessionUser | null> {
  const token = request?.cookies.get(COOKIE_NAME)?.value ?? (await cookies()).get(COOKIE_NAME)?.value;
  const session = await verifyToken(token);
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: { id: session.id, active: true },
    select: {
      id: true, name: true, email: true, image: true, role: true, companyStatus: true, companyRoleId: true, storeId: true,
      companyRole: { select: { name: true, permissions: { select: { permission: true } } } },
      permissionOverrides: { select: { permission: true, granted: true } },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    companyStatus: user.companyStatus,
    companyRoleId: user.companyRoleId,
    companyRoleName: user.companyRole?.name ?? null,
    storeId: user.storeId,
    permissions: resolvePermissions({
      companyStatus: user.companyStatus,
      legacyRole: user.role,
      rolePermissions: user.companyRole?.permissions.map((item) => item.permission),
      overrides: user.permissionOverrides,
    }),
  };
}

export const authCookie = {
  name: COOKIE_NAME,
  options: { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 },
};
