import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authCookie, createSessionToken } from "@/lib/auth";
import { safeJsonParse } from "@/lib/json";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(safeJsonParse(await request.text(), null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user?.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const sessionUser = {
      id: user.id, name: user.name, email: user.email, image: null, role: user.role, companyStatus: user.companyStatus,
      companyRoleId: user.companyRoleId, companyRoleName: null, storeId: user.storeId, permissions: [],
    };
    const response = NextResponse.json({ user: sessionUser });
    response.cookies.set(authCookie.name, await createSessionToken(sessionUser), authCookie.options);
    return response;
  } catch (error) {
    console.error("Login database error", error);
    return NextResponse.json(
      { error: "Database connection failed. Check DATABASE_URL and PostgreSQL permissions." },
      { status: 503 },
    );
  }
}
