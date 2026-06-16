"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { api, money } from "@/lib/client";

type Summary = { leads: number; customers: number; orders: number; delayedOrders: number; inventoryItems: number; lowStock: number; purchases: number; incentivePayable: number };
type Analytics = {
  range: { from: string; to: string };
  sales: { totalRevenue: number; totalCollected: number; outstanding: number; orderCount: number; cancelledCount: number; averageOrderValue: number; byMonth: Array<{ month: string; revenue: number; orders: number }> };
  leads: { total: number; converted: number; lost: number; conversionRate: number; bySource: Array<{ source: string; total: number; converted: number; rate: number }> };
  employees: Array<{ id: string; name: string; role: string; leads: number; conversions: number; conversionRate: number; sales: number; salesValue: number; stagesCompleted: number; delaysCaused: number }>;
  inventory: { stockValue: number; shortageItems: number; itemCount: number };
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const ninetyAgo = new Date(today); ninetyAgo.setDate(ninetyAgo.getDate() - 90);
  const [from, setFrom] = useState(iso(ninetyAgo));
  const [to, setTo] = useState(iso(today));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResult, analyticsResult] = await Promise.all([
        api<{ summary: Summary }>("/api/reports"),
        api<Analytics>(`/api/reports/analytics?from=${from}&to=${to}`),
      ]);
      setSummary(summaryResult.summary);
      setAnalytics(analyticsResult);
    } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const cards = summary ? [
    ["Leads", summary.leads], ["Customers", summary.customers], ["Orders", summary.orders], ["Delayed Orders", summary.delayedOrders],
    ["Inventory Items", summary.inventoryItems], ["Low Stock Watch", summary.lowStock], ["Purchases", summary.purchases], ["Incentive Payable", money(summary.incentivePayable)],
  ] as const : [];
  const maxRevenue = analytics?.sales.byMonth.reduce((m, r) => Math.max(m, r.revenue), 0) ?? 0;

  return (
    <>
      <PageHeader eyebrow="Business intelligence" title="Reports & Analytics" description="Sales trends, lead conversion, and team performance across CRM, orders, production, stock and finance." action={<a href="/api/export/reports" className="btn-secondary flex items-center gap-2"><Download size={16} />Export CSV</a>} />

      <div className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div><label>From</label><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label>To</label><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
        <p className="ml-auto text-xs text-stone-500">Date range applies to the analytics below. The snapshot tiles are all-time.</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5"><p className="text-xs font-bold uppercase tracking-wide text-stone-400">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>
        ))}
      </div>

      {loading ? <LoadingState label="Crunching analytics..." rows={3} /> : analytics && <>
        {/* Sales */}
        <section className="card mb-5 p-5">
          <h2 className="font-semibold">Sales</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div><p className="text-xs text-stone-400">Revenue booked</p><p className="mt-1 text-2xl font-semibold">{money(analytics.sales.totalRevenue)}</p></div>
            <div><p className="text-xs text-stone-400">Collected</p><p className="mt-1 text-2xl font-semibold text-emerald-700">{money(analytics.sales.totalCollected)}</p></div>
            <div><p className="text-xs text-stone-400">Outstanding</p><p className={`mt-1 text-2xl font-semibold ${analytics.sales.outstanding > 0 ? "text-wine" : "text-emerald-700"}`}>{money(analytics.sales.outstanding)}</p></div>
            <div><p className="text-xs text-stone-400">Avg order value</p><p className="mt-1 text-2xl font-semibold">{money(analytics.sales.averageOrderValue)}</p></div>
          </div>
          {analytics.sales.byMonth.length > 0 && (
            <div className="mt-5 space-y-2">
              {analytics.sales.byMonth.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-stone-500">{m.month}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-stone-100"><div className="h-full rounded bg-gradient-to-r from-wine to-wine-dark" style={{ width: `${maxRevenue ? (m.revenue / maxRevenue) * 100 : 0}%` }} /></div>
                  <span className="w-28 text-right text-xs font-medium">{money(m.revenue)}</span>
                  <span className="w-16 text-right text-xs text-stone-400">{m.orders} ord.</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Lead conversion */}
        <section className="card mb-5 p-5">
          <h2 className="font-semibold">Lead conversion</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><p className="text-xs text-stone-400">Leads in range</p><p className="mt-1 text-2xl font-semibold">{analytics.leads.total}</p></div>
            <div><p className="text-xs text-stone-400">Converted</p><p className="mt-1 text-2xl font-semibold text-emerald-700">{analytics.leads.converted}</p></div>
            <div><p className="text-xs text-stone-400">Conversion rate</p><p className="mt-1 text-2xl font-semibold">{analytics.leads.conversionRate}%</p></div>
          </div>
          {analytics.leads.bySource.length > 0 && (
            <div className="mt-5 table-wrap"><table><thead><tr><th>Source</th><th>Leads</th><th>Converted</th><th>Rate</th></tr></thead><tbody>
              {analytics.leads.bySource.map((s) => <tr key={s.source}><td>{s.source.replaceAll("_", " ")}</td><td>{s.total}</td><td>{s.converted}</td><td>{s.rate}%</td></tr>)}
            </tbody></table></div>
          )}
        </section>

        {/* Employee performance */}
        <section className="card mb-5 p-5">
          <h2 className="font-semibold">Employee performance</h2>
          <p className="text-xs text-stone-500">Leads, conversions and sales (stylists) plus production throughput, within the selected range.</p>
          {analytics.employees.length > 0 ? (
            <div className="mt-4 table-wrap"><table><thead><tr><th>Team member</th><th>Leads</th><th>Conv.</th><th>Rate</th><th>Orders</th><th>Sales value</th><th>Stages done</th><th>Delays</th></tr></thead><tbody>
              {analytics.employees.map((e) => <tr key={e.id}><td>{e.name}<p className="text-xs text-stone-400">{e.role.replaceAll("_", " ")}</p></td><td>{e.leads}</td><td>{e.conversions}</td><td>{e.conversionRate}%</td><td>{e.sales}</td><td>{money(e.salesValue)}</td><td>{e.stagesCompleted}</td><td>{e.delaysCaused > 0 ? <span className="text-red-600">{e.delaysCaused}</span> : 0}</td></tr>)}
            </tbody></table></div>
          ) : <p className="mt-4 text-sm text-stone-400">No employee activity in this range.</p>}
        </section>

        {/* Inventory valuation */}
        <section className="card p-5">
          <h2 className="font-semibold">Inventory</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><p className="text-xs text-stone-400">Stock value (at cost)</p><p className="mt-1 text-2xl font-semibold">{money(analytics.inventory.stockValue)}</p></div>
            <div><p className="text-xs text-stone-400">Items tracked</p><p className="mt-1 text-2xl font-semibold">{analytics.inventory.itemCount}</p></div>
            <div><p className="text-xs text-stone-400">Items short</p><p className={`mt-1 text-2xl font-semibold ${analytics.inventory.shortageItems > 0 ? "text-amber-700" : "text-emerald-700"}`}>{analytics.inventory.shortageItems}</p></div>
          </div>
        </section>
      </>}
    </>
  );
}
