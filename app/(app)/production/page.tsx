"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronRight, Clock3, Factory, UserRound } from "lucide-react";
import { EmptyState, ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api, shortDate } from "@/lib/client";

type Pardon = { id: string; status: string; reason: string; requestedBy: { name: string } };
type Stage = {
  id: string; type: string; sequence: number; ownerId: string | null; owner: { name: string } | null;
  vendorName: string | null; startDate: string | null; dueDate: string; completionDate: string | null;
  status: string; remarks: string | null; delayState: string; pardons: Pardon[];
};
type Order = {
  id: string; orderNumber: string; customer: { id: string; name: string; phone: string }; deliveryDate: string;
  delayState: string; status: string; stages: Stage[];
};
type User = { id: string; name: string; role: string };
type SessionUser = User & { companyStatus: string; permissions: string[] };

const stageLabels: Record<string, string> = {
  DYEING_PATTERN_CUTTING: "Dyeing & Pattern Cutting", EMBROIDERY: "Embroidery", STITCHING: "Stitching",
  QC: "Quality Check", STYLIST_QC: "Stylist QC", DELIVERY: "Delivery",
};
const statusOptions = [
  { value: "NOT_STARTED", label: "Not started" }, { value: "IN_PROGRESS", label: "In progress" },
  { value: "BLOCKED", label: "Blocked" }, { value: "COMPLETED", label: "Completed" },
];
// Delay states are stored as colours internally but always shown by their meaning.
const delayLabels: Record<string, string> = { GREEN: "On track", YELLOW: "At risk", RED: "Delayed" };

