
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Download } from "lucide-react";
import { api, money } from "@/lib/client";

export default function Page() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    api<any>("/api/reports").then((data) => setSummary(data.summary));
  }, []);

  const cards = summary ? [
    ["Leads", summary.leads],
    ["Customers", summary.customers],
    ["Orders", summary.orders],
    ["Delayed Orders", summary.delayedOrders],
    ["Inventory Items", summary.inventoryItems],
    ["Low Stock Watch", summary.lowStock],
    ["Purchases", summary.purchases],
    ["Incentive Payable", money(summary.incentivePayable)],
  ] : [];

  return (
    <>
      <PageHeader eyebrow="Phase 2 unlocked" title="Reports" description="Permission-scoped business snapshot across CRM, orders, production, stock and finance." action={<a href="/api/export/reports" className="btn-secondary flex items-center gap-2"><Download size={16} />Export CSV</a>} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </>
  );
}
