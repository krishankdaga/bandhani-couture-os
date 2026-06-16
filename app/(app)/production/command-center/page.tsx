"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Factory, Layers, PackageX, ShieldAlert, Users } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { api, money, shortDate } from "@/lib/client";

type OrderRow = {
  id: string; orderNumber: string; customer: { id: string; name: string } | null; stylist: { name: string } | null;
  priority: string; orderValue: string; deliveryDate: string; status: string; delayState: string;
  completedStages: number; totalStages: number; blocked: boolean;
  currentStage: { label: string; owner: string | null; delayState: string } | null;
  materials: { lines: number; requiredQty: number; consumedQty: number };
};
type Bottleneck = { type: string; label: string; count: number; red: number; yellow: number };
type Capacity = { name: string; open: number; red: number };
type Shortage = { id: string; sku: string; name: string; unit: string; shortage: number; recommendedQty: number };
type Data = {
  generatedAt: string;
  metrics: { activeOrders: number; delayed: number; atRisk: number; blocked: number; dueThisWeek: number; shortages: number };
  highRisk: OrderRow[]; dueThisWeek: OrderRow[]; bottlenecks: Bottleneck[]; capacity: Capacity[]; shortages: Shortage[]; canViewInventory: boolean;
};

function OrderList({ rows, empty }: { rows: OrderRow[]; empty: string }) {
  if (!rows.length) return <p className="px-5 py-6 text-sm text-stone-400">{empty}</p>;
  return (
    <div className="divide-y divide-stone-100">
      {rows.map((o) => (
        <Link key={o.id} href={`/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-wine">{o.orderNumber} <span className="font-normal text-stone-500">· {o.customer?.name ?? "—"}</span></p>
            <p className="text-xs text-stone-500">{o.currentStage ? `${o.currentStage.label}${o.currentStage.owner ? ` · ${o.currentStage.owner}` : ""}` : "All stages complete"} · {o.completedStages}/{o.totalStages} stages · due {shortDate(o.deliveryDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            {o.blocked && <span className="badge bg-red-100 text-red-700">BLOCKED</span>}
            {o.priority !== "NORMAL" && <span className="badge bg-stone-100 text-stone-600">{o.priority}</span>}
            <span className="hidden text-xs text-stone-500 sm:inline">{money(o.orderValue)}</span>
            <StatusBadge value={o.delayState} dot />
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function CommandCenterPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await api<Data>("/api/production/command-center")); }
    catch (caught) { setError((caught as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <><PageHeader title="Production Command Center" description="Everything that needs attention, in one view." /><LoadingState label="Loading command center..." rows={4} /></>;
  if (error || !data) return <><PageHeader title="Production Command Center" description="Everything that needs attention, in one view." /><ErrorState message={error || "Could not load."} retry={load} /></>;

  const m = data.metrics;
  return (
    <>
      <PageHeader eyebrow="Operations" title="Production Command Center" description="Active workload, delays, bottlenecks, team capacity and material shortages at a glance." />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Active orders" value={m.activeOrders} icon={Factory} hint="In confirmed, production or ready" />
        <StatCard label="Delayed" value={m.delayed} tone={m.delayed > 0 ? "danger" : "default"} icon={ShieldAlert} hint="Red — past commitment" />
        <StatCard label="At risk" value={m.atRisk} tone={m.atRisk > 0 ? "warning" : "default"} icon={AlertTriangle} hint="Yellow — due soon or recovered" />
        <StatCard label="Blocked stages" value={m.blocked} tone={m.blocked > 0 ? "warning" : "default"} icon={Layers} hint="Stages marked blocked" />
        <StatCard label="Due this week" value={m.dueThisWeek} icon={Factory} hint="Delivery within 7 days" />
        <StatCard label="Material shortages" value={m.shortages} tone={m.shortages > 0 ? "danger" : "default"} icon={PackageX} hint="Items short of reservations" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-stone-100 p-5"><h2 className="font-semibold">High-risk orders</h2><p className="text-xs text-stone-500">Delayed, at-risk or blocked — act on these first.</p></div>
          <OrderList rows={data.highRisk} empty="No orders are at risk. Production is on track." />
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-stone-100 p-5"><h2 className="font-semibold">Delivering this week</h2><p className="text-xs text-stone-500">Orders with delivery commitments in the next 7 days.</p></div>
          <OrderList rows={data.dueThisWeek} empty="No deliveries due this week." />
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-stone-100 p-5"><h2 className="font-semibold">Stage bottlenecks</h2><p className="text-xs text-stone-500">Where delayed work is concentrated.</p></div>
          {data.bottlenecks.length ? (
            <div className="divide-y divide-stone-100">
              {data.bottlenecks.map((b) => (
                <div key={b.type} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm font-medium">{b.label}</p>
                  <div className="flex items-center gap-2 text-xs">
                    {b.red > 0 && <span className="badge bg-red-100 text-red-700">{b.red} delayed</span>}
                    {b.yellow > 0 && <span className="badge bg-amber-100 text-amber-700">{b.yellow} at risk</span>}
                    <span className="text-stone-400">{b.count} open</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="px-5 py-6 text-sm text-stone-400">No bottlenecks — all open stages are on track.</p>}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-stone-100 p-5"><Users size={16} className="text-stone-500" /><div><h2 className="font-semibold">Team capacity</h2><p className="text-xs text-stone-500">Open stages assigned per team member.</p></div></div>
          {data.capacity.length ? (
            <div className="divide-y divide-stone-100">
              {data.capacity.map((c) => (
                <div key={c.name} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm font-medium">{c.name}</p>
                  <div className="flex items-center gap-3">
                    {c.red > 0 && <span className="badge bg-red-100 text-red-700">{c.red} delayed</span>}
                    <span className="text-sm font-semibold">{c.open} open</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="px-5 py-6 text-sm text-stone-400">No stages are currently assigned to internal team members.</p>}
        </section>
      </div>

      {data.canViewInventory && (
        <section className="card mt-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 p-5">
            <div className="flex items-center gap-2"><PackageX size={16} className="text-amber-600" /><div><h2 className="font-semibold">Material shortage alerts</h2><p className="text-xs text-stone-500">Reserved demand exceeds stock on hand.</p></div></div>
            <Link href="/inventory" className="btn-secondary btn-sm">Open inventory</Link>
          </div>
          {data.shortages.length ? (
            <div className="divide-y divide-stone-100">
              {data.shortages.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div><p className="text-sm font-semibold">{s.name} <span className="font-normal text-stone-400">{s.sku}</span></p><p className="text-xs text-amber-700">Short {s.shortage} {s.unit}</p></div>
                  <span className="text-xs text-stone-500">Buy ~{s.recommendedQty} {s.unit}</span>
                </div>
              ))}
            </div>
          ) : <p className="px-5 py-6 text-sm text-stone-400">No material shortages. Stock covers all reservations.</p>}
        </section>
      )}
    </>
  );
}
