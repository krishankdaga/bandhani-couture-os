"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Coins, Mail, Save, ShieldCheck, Store } from "lucide-react";
import { AccessDenied } from "@/components/access-denied";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api, money, shortDate, toast } from "@/lib/client";
import { PERMISSION_GROUPS } from "@/lib/permissions";

type Profile = {
  id: string; name: string; email: string; image: string | null;
  companyStatus: string; role: string; companyRoleName: string | null;
  store: { id: string; name: string } | null; active: boolean; createdAt: string; permissions: string[];
  incentiveAmount: number | null;
};
type AuditEntry = { id: string; action: string; entity: string; entityId: string; createdAt: string };
type IncentiveStat = { count: number; amount: number };
type Metrics = {
  crm: { leadsHandled: number; leadsConverted: number; customersCreated: number | null };
  incentives: { pending: IncentiveStat; approved: IncentiveStat; paid: IncentiveStat };
  operations: { stockMovements: number; purchasesCreated: number | null; purchasesReceived: number | null };
  production: { stagesAssigned: number; stagesCompleted: number };
};
type ProfileResponse = { profile: Profile; recentAudit: AuditEntry[]; metrics: Metrics; canManageIncentive: boolean };

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      {value === null
        ? <p className="mt-2 text-sm font-medium text-stone-400">Not tracked yet</p>
        : <p className="mt-1.5 text-2xl font-semibold">{value}</p>}
    </div>
  );
}

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [incInput, setIncInput] = useState("");
  const [savingInc, setSavingInc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await api<ProfileResponse>(`/api/employees/${id}/profile`)); }
    catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (data?.profile) setIncInput(data.profile.incentiveAmount != null ? String(data.profile.incentiveAmount) : ""); }, [data]);

  async function saveIncentive() {
    setSavingInc(true);
    try {
      const result = await api<{ incentiveAmount: number | null }>(`/api/employees/${id}/incentive`, { method: "PATCH", body: JSON.stringify({ incentiveAmount: incInput.trim() === "" ? null : Number(incInput) }) });
      toast(result.incentiveAmount != null ? "Incentive updated." : "Incentive cleared.");
      await load();
    } catch (caught) { toast((caught as Error).message, "error"); } finally { setSavingInc(false); }
  }

  const profile = data?.profile;
  const granted = new Set(profile?.permissions ?? []);
  // The profile API is the source of truth for access; a 403 surfaces here as a
  // permission/store-scope message, which we render as Access Denied rather than
  // a generic (retryable) error.
  const denied = /permission|within your store/i.test(error);

  return (
    <>
      <PageHeader eyebrow="Team" title={profile?.name ?? "Employee profile"} description={profile?.email} action={<Link href="/employees" className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} />Back to employees</Link>} />

      {loading ? <LoadingState label="Loading profile..." /> : denied ? <AccessDenied /> : error ? <ErrorState message={error} retry={() => load()} /> : profile && data && (
        <div className="space-y-5">
        <section className="card p-6">
          <h2 className="font-semibold">Performance</h2>
          <p className="text-xs text-stone-500">Activity attributable to this team member from current records. Metrics without schema support are marked &ldquo;Not tracked yet&rdquo;.</p>

          <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-stone-400">Leads &amp; CRM</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Metric label="Leads handled" value={data.metrics.crm.leadsHandled} />
            <Metric label="Leads converted" value={data.metrics.crm.leadsConverted} />
            <Metric label="Customers created" value={data.metrics.crm.customersCreated} />
          </div>

          <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-stone-400">Inventory &amp; Purchases</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Metric label="Stock movements" value={data.metrics.operations.stockMovements} />
            <Metric label="Purchases created" value={data.metrics.operations.purchasesCreated} />
            <Metric label="Purchases received" value={data.metrics.operations.purchasesReceived} />
          </div>

          <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-stone-400">Production</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Metric label="Stages assigned" value={data.metrics.production.stagesAssigned} />
            <Metric label="Stages completed" value={data.metrics.production.stagesCompleted} />
          </div>

          <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-stone-400">Incentives</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {([["Pending", data.metrics.incentives.pending], ["Approved", data.metrics.incentives.approved], ["Paid", data.metrics.incentives.paid]] as const).map(([label, stat]) => (
              <div key={label} className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
                <p className="mt-1.5 text-2xl font-semibold">{money(stat.amount)}</p>
                <p className="mt-0.5 text-xs text-stone-400">{stat.count} {stat.count === 1 ? "entry" : "entries"}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
          <div className="space-y-5">
          <section className="card h-fit p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-wine/10 text-lg font-semibold text-wine">{profile.name.slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{profile.name}</h2>
                <p className="flex items-center gap-1.5 truncate text-sm text-stone-500"><Mail size={14} />{profile.email}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge value={profile.companyStatus} />
              <StatusBadge value={profile.active ? "ACTIVE" : "INACTIVE"} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-5 text-sm">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Role</dt><dd className="mt-1 font-medium">{profile.companyRoleName ?? profile.role.replaceAll("_", " ")}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Store</dt><dd className="mt-1 flex items-center gap-1.5 font-medium"><Store size={14} className="text-stone-400" />{profile.store?.name ?? "All / unassigned"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Legacy role</dt><dd className="mt-1 font-medium">{profile.role.replaceAll("_", " ")}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Joined</dt><dd className="mt-1 font-medium">{shortDate(profile.createdAt)}</dd></div>
            </dl>
          </section>

          {data.canManageIncentive && (
            <section className="card h-fit p-6">
              <h2 className="flex items-center gap-2 font-semibold"><Coins size={18} className="text-wine" />Incentive</h2>
              <p className="mt-1 text-xs text-stone-500">A fixed amount this employee earns each time one of their orders is delivered to the customer on time. Leave blank if they don&apos;t receive an incentive.</p>
              <div className="mt-4 flex items-end gap-2">
                <div className="flex-1"><label>Incentive per on-time order (₹)</label><input type="number" min="0" step="1" value={incInput} onChange={(e) => setIncInput(e.target.value)} placeholder="e.g. 1000" /></div>
                <button onClick={saveIncentive} disabled={savingInc} className="btn-primary flex items-center gap-2"><Save size={15} />{savingInc ? "Saving..." : "Save"}</button>
              </div>
              {profile.incentiveAmount != null
                ? <p className="mt-2 text-xs text-emerald-700">Currently {money(profile.incentiveAmount)} per on-time delivery.</p>
                : <p className="mt-2 text-xs text-stone-400">No incentive configured — this employee is not eligible.</p>}
            </section>
          )}
          </div>

          <div className="grid gap-5">
            <section className="card p-6">
              <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-wine" />Permissions summary</h2>
              <p className="text-xs text-stone-500">Effective access after role and per-employee overrides.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PERMISSION_GROUPS.map((group) => {
                  const allowed = group.permissions.filter((permission) => granted.has(permission));
                  return (
                    <div key={group.module} className={`rounded-xl border p-3 ${allowed.length ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{group.module}</span>
                        <span className="text-xs text-stone-400">{allowed.length}/{group.permissions.length}</span>
                      </div>
                      {allowed.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {allowed.map((permission) => <span key={permission} className="rounded-md bg-wine/10 px-2 py-0.5 text-[11px] font-medium text-wine">{permission.split(".")[1]}</span>)}
                        </div>
                      ) : <p className="mt-2 text-[11px] text-stone-400">No access</p>}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card p-6">
              <h2 className="font-semibold">Recent activity</h2>
              <p className="text-xs text-stone-500">The latest actions recorded for this team member.</p>
              {data && data.recentAudit.length > 0 ? (
                <div className="mt-4 divide-y divide-stone-100">
                  {data.recentAudit.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                      <p className="text-sm font-medium">{entry.action.replaceAll("_", " ")} · <span className="text-stone-500">{entry.entity}</span></p>
                      <span className="shrink-0 text-xs text-stone-400">{shortDate(entry.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="mt-4"><EmptyState message="No recorded activity yet." /></div>}
            </section>
          </div>
        </div>
        </div>
      )}
    </>
  );
}
