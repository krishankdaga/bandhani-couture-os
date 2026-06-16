import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireOwner } from "@/lib/api";
import { safeGroqConfig } from "@/lib/groq-config";

export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (isApiError(owner)) return owner;
  return NextResponse.json(safeGroqConfig(), { headers: { "Cache-Control": "no-store" } });
}
