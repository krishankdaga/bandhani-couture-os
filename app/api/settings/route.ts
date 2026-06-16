import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { SETTINGS_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  key: z.string().min(2),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.record(z.string(), z.any()),
    z.array(z.any()),
    z.null(),
  ]),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "settings.view");
  if (isApiError(user)) return user;

  const settings = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "settings.edit");
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    const value = data.value as Prisma.InputJsonValue;

    const setting = await prisma.systemSetting.upsert({
      where: { key: data.key },
      create: {
        key: data.key,
        value,
      },
      update: {
        value,
      },
    });

    return NextResponse.json({ setting });
  } catch (error) {
    return validationError(error);
  }
}
