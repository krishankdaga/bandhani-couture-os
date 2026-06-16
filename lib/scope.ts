import type { SessionUser } from "@/lib/auth";

export function storeScope(user: Pick<SessionUser, "companyStatus" | "storeId">) {
  return user.companyStatus !== "OWNER" && user.storeId ? { storeId: user.storeId } : {};
}

export function optionalStoreScope(user: Pick<SessionUser, "companyStatus" | "storeId">) {
  return user.companyStatus !== "OWNER" && user.storeId
    ? { OR: [{ storeId: user.storeId }, { storeId: null }] }
    : {};
}

/**
 * Resolve a store filter from a requested storeId while enforcing the caller's
 * permitted scope. Owners may target any specific store, or all stores when the
 * request is empty / "all". Non-owners are always pinned to their own store,
 * regardless of what was requested — they can never widen their scope.
 */
export function resolveStoreScope(
  user: Pick<SessionUser, "companyStatus" | "storeId">,
  requestedStoreId?: string | null,
) {
  if (user.companyStatus !== "OWNER") return storeScope(user);
  return requestedStoreId && requestedStoreId !== "all" ? { storeId: requestedStoreId } : {};
}

/**
 * Same permission rules as {@link resolveStoreScope}, but also includes records
 * with no store (storeId: null) — used for inventory/purchases that can be shared
 * across stores.
 */
export function resolveOptionalStoreScope(
  user: Pick<SessionUser, "companyStatus" | "storeId">,
  requestedStoreId?: string | null,
) {
  if (user.companyStatus !== "OWNER") return optionalStoreScope(user);
  return requestedStoreId && requestedStoreId !== "all"
    ? { OR: [{ storeId: requestedStoreId }, { storeId: null }] }
    : {};
}
