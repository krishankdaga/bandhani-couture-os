import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    return user ? NextResponse.json({ user }) : NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  } catch (error) {
    console.error("Session lookup failed", error);
    return NextResponse.json({ error: "Database connection failed" }, { status: 503 });
  }
}
