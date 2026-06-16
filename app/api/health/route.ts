import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Unauthenticated liveness/readiness probe for load balancers and uptime
// monitoring. Confirms the process is up and the database is reachable.
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "ok",
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", db: "error", time: new Date().toISOString() },
      { status: 503 },
    );
  }
}
