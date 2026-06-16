/**
 * Build an optional `createdAt` range filter from query params. Returns {} when
 * neither bound is supplied (all-time), so it is safe to spread into a Prisma
 * `where`. Throws "Invalid date" on a malformed value so callers can surface it
 * through {@link validationError}.
 */
export function dateRangeScope(dateFrom?: string | null, dateTo?: string | null) {
  if (!dateFrom && !dateTo) return {};
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (Number.isNaN(from.getTime())) throw new Error("Invalid date");
    createdAt.gte = from;
  }
  if (dateTo) {
    const to = new Date(dateTo);
    if (Number.isNaN(to.getTime())) throw new Error("Invalid date");
    to.setHours(23, 59, 59, 999);
    createdAt.lte = to;
  }
  return { createdAt };
}
