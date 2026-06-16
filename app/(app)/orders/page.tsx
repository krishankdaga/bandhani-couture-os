"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api, money, shortDate } from "@/lib/client";
import { EmptyState, ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import Link from "next/link";

type Order = { id: string; orderNumber: string; orderValue: string; priority: string; deliveryDate: string; status: string; delayState: string; customer: { name: string; phone: string }; stylist: { name: string }; stages: Array<{ status: string }> };
type Meta = { stores: Array<{ id: string; name: string }>; users: Array<{ id: string; name: string; role: string }>; customers: Customer[] };
type Customer = { id: string; name: string; phone: string; store: { name: string } };
type Session = { user: { permissions: string[] } };
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]); const [meta, setMeta] = useState<Meta>({ stores: [], users: [], customers: [] }); const [customers, setCustomers] = useState<Customer[]>([]); const [show, setShow] = useState(false); const [error, setError] = useState(""); const [pageError, setPageError] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [permissions, setPermissions] = useState<string[]>([]);
  const load = useCallback(async () => { setLoading(true); setPageError(""); try { const [orderResult, metaResult, session] = await Promise.all([api<{ orders: Order[] }>("/api/orders"), api<Meta>("/api/meta"), api<Session>("/api/auth/me")]); setOrders(orderResult.orders); setMeta(metaResult); setCustomers(metaResult.customers); setPermissions(session.user.permissions); } catch (e) { setPageError((e as Error).message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setSaving(true); const form = new FormData(event.currentTarget); const values = Object.fromEntries(form); try { await api("/api/orders", { method: "POST", body: JSON.stringify({ ...values, customisations: String(values.customisations || "").split(",").map(v => v.trim()).filter(Boolean), referenceImages: String(values.referenceImages || "").split(",").map(v => v.trim()).filter(Boolean), measurements: { bust: values.bust, waist: values.waist, hip: values.hip, length: values.length } }) }); setShow(false); await load(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }
  const canWrite = permissions.includes("orders.create");
  return <><PageHeader title="Order Management" description="Create couture orders and track delivery commitments." action={canWrite ? <button disabled={!customers.length} className="btn-primary" onClick={() => setShow(!show)}>+ New order</button> : undefined} />
    {show && canWrite && <form onSubmit={create} className="card mb-6 grid gap-4 p-5 md:grid-cols-4">
      <div><label>Customer</label><select name="customerId" required><option value="">Select</option>{customers.map(v => <option key={v.id} value={v.id}>{v.name} · {v.phone}</option>)}</select></div><div><label>Stylist</label><select name="stylistId" required><option value="">Select</option>{meta.users.filter(v => v.role === "STYLIST").map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div><div><label>Store</label><select name="storeId" required><option value="">Select</option>{meta.stores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div><div><label>Order value</label><input name="orderValue" type="number" min="1" required /></div>
      {[["bust", "Bust"], ["waist", "Waist"], ["hip", "Hip"], ["length", "Length"]].map(([name, label]) => <div key={name}><label>{label}</label><input name={name} required placeholder="inches" /></div>)}
      <div><label>Priority</label><select name="priority"><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select></div><div><label>Delivery date</label><input name="deliveryDate" type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} required /></div><div className="md:col-span-2"><label>Customisations (comma separated)</label><input name="customisations" /></div><div className="md:col-span-4"><label>Reference image URLs (comma separated)</label><input name="referenceImages" placeholder="https://example.com/reference.jpg" /></div>
      {error && <div className="md:col-span-4"><InlineMessage message={error} /></div>}<div className="flex gap-2 md:col-span-4"><button disabled={saving} className="btn-primary">{saving ? "Creating..." : "Create order"}</button><button disabled={saving} type="button" className="btn-secondary" onClick={() => setShow(false)}>Cancel</button></div>
    </form>}
    {pageError && <div className="mb-4"><ErrorState message={pageError} retry={load} /></div>}
    {loading ? <LoadingState label="Loading orders..." /> : !orders.length ? <EmptyState message={canWrite ? "No orders yet. Create an order for an existing customer." : "No orders are assigned to your store or current access."} /> : <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Value</th><th>Stylist</th><th>Delivery</th><th>Status</th><th>Health</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td><Link href={`/orders/${o.id}`} className="font-semibold text-wine hover:underline">{o.orderNumber}</Link><p className="text-xs text-stone-500">{o.priority}</p></td><td>{o.customer.name}<p className="text-xs text-stone-500">{o.customer.phone}</p></td><td>{money(o.orderValue)}</td><td>{o.stylist.name}</td><td>{shortDate(o.deliveryDate)}</td><td><StatusBadge value={o.status} /></td><td><StatusBadge value={o.delayState} /></td></tr>)}</tbody></table></div>}
  </>;
}
