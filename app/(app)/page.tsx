"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, ClipboardCheck, Clock3, Package, PhoneCall, Plus, RefreshCw, ShoppingBag, UserPlus, Users } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { StatusBadge } from "@/components/status-badge";
import { api, shortDate } from "@/lib/client";
type Dashboard = { generatedAt: string; companyStatus: string; companyRoleName: string | null; permissions: string[]; metrics: { activeLeadsToday: number; followUpsDueToday: number; activeOrders: number; ordersAtRisk: number; delayedOrders: number; deliveriesDueThisWeek: number; materialShortages: number }; highValueOrders: Array<{ id: string; orderNumber: string; delayState: string; customer: { name: string }; deliveryDate: string }>; bottlenecks: Array<{ type: string; label: string; count: number; red: number; yellow: number }>; recentAudit: Array<{ id: string; action: string; entity: string; createdAt: string; user: { name: string } | null }>; followUps: Array<{ id: string; name: string; phone: string; status: string; followUpDate: string }>; lowStock: Array<{ id: string; sku: string; name: string; quantity: string; reorderAt: string; unit: string }>; shortages: Array<{ id: string; sku: string; name: string; unit: string; shortage: number; recommendedQty: number }>; pendingPurchases: Array<{ id: string; purchaseNo: string; vendorName: string; status: string; expectedDate: string | null }> };

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false);
  async function load(refresh = false) { refresh ? setRefreshing(true) : setLoading(true); setError(""); try { setData(await api<Dashboard>("/api/dashboard")); } catch (caught) { setError((caught as Error).message); } finally { setLoading(false); setRefreshing(false); } }
  useEffect(() => { load(); }, []);
  if (loading) return <><h1 className="mb-6 text-3xl font-semibold tracking-tight">Today</h1><LoadingState label="Preparing your workspace..." /></>;
  if (error && !data) return <ErrorState message={error} retry={() => load()} />;
  if (!data) return null;

  const actions = [["leads.create", "Add Lead", "/leads", UserPlus], ["customers.create", "Add Customer", "/customers", Users], ["orders.create", "Add Order", "/orders", ClipboardCheck], ["inventory.create", "Add Inventory", "/inventory", Package], ["purchases.create", "Add Purchase", "/purchases", ShoppingBag]] as const;
  const attention = [
    ...(data.shortages ?? []).slice(0, 2).map((item) => ({ id: `sh-${item.id}`, title: `Material shortage: ${item.name}`, detail: `Short ${item.shortage} ${item.unit} · buy ~${item.recommendedQty} ${item.unit}`, href: "/inventory", severity: "critical" })),
    ...data.followUps.slice(0, 2).map((item) => ({ id: `f-${item.id}`, title: `Follow up with ${item.name}`, detail: item.phone, href: "/leads", severity: "warning" })),
    ...data.lowStock.slice(0, 2).map((item) => ({ id: `s-${item.id}`, title: `Low stock: ${item.sku} · ${item.name}`, detail: `${item.quantity} ${item.unit} remaining`, href: "/inventory", severity: "critical" })),
    ...data.pendingPurchases.slice(0, 2).map((item) => ({ id: `p-${item.id}`, title: `Receive ${item.purchaseNo}`, detail: item.vendorName, href: "/purchases", severity: "warning" })),
    ...data.highValueOrders.filter((item) => item.delayState !== "GREEN").slice(0, 2).map((item) => ({ id: `o-${item.id}`, title: `${item.orderNumber} is ${item.delayState === "RED" ? "delayed" : "at risk"}`, detail: item.customer.name, href: "/orders", severity: item.delayState === "RED" ? "critical" : "warning" })),
  ].slice(0, 7);
  const role = data.companyStatus === "OWNER" ? "Company overview" : data.companyStatus === "MANAGER" ? `${data.companyRoleName ?? "Manager"} overview` : "Your work overview";

  // ── Hero thesis: the single most important daily signal is what's slipping ──
  const delayed = data.metrics.delayedOrders;
  const atRisk = data.metrics.ordersAtRisk;
  const thesis = delayed > 0
    ? `${delayed} of your ${data.metrics.activeOrders} active orders ${delayed === 1 ? "has" : "have"} slipped past commitment — clear these first.`
    : atRisk > 0
    ? `Nothing delayed yet. ${atRisk} order${atRisk === 1 ? " is" : "s are"} at risk this week — stay ahead of them.`
    : "Every delivery commitment is on track today.";
  const supporting = [
    { label: "At risk", value: atRisk, icon: AlertTriangle },
    { label: "Active orders", value: data.metrics.activeOrders, icon: ClipboardCheck },
    { label: "Deliveries this week", value: data.metrics.deliveriesDueThisWeek, icon: Clock3 },
    { label: "Follow-ups today", value: data.metrics.followUpsDueToday, icon: PhoneCall },
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* ── State of the atelier (hero) ── */}
      <section className="relative mb-6 overflow-hidden card p-6 sm:p-8">
        <img src="/bandhani-emblem.png" alt="" aria-hidden="true" className="pointer-events-none absolute right-6 top-6 h-40 w-40 select-none object-contain opacity-[0.06]" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3"><span className="hairline-gold" /><p className="eyebrow">{role}</p></div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Today</h1>
            <div className="mt-4 flex items-end gap-4">
              <span className={`numeral text-6xl leading-[0.85] sm:text-7xl ${delayed > 0 ? "text-ink" : "text-emerald-700"}`}>{delayed}</span>
              <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">{delayed === 1 ? "order delayed" : "orders delayed"}</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-500">{thesis}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4 lg:gap-x-10">
            {supporting.map(({ label, value, icon: Icon }) => (
              <div key={label}>
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400"><Icon size={13} className="text-stone-300" />{label}</dt>
                <dd className="numeral mt-1.5 text-3xl text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative mt-7 flex items-center justify-between border-t border-stone-100 pt-4">
          <span className="text-xs text-stone-400">Last updated {new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          <button onClick={() => load(true)} disabled={refreshing} className="btn-secondary btn-sm flex items-center gap-2"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button>
        </div>
      </section>

      {error && <div className="mb-4"><ErrorState message={error} retry={() => load(true)} /></div>}

      <section className="mt-6 card overflow-hidden">
        <header className="flex items-start justify-between border-b p-5"><div><h2 className="text-lg font-semibold">Needs Attention</h2><p className="mt-1 text-sm text-stone-500">Prioritized work that may affect customers, delivery, or stock.</p></div></header>
        {attention.length ? <div className="divide-y">{attention.map((item) => <Link key={item.id} href={item.href} className="flex items-center gap-3 p-4 hover:bg-stone-50"><span className={`h-2.5 w-2.5 rounded-full ${item.severity === "critical" ? "bg-red-500" : "bg-amber-500"}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-xs text-stone-500">{item.detail}</p></div><ArrowUpRight size={15} className="text-stone-400" /></Link>)}</div> : <div className="p-5"><EmptyState icon={<ClipboardCheck size={22} />} title="All clear" message="Nothing urgent needs attention right now. New shortages, follow-ups and at-risk orders will surface here." /></div>}
        <div className="border-t bg-stone-50 px-5 py-3 text-xs text-stone-500">More detail is available in Notifications and the relevant module.</div>
      </section>

      <section className="mt-6">
        <div className="mb-3"><h2 className="text-lg font-semibold">Quick Actions</h2><p className="text-sm text-stone-500">Start the most common tasks.</p></div>
        <div className="flex flex-wrap gap-3">{actions.filter(([permission]) => data.permissions.includes(permission)).map(([permission, label, href, Icon]) => <Link key={permission} href={href} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:-translate-y-0.5 hover:border-wine/30 hover:text-wine"><Icon size={17} />{label}<Plus size={13} /></Link>)}</div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_.8fr]">
        <div className="card overflow-hidden">
          <header className="flex items-start justify-between border-b p-5"><div><h2 className="text-lg font-semibold">Recent Activity</h2><p className="mt-1 text-sm text-stone-500">Latest important changes recorded in the system.</p></div>{data.permissions.includes("audit.view") && <Link href="/audit-logs" className="text-xs font-semibold text-wine">View more</Link>}</header>
          <div className="divide-y">{data.recentAudit.slice(0, 5).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold">{item.action.replaceAll("_", " ")} · {item.entity}</p><p className="mt-1 text-xs text-stone-500">{item.user?.name ?? "System"}</p></div><span className="text-xs text-stone-400">{shortDate(item.createdAt)}</span></div>)}{!data.recentAudit.length && <div className="p-5"><EmptyState message="No recent activity is available." /></div>}</div>
        </div>
        <div className="card overflow-hidden">
          <header className="flex items-start justify-between border-b p-5"><div><h2 className="text-lg font-semibold">Production Snapshot</h2><p className="mt-1 text-sm text-stone-500">The busiest at-risk production stages.</p></div><Link href="/production" className="text-xs font-semibold text-wine">View more</Link></header>
          <div className="divide-y">{data.bottlenecks.slice(0, 4).map((item) => <div key={item.type} className="flex items-center justify-between p-4"><div><p className="text-sm font-semibold">{item.label}</p><p className="mt-1 text-xs text-stone-500">{item.red} delayed · {item.yellow} at risk</p></div><StatusBadge value={item.red ? "RED" : "YELLOW"} /></div>)}{!data.bottlenecks.length && <div className="p-5"><EmptyState message="Production is currently on track." /></div>}</div>
        </div>
      </section>
    </div>
  );
}
