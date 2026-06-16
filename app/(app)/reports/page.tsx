"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, Download, Search } from "lucide-react";
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

type Store = { id: string; name: string };
type StoreRow = { storeId: string; storeName: string; orders: number; orderValue: number; delayedOrders: number; leads: number; customers: number; purchasesPending: number; lowStock: number };
type EmployeeRow = { id: string; name: string; email: string; role: string; companyRoleName: string | null; storeName: string | null; activityCount: number; leadsHandled: number; conversions: number; purchasesHandled: number; inventoryMovements: number; incentiveAmount: number };

const EMPLOYEE_ROLES = ["OWNER", "PARTNER", "STORE_MANAGER", "STYLIST", "PRODUCTION_MANAGER", "QC_TEAM", "INVENTORY_TEAM", "PURCHASE_TEAM", "ACCOUNTS_TEAM"];

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Shared querystring for both data loads and the export links, so the CSV a user
// downloads always matches the filters they are looking at.
function buildFilterQuery(storeId: string, allTime: boolean, from: string, to: string) {
  const params = new URLSearchParams();
  if (storeId !== "all") params.set("storeId", storeId);
  if (!allTime) { params.set("dateFrom", from); params.set("dateTo", to); }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const ninetyAgo = new Date(today); ninetyAgo.setDate(ninetyAgo.getDate() - 90);
  const [from, setFrom] = useState(iso(ninetyAgo));
  const [to, setTo] = useState(iso(today));
  const [allTime, setAllTime] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("all");
  const [comparison, setComparison] = useState<StoreRow[] | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  // Employee performance section — reuses the page store + date filters, adds its
  // own role and (debounced) name/email search.
  const [empRows, setEmpRows] = useState<EmployeeRow[] | null>(null);
  const [empLoading, setEmpLoading] = useState(true);
  const [empRole, setEmpRole] = useState("all");
  const [empSearch, setEmpSearch] = useState("");
  const [empSearchDebounced, setEmpSearchDebounced] = useState("");

  // Only owners may pick a store; managers/employees are pinned to their own
  // store server-side, so the control is hidden for them.
  useEffect(() => {
    (async () => {
      try {
        const session = await api<{ user: { companyStatus: string; permissions: string[] } }>("/api/auth/me");
        setPermissions(session.user.permissions);
        if (session.user.companyStatus !== "OWNER") return;
        setIsOwner(true);
        const result = await api<{ stores: Store[] }>("/api/stores");
        setStores(result.stores);
      } catch { /* fall back to all-stores scope */ }
    })();
  }, []);

  function setPreset(days: number | null) {
    if (days === null) { setAllTime(true); return; }
    setAllTime(false);
    const t = new Date();
    const f = new Date(t); f.setDate(f.getDate() - days);
    setFrom(iso(f)); setTo(iso(t));
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filterQuery = buildFilterQuery(storeId, allTime, from, to);
      const store = storeId !== "all" ? `&storeId=${storeId}` : "";
      const analyticsUrl = allTime
        ? `/api/reports/analytics?all=1${store}`
        : `/api/reports/analytics?from=${from}&to=${to}${store}`;
      const wantComparison = isOwner && storeId === "all";
      const [summaryResult, analyticsResult, comparisonResult] = await Promise.all([
        api<{ summary: Summary }>(`/api/reports${filterQuery}`),
        api<Analytics>(analyticsUrl),
        wantComparison ? api<{ stores: StoreRow[] }>(`/api/reports/stores${filterQuery}`) : Promise.resolve({ stores: [] as StoreRow[] }),
      ]);
      setSummary(summaryResult.summary);
      setAnalytics(analyticsResult);
      setComparison(wantComparison ? comparisonResult.stores : null);
    } finally { setLoading(false); }
  }, [from, to, allTime, storeId, isOwner]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handle = setTimeout(() => setEmpSearchDebounced(empSearch.trim()), 300);
    return () => clearTimeout(handle);
  }, [empSearch]);

  const employeeQuery = (() => {
    const params = new URLSearchParams();
    if (storeId !== "all") params.set("storeId", storeId);
    if (!allTime) { params.set("dateFrom", from); params.set("dateTo", to); }
    if (empRole !== "all") params.set("role", empRole);
    if (empSearchDebounced) params.set("search", empSearchDebounced);
    const query = params.toString();
    return query ? `?${query}` : "";
  })();

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const result = await api<{ employees: EmployeeRow[] }>(`/api/reports/employee-performance${employeeQuery}`);
      setEmpRows(result.employees);
    } catch { setEmpRows([]); }
    finally { setEmpLoading(false); }
  }, [employeeQuery]);
  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const filterQuery = buildFilterQuery(storeId, allTime, from, to);
  const exportLinks = [
    { label: "Summary report", href: `/api/export/reports${filterQuery}`, perm: "reports.export" },
    { label: "Customers", href: `/api/export/customers${filterQuery}`, perm: "customers.view" },
    { label: "Inventory", href: `/api/export/inventory${filterQuery}`, perm: "inventory.view" },
    { label: "Purchases", href: `/api/export/purchases${filterQuery}`, perm: "purchases.view" },
  ].filter((link) => permissions.includes(link.perm));

  const cards = summary ? [
    ["Leads", summary.leads], ["Customers", summary.customers], ["Orders", summary.orders], ["Delayed Orders", summary.delayedOrders],
    ["Inventory Items", summary.inventoryItems], ["Low Stock Watch", summary.lowStock], ["Purchases", summary.purchases], ["Incentive Payable", money(summary.incentivePayable)],
  ] as const : [];
  const maxRevenue = analytics?.sales.byMonth.reduce((m, r) => Math.max(m, r.revenue), 0) ?? 0;

  const daysAgoIso = (days: number) => iso(new Date(new Date().setDate(new Date().getDate() - days)));
  const presets: Array<[string, number]> = [["30d", 30], ["90d", 90], ["1y", 365]];
  const activeDays = allTime ? null : presets.find(([, days]) => daysAgoIso(days) === from)?.[1] ?? null;
  const segClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-white text-ink shadow-sm" : "text-stone-500 hover:text-ink"}`;

  return (
    <>
      <PageHeader eyebrow="Business intelligence" title="Reports & Analytics" description="Sales trends, lead conversion, and team performance across CRM, orders, production, stock and finance." action={exportLinks.length > 0 && (
        <div className="relative">
          <button type="button" onClick={() => setExportOpen((v) => !v)} className="btn-secondary flex items-center gap-2"><Download size={16} />Export CSV<ChevronDown size={14} className={`transition ${exportOpen ? "rotate-180" : ""}`} /></button>
          {exportOpen && (
            <>
              <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                <p className="px-4 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Using current filters</p>
                {exportLinks.map((link) => <a key={link.label} href={link.href} onClick={() => setExportOpen(false)} className="block px-4 py-2 text-sm hover:bg-stone-50">{link.label}</a>)}
              </div>
            </>
          )}
        </div>
      )} />

      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          {isOwner && (
            <div className="w-44">
              <label>Store</label>
              <select className="h-10" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="all">All Stores</option>
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            </div>
          )}
          <div className={`w-40 ${allTime ? "opacity-40 pointer-events-none" : ""}`}>
            <label>From</label><input className="h-10" type="date" value={from} max={to} onChange={(e) => { setAllTime(false); setFrom(e.target.value); }} />
          </div>
          <div className={`w-40 ${allTime ? "opacity-40 pointer-events-none" : ""}`}>
            <label>To</label><input className="h-10" type="date" value={to} min={from} onChange={(e) => { setAllTime(false); setTo(e.target.value); }} />
          </div>
          <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1">
            {presets.map(([label, days]) => (
              <button key={label} type="button" onClick={() => setPreset(days)} className={segClass(activeDays === days)}>{label}</button>
            ))}
            <button type="button" onClick={() => setPreset(null)} className={`flex items-center gap-1.5 ${segClass(allTime)}`}><CalendarDays size={12} />All time</button>
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-400">Filters apply to the snapshot tiles and analytics below. Inventory tiles always reflect current stock.</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5"><p className="text-xs font-bold uppercase tracking-wide text-stone-400">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>
        ))}
      </div>

      {comparison && comparison.length > 0 && (
        <section className="card mb-6 p-5">
          <h2 className="font-semibold">Store comparison</h2>
          <p className="text-xs text-stone-500">Key metrics per store for the selected date range. Low stock reflects current inventory.</p>
          <div className="mt-4 table-wrap"><table><thead><tr>
            <th>Store</th><th className="text-right">Orders</th><th className="text-right">Order value</th><th className="text-right">Delayed</th><th className="text-right">Leads</th><th className="text-right">Customers</th><th className="text-right">Pending POs</th><th className="text-right">Low stock</th>
          </tr></thead><tbody>
            {comparison.map((row) => (
              <tr key={row.storeId}>
                <td className="font-medium">{row.storeName}</td>
                <td className="text-right">{row.orders}</td>
                <td className="text-right">{money(row.orderValue)}</td>
                <td className="text-right">{row.delayedOrders > 0 ? <span className="font-semibold text-wine">{row.delayedOrders}</span> : 0}</td>
                <td className="text-right">{row.leads}</td>
                <td className="text-right">{row.customers}</td>
                <td className="text-right">{row.purchasesPending}</td>
                <td className="text-right">{row.lowStock > 0 ? <span className="font-semibold text-amber-700">{row.lowStock}</span> : 0}</td>
              </tr>
            ))}
          </tbody></table></div>
        </section>
      )}

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

      {/* Employee performance */}
      <section className="card mt-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Employee performance</h2>
            <p className="text-xs text-stone-500">Real activity attributed to each team member within the selected store and date range.</p>
          </div>
          {permissions.includes("reports.export") && (
            <a href={`/api/export/employee-performance${employeeQuery}`} className="btn-secondary flex shrink-0 items-center gap-2"><Download size={16} />Export CSV</a>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="w-48">
            <label>Role</label>
            <select className="h-10" value={empRole} onChange={(e) => setEmpRole(e.target.value)}>
              <option value="all">All roles</option>
              {EMPLOYEE_ROLES.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label>Search</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input className="h-10 pl-9" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} placeholder="Search name or email" />
            </div>
          </div>
        </div>

        {empLoading ? <div className="mt-4"><LoadingState label="Loading team activity..." rows={2} /></div> : empRows && empRows.length > 0 ? (
          <div className="mt-4 table-wrap"><table><thead><tr>
            <th>Employee</th><th>Role</th><th>Store</th><th className="text-right">Activity</th><th className="text-right">Leads</th><th className="text-right">Conv.</th><th className="text-right">Purchases</th><th className="text-right">Stock moves</th><th className="text-right">Incentives</th>
          </tr></thead><tbody>
            {empRows.map((e) => (
              <tr key={e.id}>
                <td><Link href={`/employees/${e.id}`} className="font-medium text-wine hover:underline">{e.name}</Link><p className="text-xs text-stone-400">{e.email}</p></td>
                <td>{e.companyRoleName ?? e.role.replaceAll("_", " ")}</td>
                <td>{e.storeName ?? "All / unassigned"}</td>
                <td className="text-right">{e.activityCount}</td>
                <td className="text-right">{e.leadsHandled}</td>
                <td className="text-right">{e.conversions}</td>
                <td className="text-right">{e.purchasesHandled}</td>
                <td className="text-right">{e.inventoryMovements}</td>
                <td className="text-right">{money(e.incentiveAmount)}</td>
              </tr>
            ))}
          </tbody></table></div>
        ) : <p className="mt-4 text-sm text-stone-400">No employees match these filters.</p>}
      </section>
    </>
  );
}
