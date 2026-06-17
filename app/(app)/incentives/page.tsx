"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/async-state";
import { Hint } from "@/components/ui";
import { useConfirm } from "@/components/confirm-dialog";
import { api, money, shortDate, toast } from "@/lib/client";

type Stat = { count: number; amount: number };
type IncentiveRecord = { id: string; orderId: string | null; orderNumber: string | null; amount: number; status: string; notes: string | null; createdAt: string };
type Employee = { id: string; name: string; role: string; store: string | null; incentiveAmount: number | null; totals: Record<string, Stat>; incentives: IncentiveRecord[] };
type Data = { employees: Employee[]; canManage: boolean };

export default function IncentivesPage() {
  const { confirm } = useConfirm();
  const [data, setData] = useState<Data>({ employees: [], canManage: false });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setData(await api<Data>("/api/incentives")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try { await api(`/api/incentives/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); toast(`Incentive marked ${status.toLowerCase()}.`); await load(); }
    catch (caught) { toast((caught as Error).message, "error"); } finally { setBusyId(null); }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Delete incentive?", message: "This permanently removes the incentive record. This cannot be undone.", confirmLabel: "Delete", tone: "danger" }))) return;
    setBusyId(id);
    try { await api(`/api/incentives/${id}`, { method: "DELETE" }); toast("Incentive deleted."); await load(); }
    catch (caught) { toast((caught as Error).message, "error"); } finally { setBusyId(null); }
  }

  return (
    <>
      <PageHeader eyebrow="Payments" title="Incentives" description="Incentives are earned automatically when an employee's order is delivered to the customer on time." />
      <Hint title="How incentives work">
        Set a fixed incentive amount on an employee&apos;s profile. When one of their orders ships to the customer on or before its delivery date, a pending incentive is created here for you to approve and mark paid. Employees without an incentive amount aren&apos;t shown.
      </Hint>

      {loading ? (
        <div className="card p-8 text-center text-sm text-stone-500">Loading incentives…</div>
      ) : data.employees.length === 0 ? (
        <EmptyState
          icon={<Coins size={22} />}
          title="No employees set up for incentives"
          message="Open an employee's profile and set their incentive per on-time order to make them eligible."
        />
      ) : (
        <div className="space-y-5">
          {data.employees.map((employee) => (
            <section key={employee.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 p-5">
                <div>
                  <Link href={`/employees/${employee.id}`} className="font-semibold text-wine hover:underline">{employee.name}</Link>
                  <p className="mt-0.5 text-xs text-stone-500">{employee.role.replaceAll("_", " ")}{employee.store ? ` · ${employee.store}` : ""}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    {employee.incentiveAmount != null
                      ? <>Earns <span className="font-semibold text-ink">{money(employee.incentiveAmount)}</span> per on-time delivery.</>
                      : "No incentive configured — only historical records shown."}
                  </p>
                </div>
                <div className="flex gap-6 text-right">
                  {(["PENDING", "APPROVED", "PAID"] as const).map((status) => (
                    <div key={status}>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{status}</p>
                      <p className="numeral mt-1 text-lg">{money(employee.totals[status]?.amount ?? 0)}</p>
                      <p className="text-[11px] text-stone-400">{employee.totals[status]?.count ?? 0} {(employee.totals[status]?.count ?? 0) === 1 ? "entry" : "entries"}</p>
                    </div>
                  ))}
                </div>
              </div>

              {employee.incentives.length === 0 ? (
                <p className="p-5 text-sm text-stone-400">No incentives earned yet. One is created when an order ships on time.</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {employee.incentives.map((record) => (
                    <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {money(record.amount)}
                          {record.orderId && record.orderNumber && <Link href={`/orders/${record.orderId}`} className="ml-2 text-xs font-medium text-accent-deep hover:underline">{record.orderNumber}</Link>}
                        </p>
                        <p className="text-xs text-stone-500">{shortDate(record.createdAt)}{record.notes ? ` · ${record.notes}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge value={record.status} />
                        {data.canManage && (
                          <>
                            {record.status === "PENDING" && <button disabled={busyId === record.id} onClick={() => setStatus(record.id, "APPROVED")} className="btn-secondary btn-sm">Approve</button>}
                            {record.status === "APPROVED" && <button disabled={busyId === record.id} onClick={() => setStatus(record.id, "PAID")} className="btn-primary btn-sm">Mark paid</button>}
                            <button disabled={busyId === record.id} onClick={() => remove(record.id)} className="btn-danger btn-sm">Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
