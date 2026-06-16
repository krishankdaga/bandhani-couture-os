import type { SessionUser } from "@/lib/auth";

export function storeScope(user: Pick<SessionUser, "companyStatus" | "storeId">) {
  return user.companyStatus !== "OWNER" && user.storeId ? { storeId: user.storeId } : {};
}

export function optionalStoreScope(user: Pick<SessionUser, "companyStatus" | "storeId">) {
  return user.companyStatus !== "OWNER" && user.storeId
    ? { OR: [{ storeId: user.storeId }, { storeId: null }] }
    : {};
}
