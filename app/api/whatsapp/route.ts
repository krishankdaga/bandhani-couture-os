
import { WhatsAppTemplateType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { WHATSAPP_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(WhatsAppTemplateType),
  message: z.string().min(5),
  active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "whatsapp.view");
  if (isApiError(user)) return user;

  const templates = await prisma.whatsAppTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "whatsapp.edit");
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    const template = await prisma.whatsAppTemplate.create({ data });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
