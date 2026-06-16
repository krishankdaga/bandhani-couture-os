import { safeResponseJson } from "@/lib/json";

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  } catch {
    throw new Error("Unable to reach the server. Check your connection and try again.");
  }
  const result = await safeResponseJson<{ error?: string } & T>(response, {} as { error?: string } & T);
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

export function money(value: string | number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value)); }
export function shortDate(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
export function toast(message: string, tone: "success" | "error" = "success") { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cbos:toast", { detail: { message, tone } })); }
