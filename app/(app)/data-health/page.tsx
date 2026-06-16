"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";

type Check = { key: string; label: string; severity: "info" | "warning" | "critical"; count: number; href: string; sample: string[] };
type Data = { generatedAt: string; totalIssues: number; checks: Check[] };

const severityStyle: Record<Check["severity"], string> = {
  critical: "border-red-200 bg-red-50",
  warning: "border-amber-200 bg-amber-50",
  info: "border-stone-200 bg-stone-50",
};
const countStyle: Record<Check["severity"], string> = {
  critical: "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-stone-300 text-stone-700",
};

export default function DataHealthPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await api<Data>("/api/data-health")); }
    catch (caught) { setError((caught as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <><PageHeader title="Data Health Center" description="System integrity at a glance." /><LoadingState label="Running health checks..." rows={4} /></>;
  if (error || !data) return <><PageHeader title="Data Health Center" description="System integrity at a glance." /><ErrorState message={error || "Could not load."} retry={load} /></>;

  const flagged = data.checks.filter((c) => c.count > 0);
  const clean = data.checks.filter((c) => c.count === 0);

  return (
    <>
      <PageHeader eyebrow="Owner controls" title="Data Health Center" description="Find and fix data-integrity and operational-hygiene issues before they cause problems." />

      <div className="card mb-5 flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-stone-500">Open issues across the system</p>
          <p className="mt-1 text-3xl font-semibold">{data.totalIssues}</p>
        </div>
        <span className={`grid h-12 w-12 place-items-center rounded-2xl ${data.totalIssues === 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}><CheckCircle2 size={24} /></span>
      </div>

      {flagged.length > 0 && (
        <div className="space-y-4">
          {flagged.map((c) => (
            <section key={c.key} className={`card border ${severityStyle[c.severity]} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-sm font-bold ${countStyle[c.severity]}`}>{c.count}</span>
                  <h2 className="font-semibold">{c.label}</h2>
                </div>
                <Link href={c.href} className="btn-secondary btn-sm flex items-center gap-1">Review<ChevronRight size={14} /></Link>
              </div>
              {c.sample.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2 pl-11">
                  {c.sample.map((s, i) => <li key={i} className="rounded-md bg-white/70 px-2 py-1 text-xs text-stone-600">{s}</li>)}
                  {c.count > c.sample.length && <li className="px-2 py-1 text-xs text-stone-400">+{c.count - c.sample.length} more</li>}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {clean.length > 0 && (
        <section className="card mt-5 p-5">
          <h2 className="mb-3 font-semibold">All clear</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {clean.map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-sm text-stone-500"><CheckCircle2 size={15} className="text-emerald-500" />{c.label}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