export default function ProductionPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [stageId, setStageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingId, setSavingId] = useState("");
  const [reviewingId, setReviewingId] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [pardonReason, setPardonReason] = useState("");
  const [search, setSearch] = useState(""); const [delayFilter, setDelayFilter] = useState("ALL"); const [statusFilter, setStatusFilter] = useState("ALL"); const [dueFilter, setDueFilter] = useState("ALL");

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const [orderResult, metaResult, sessionResult] = await Promise.all([
        api<{ orders: Order[] }>("/api/orders"), api<{ users: User[] }>("/api/meta"), api<{ user: SessionUser }>("/api/auth/me"),
      ]);
      setOrders(orderResult.orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.status)));
      setUsers(metaResult.users);
      setSessionUser(sessionResult.user);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredOrders = useMemo(() => { const now=new Date(),today=new Date(now);today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);const week=new Date(today);week.setDate(week.getDate()+7);return orders.filter((order)=>order.stages.some((stage)=>{const text=`${order.orderNumber} ${order.customer.name} ${stageLabels[stage.type]} ${stage.owner?.name??""} ${stage.vendorName??""}`.toLowerCase();const due=new Date(stage.dueDate);const dueMatch=dueFilter==="ALL"||(dueFilter==="TODAY"&&due>=today&&due<tomorrow)||(dueFilter==="OVERDUE"&&due<today&&stage.status!=="COMPLETED")||(dueFilter==="WEEK"&&due>=today&&due<=week);return text.includes(search.toLowerCase())&&(delayFilter==="ALL"&&(true)||stage.delayState===delayFilter)&&(statusFilter==="ALL"||stage.status===statusFilter)&&dueMatch;}));},[orders,search,delayFilter,statusFilter,dueFilter]);
  const customers = useMemo(() => {
    const unique = new Map<string, Order["customer"]>();
    filteredOrders.forEach((order) => unique.set(order.customer.id, order.customer));
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredOrders]);
  const customerOrders = filteredOrders.filter((order) => order.customer.id === customerId);
  const selectedOrder = customerOrders.find((order) => order.id === orderId) ?? null;
  const selectedStage = selectedOrder?.stages.find((stage) => stage.id === stageId) ?? null;
  const completedStages = selectedOrder?.stages.filter((stage) => stage.status === "COMPLETED").length ?? 0;
  const canEdit = sessionUser?.permissions.includes("production.edit") ?? false;
  const canRecalculate = canEdit;
  function clearFilters(){setSearch("");setDelayFilter("ALL");setStatusFilter("ALL");setDueFilter("ALL");}

  function chooseCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId); setOrderId(""); setStageId(""); setError(""); setSuccess("");
  }
  function chooseOrder(nextOrderId: string) {
    const order = orders.find((item) => item.id === nextOrderId);
    setOrderId(nextOrderId); setStageId(order?.stages[0]?.id ?? ""); setError(""); setSuccess("");
  }

  async function saveStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStage) return;
    setSavingId(selectedStage.id); setError(""); setSuccess("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`/api/stages/${selectedStage.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...values,
          ownerId: values.ownerId || null,
          vendorName: values.vendorName || null,
          startDate: values.startDate || null,
          remarks: values.remarks || null,
        }),
      });
      await load(false);
      setSuccess(`${stageLabels[selectedStage.type]} was updated.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSavingId("");
    }
  }

  async function requestPardon() {
    if (!selectedStage || pardonReason.trim().length < 10) {
      setError("Enter an external delay reason of at least 10 characters.");
      return;
    }
    setSavingId(selectedStage.id); setError(""); setSuccess("");
    try {
      await api("/api/pardons", { method: "POST", body: JSON.stringify({ stageId: selectedStage.id, reason: pardonReason.trim() }) });
      setPardonReason(""); await load(false); setSuccess("Pardon request sent to the Owner for review.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSavingId("");
    }
  }

  async function reviewPardon(id: string, status: "APPROVED" | "REJECTED") {
    setReviewingId(id); setError(""); setSuccess("");
    try {
      await api(`/api/pardons/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load(false); setSuccess(`Pardon request ${status.toLowerCase()}.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setReviewingId("");
    }
  }

  async function recalculate() {
    setRecalculating(true); setError(""); setSuccess("");
    try {
      const result = await api<{ changed: number }>("/api/delays/recalculate", { method: "POST" });
      await load(false); setSuccess(`Delay check complete. ${result.changed} stage${result.changed === 1 ? "" : "s"} updated.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setRecalculating(false);
    }
  }

  if (loading) return <><PageHeader title="Production" description="Track one customer order at a time." /><LoadingState label="Loading production orders..." /></>;
  if (error && !orders.length) return <><PageHeader title="Production" description="Track one customer order at a time." /><ErrorState message={error} retry={() => load()} /></>;

  return <>
    <PageHeader
      title="Production"
      description="Select a customer and order, then update each production stage in sequence."
      action={canRecalculate ? <button disabled={recalculating} className="btn-secondary" onClick={recalculate}>{recalculating ? "Checking..." : "Check delays"}</button> : undefined}
    />

    <section className="card mb-6 p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="font-semibold">Find production work</h2><p className="text-xs text-stone-500">Search orders, customers, stages, assigned team members, or vendors.</p></div><button onClick={clearFilters} className="text-xs font-semibold text-wine">Clear filters</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Order, customer, stage or owner"/><select value={delayFilter} onChange={(e)=>setDelayFilter(e.target.value)}><option value="ALL">All delivery health</option><option value="GREEN">On track</option><option value="YELLOW">At risk</option><option value="RED">Delayed</option></select><select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="ALL">All stage statuses</option>{statusOptions.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={dueFilter} onChange={(e)=>setDueFilter(e.target.value)}><option value="ALL">Any due date</option><option value="TODAY">Due today</option><option value="OVERDUE">Overdue</option><option value="WEEK">Due this week</option></select></div><p className="mt-3 text-xs text-stone-500">{filteredOrders.length} active order{filteredOrders.length===1?"":"s"} match these filters. Delay state shows whether work is on track, at risk, or late.</p></section>

    <section className="card mb-6 p-5">
      <div className="mb-5 flex items-center gap-2 text-sm text-stone-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-wine text-xs font-bold text-white">1</span><span>Select customer</span>
        <ChevronRight size={15} /><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${customerId ? "bg-wine text-white" : "bg-stone-200"}`}>2</span><span>Select order</span>
        <ChevronRight size={15} /><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${orderId ? "bg-wine text-white" : "bg-stone-200"}`}>3</span><span>Update stages</span>
      </div>
      {!customers.length ? <EmptyState icon={<Factory size={22} />} title="No matching production work" message="No active orders match these filters. Clear the filters to see all work in the atelier." action={<button onClick={clearFilters} className="btn-secondary">Clear filters</button>} /> : <div className="grid gap-4 md:grid-cols-2">
        <div><label htmlFor="production-customer">Customer</label><select id="production-customer" value={customerId} onChange={(event) => chooseCustomer(event.target.value)}><option value="">Choose a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select><p className="mt-1 text-xs text-stone-400">Only customers with active orders are listed.</p></div>
        <div><label htmlFor="production-order">Order</label><select id="production-order" disabled={!customerId} value={orderId} onChange={(event) => chooseOrder(event.target.value)}><option value="">{customerId ? "Choose an order" : "Select a customer first"}</option>{customerOrders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · Delivery {shortDate(order.deliveryDate)}</option>)}</select><p className="mt-1 text-xs text-stone-400">Select the order you want to review.</p></div>
      </div>}
    </section>

    {error && <div className="mb-4"><InlineMessage message={error} /></div>}
    {success && <div className="mb-4"><InlineMessage message={success} tone="success" /></div>}

    {!customerId && customers.length > 0 && <EmptyState message="Start by selecting a customer above." />}
    {customerId && !orderId && <EmptyState message="Now select an order for this customer." />}

    {selectedOrder && <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-gold">Selected order</p><h3 className="mt-1 text-xl font-semibold">{selectedOrder.orderNumber}</h3><p className="mt-1 text-sm text-stone-500">{selectedOrder.customer.name} · Delivery {shortDate(selectedOrder.deliveryDate)}</p></div>
          <div className="flex items-center gap-4"><div className="text-right"><p className="text-2xl font-semibold">{completedStages}/6</p><p className="text-xs text-stone-500">Stages completed</p></div><StatusBadge value={selectedOrder.delayState} /></div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-wine transition-all" style={{ width: `${(completedStages / 6) * 100}%` }} /></div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="card h-fit overflow-hidden">
          <header className="border-b border-stone-100 p-4"><h3 className="font-semibold">Production stages</h3><p className="mt-1 text-xs text-stone-500">Select a stage to view or update it.</p></header>
          <div className="p-2">{selectedOrder.stages.map((stage) => {
            const active = stage.id === stageId;
            const Icon = stage.status === "COMPLETED" ? Check : stage.delayState === "RED" ? AlertCircle : Clock3;
            return <button type="button" key={stage.id} onClick={() => { setStageId(stage.id); setError(""); setSuccess(""); setPardonReason(""); }} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left ${active ? "bg-wine text-white" : "hover:bg-stone-50"}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? "bg-white/15" : stage.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : stage.delayState === "RED" ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-500"}`}><Icon size={17} /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs opacity-70">Stage {stage.sequence}</span><span className="block truncate text-sm font-semibold">{stageLabels[stage.type]}</span></span>
              <span className="text-[10px] font-bold">{stage.status === "COMPLETED" ? "DONE" : delayLabels[stage.delayState] ?? stage.delayState}</span>
            </button>;
          })}</div>
        </section>

        {selectedStage && <section className="card overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 p-5">
            <div><p className="text-xs font-bold uppercase tracking-wide text-gold">Stage {selectedStage.sequence} of 6</p><h3 className="mt-1 text-xl font-semibold">{stageLabels[selectedStage.type]}</h3><p className="mt-1 text-sm text-stone-500">Due {shortDate(selectedStage.dueDate)}</p></div>
            <div className="flex gap-2"><StatusBadge value={selectedStage.status} /><StatusBadge value={selectedStage.delayState} /></div>
          </header>

          <form key={`${selectedStage.id}-${selectedStage.status}-${selectedStage.dueDate}-${selectedStage.startDate}-${selectedStage.remarks}`} onSubmit={saveStage} className="p-5">
            {!canEdit && <div className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">You have view-only access. A Production Manager, QC Team member, Store Manager, Partner, or Owner can update this stage.</div>}
            <fieldset disabled={!canEdit || savingId === selectedStage.id}>
              <div className="grid gap-4 md:grid-cols-2">
                <div><label>Stage status</label><select name="status" defaultValue={selectedStage.status}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><p className="mt-1 text-xs text-stone-400">Choose Completed only when this stage is fully finished.</p></div>
                <div><label>Internal owner</label><select name="ownerId" defaultValue={selectedStage.ownerId ?? ""}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role.replaceAll("_", " ")}</option>)}</select></div>
                <div><label>External vendor</label><input name="vendorName" defaultValue={selectedStage.vendorName ?? ""} placeholder="Optional vendor name" /></div>
                <div><label>Start date</label><input type="date" name="startDate" defaultValue={selectedStage.startDate?.slice(0, 10) ?? ""} /></div>
                <div><label>Due date</label><input required type="date" name="dueDate" defaultValue={selectedStage.dueDate.slice(0, 10)} /></div>
                <div><label>Completion date</label><input type="date" value={selectedStage.completionDate?.slice(0, 10) ?? ""} disabled readOnly placeholder="Set automatically" /></div>
                <div className="md:col-span-2"><label>Remarks</label><textarea name="remarks" rows={3} defaultValue={selectedStage.remarks ?? ""} placeholder="Record progress, blockers, handover notes, or quality observations." /></div>
              </div>
              {canEdit && <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-5"><p className="text-xs text-stone-500">Saving this stage also updates the order health and audit log.</p><button disabled={savingId === selectedStage.id} className="btn-primary">{savingId === selectedStage.id ? "Saving..." : "Save stage"}</button></div>}
            </fieldset>
          </form>

          <div className="border-t border-stone-100 bg-stone-50 p-5">
            <div className="flex items-center gap-2"><UserRound size={17} className="text-stone-500" /><h4 className="text-sm font-semibold">Delay pardon</h4></div>
            {selectedStage.delayState !== "RED" && <p className="mt-2 text-sm text-stone-500">A pardon is only available when this stage is delayed.</p>}
            {selectedStage.delayState === "RED" && !selectedStage.pardons.some((pardon) => pardon.status === "REQUESTED") && <div className="mt-3"><label>External reason</label><textarea rows={2} value={pardonReason} onChange={(event) => setPardonReason(event.target.value)} placeholder="Explain the valid external reason for the delay." /><div className="mt-2 flex justify-end"><button type="button" disabled={savingId === selectedStage.id} className="btn-secondary" onClick={requestPardon}>Send pardon request</button></div></div>}
            <div className="mt-3 space-y-2">{selectedStage.pardons.map((pardon) => <div key={pardon.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><p>{pardon.reason}</p><p className="mt-1 text-xs text-stone-400">Requested by {pardon.requestedBy.name}</p></div><StatusBadge value={pardon.status} /></div>{sessionUser?.companyStatus === "OWNER" && pardon.status === "REQUESTED" && <div className="mt-3 flex gap-3 border-t border-stone-100 pt-3"><button disabled={reviewingId === pardon.id} type="button" className="text-xs font-semibold text-emerald-700" onClick={() => reviewPardon(pardon.id, "APPROVED")}>Approve</button><button disabled={reviewingId === pardon.id} type="button" className="text-xs font-semibold text-red-700" onClick={() => reviewPardon(pardon.id, "REJECTED")}>Reject</button></div>}</div>)}</div>
          </div>
        </section>}
      </div>
    </div>}
  </>;
}
