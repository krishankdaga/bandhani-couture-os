/**
 * Parses unknown JSON-shaped input without throwing. Values already parsed by
 * Prisma or fetch callers are returned unchanged.
 */
export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value as T;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonArray(value: unknown): string[] {
  const parsed = safeJsonParse<unknown>(value, []);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

export async function safeResponseJson<T>(response: Response, fallback: T): Promise<T> {
  const body = await response.text();
  return safeJsonParse<T>(body, fallback);
}
