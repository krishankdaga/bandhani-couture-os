"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Ruler } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { api, money, shortDate } from "@/lib/client";
import { StatusBadge } from "@/components/status-badge";
import { safeJsonArray } from "@/lib/json";
import { ErrorState, InlineMessage, LoadingState } from "@/components/async-state";

type CustomMeasurement = { name: string; value: string; notes?: string };

function parseStandardMeasurements(raw: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k !== "_custom") result[k] = String(v);
  }
  return result;
}

function parseCustomMeasurements(raw: Record<string, unknown>): CustomMeasurement[] {
  const arr = raw._custom;
  if (!Array.isArray(arr)) return [];
  return arr.map((item: unknown) => {
    const m = item as Record<string, unknown>;
    return { name: String(m.name ?? ""), value: String(m.value ?? ""), notes: m.notes ? String(m.notes) : undefined };
  });
}

type Customer = { id: string; name: string; phone: string; email: string | null; address: string | null; updatedAt: string; preferences: string[] | null; likedPieces: string[] | null; piecesTried: string[] | null; store: { name: string }; interactions: Array<{ id: string; type: string; summary: string; occurredAt: string; user: { name: string } }>; communicationHistory: Array<{ id: string; channel: string; message: string; sentAt: string }>; orders: Array<{ id: string; orderNumber: string; orderValue: string; deliveryDate: string; status: string; measurements: Record<string, unknown>; stylist?: { name: string } | null }> };
type Summary = { totalOrders: number; activeOrders: number; totalRevenue: number; totalPaid: number; outstanding: number; averageOrderValue: number; preferredStylist: string | null; favoriteCategories: Array<{ name: string; count: number }>; interactions: number; firstOrderDate: string | null; lastOrderDate: string | null };
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>(); const [customer, setCustomer] = useState<Customer | null>(null); const [summary, setSummary] = useState<Summary | null>(null); const [error, setError] = useState(""); const [formError, setFormError] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const result = await api<{ customer: Customer; summary: Summary }>(`/api/customers/${id}`); setCustomer(result.customer); setSummary(result.summary); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, [id]);
  useEffect(() => { load(); }, [load]);
  async function addInteraction(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setFormError(""); setSaving(true); const formElement = event.currentTarget; const form = new FormData(formElement); try { await api(`/api/customers/${id}`, { method: "POST", body: JSON.stringify(Object.fromEntries(form)) }); formElement.reset(); await load(); } catch (e) { setFormError((e as Error).message); } finally { setSaving(false); } }
  if (loading) return <><PageHeader title="Customer profile" /><LoadingState label="Loading customer..." /></>;
  if (error) return <><PageHeader title="Customer profile" /><ErrorState message={error} retry={load} /></>;
  if (!customer) return <><PageHeader title="Customer profile" /><ErrorState message="Customer not found." /></>;
  return <div className="print-summary"><PageHeader title={customer.name} description={`${customer.phone} · ${customer.store.name}`} action={<button onClick={() => window.print()} className="btn-secondary no-print">Print customer summary</button>} />
    <p className="mb-5 text-xs text-stone-400">Last updated {new Date(customer.updatedAt).toLocaleString("en-IN")}</p>
    {summary && <>
      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-stone-400">Lifetime value</p><p className="mt-1 text-lg font-semibold">{money(summary.totalRevenue)}</p><p className="mt-1 text-xs text-stone-400">{money(summary.totalPaid)} collected</p></div>
        <div className="card p-4"><p className="text-xs text-stone-400">Total orders</p><p className="mt-1 text-lg font-semibold">{summary.totalOrders}</p><p className="mt-1 text-xs text-stone-400">{summary.activeOrders} active now</p></div>
        <div className="card p-4"><p className="text-xs text-stone-400">Average order value</p><p className="mt-1 text-lg font-semibold">{money(summary.averageOrderValue)}</p></div>
        <div className="card p-4"><p className="text-xs text-stone-400">Outstanding</p><p className={`mt-1 text-lg font-semibold ${summary.outstanding > 0 ? "text-wine" : "text-emerald-700"}`}>{money(summary.outstanding)}</p></div>
      </section>
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card p-4"><p className="text-xs text-stone-400">Preferred stylist</p><p className="mt-1 text-sm font-semibold">{summary.preferredStylist ?? "—"}</p></div>
        <div className="card p-4"><p className="text-xs text-stone-400">Favourite customisations</p><p className="mt-1 text-sm">{summary.favoriteCategories.length ? summary.favoriteCategories.map((c) => c.name).join(", ") : "—"}</p></div>
        <div className="card p-4"><p className="text-xs text-stone-400">Customer since</p><p className="mt-1 text-sm font-semibold">{summary.firstOrderDate ? shortDate(summary.firstOrderDate) : "—"}</p><p className="mt-1 text-xs text-stone-400">{summary.interactions} interactions logged</p></div>
      </section>
    </>}
    <div className="grid gap-6 xl:grid-cols-3">
      <section className="card p-5">
        <h3 className="font-semibold">Couture profile</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div><dt className="text-stone-400">Preferences</dt><dd>{safeJsonArray(customer.preferences).join(", ") || "Not recorded"}</dd></div>
          <div><dt className="text-stone-400">Liked pieces</dt><dd>{safeJsonArray(customer.likedPieces).join(", ") || "Not recorded"}</dd></div>
          <div><dt className="text-stone-400">Pieces tried</dt><dd>{safeJsonArray(customer.piecesTried).join(", ") || "Not recorded"}</dd></div>
        </dl>
        {(() => {
          const latestOrder = customer.orders.find((o) => o.status !== "CANCELLED" && o.measurements);
          if (!latestOrder) return null;
          const standard = parseStandardMeasurements(latestOrder.measurements);
          const custom = parseCustomMeasurements(latestOrder.measurements);
          const hasAny = Object.keys(standard).length > 0 || custom.length > 0;
          if (!hasAny) return null;
          return (
            <div className="mt-5 border-t border-stone-100 pt-4">
              <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500"><Ruler size={12} />Body measurements <span className="font-normal text-stone-400 normal-case">({latestOrder.orderNumber})</span></div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(standard).map(([k, v]) => <div key={k}><dt className="capitalize text-stone-400">{k}</dt><dd>{v}</dd></div>)}
              </dl>
              {custom.length > 0 && (
                <dl className="mt-3 space-y-1.5 text-sm">
                  {custom.map((cm, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0">
                      <dt className="text-stone-400">{cm.name}</dt>
                      <dd className="font-medium">{cm.value}</dd>
                      {cm.notes && <dd className="text-xs text-stone-400 italic">{cm.notes}</dd>}
                    </div>
                  ))}
                </dl>
              )}
            </div>
          );
        })()}
      </section>
      <section className="card p-5 xl:col-span-2"><h3 className="font-semibold">Contact details</h3><p className="mt-3 text-sm">{customer.email || "Email not recorded"}</p><p className="mt-1 text-sm text-stone-500">{customer.address || "Address not recorded"}</p><div className="no-print"><h3 className="mt-6 font-semibold">Add interaction</h3><form onSubmit={addInteraction} className="mt-4 grid gap-3 md:grid-cols-4"><select name="type" aria-label="Interaction type">{["STORE_VISIT", "CALL", "WHATSAPP", "EMAIL", "NOTE"].map(v => <option key={v}>{v.replaceAll("_", " ")}</option>)}</select><input className="md:col-span-2" name="summary" minLength={2} placeholder="Interaction summary" required /><button disabled={saving} className="btn-primary">{saving ? "Adding..." : "Add note"}</button>{formError && <div className="md:col-span-4"><InlineMessage message={formError} /></div>}</form></div><div className="mt-5 space-y-3">{customer.interactions.map(i => <div className="border-l-2 border-gold pl-3" key={i.id}><p className="text-sm">{i.summary}</p><p className="text-xs text-stone-400">{i.type.replaceAll("_", " ")} · {i.user.name} · {shortDate(i.occurredAt)}</p></div>)}{!customer.interactions.length && <p className="text-sm text-stone-400">No interactions recorded yet.</p>}</div></section>
    </div>
    <section className="card mt-6 p-5"><h3 className="font-semibold">Communication history</h3><div className="mt-4 space-y-3">{customer.communicationHistory.map(item => <div key={item.id} className="rounded-lg border border-stone-100 p-3"><p className="text-sm">{item.message}</p><p className="text-xs text-stone-400">{item.channel} · {shortDate(item.sentAt)}</p></div>)}{!customer.communicationHistory.length && <p className="text-sm text-stone-400">No communication recorded yet.</p>}</div></section>
    <section className="card mt-6 p-5"><h3 className="font-semibold">Order history</h3><div className="mt-4 space-y-3">{customer.orders.map(o => <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between rounded-lg border border-stone-100 p-3 hover:bg-stone-50"><div><strong className="text-sm text-wine">{o.orderNumber}</strong><p className="text-xs text-stone-500">{money(o.orderValue)} · due {shortDate(o.deliveryDate)}{o.stylist?.name ? ` · ${o.stylist.name}` : ""}</p></div><StatusBadge value={o.status} /></Link>)}{!customer.orders.length && <p className="text-sm text-stone-400">No orders yet.</p>}</div></section>
  </div>;
}
