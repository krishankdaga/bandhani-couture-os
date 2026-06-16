import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

// ~700KB cap on the stored data URL keeps the row (and any cookie that ever
// carried it) small. The client downscales avatars before upload.
const MAX_IMAGE = 700_000;

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  image: z
    .string()
    .max(MAX_IMAGE, "Image is too large — please choose a smaller picture")
    .refine(
      (value) => value === "" || /^data:image\/(png|jpe?g|webp|gif);base64,/.test(value),
      "Profile picture must be a PNG, JPG, WEBP or GIF image",
    )
    .nullable()
    .optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await requireUser(request);
  if (isApiError(user)) return user;
  try {
    const data = schema.parse(await request.json());
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: user.id },
        data: {
          name: data.name,
          image: data.image === undefined ? undefined : data.image || null,
        },
        select: { id: true, name: true, email: true, image: true },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: "PROFILE_UPDATE",
        entity: "User",
        entityId: user.id,
        newValue: { name: result.name, pictureChanged: data.image !== undefined },
      });
      return result;
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return validationError(error);
  }
}
