"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Clock3, Factory, SlidersHorizontal, UserRound } from "lucide-react";
import { EmptyState, ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { QuickViews, Select } from "@/components/ui";
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

// Saved views — quick presets over the existing delay/status/due filters.
type PView = "ALL" | "DELAYED" | "AT_RISK" | "DUE_WEEK" | "OVERDUE" | "BLOCKED" | "";
function stageMatchesView(stage: Stage, view: PView): boolean {
  const due = new Date(stage.dueDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(today); week.setDate(week.getDate() + 7);
  switch (view) {
    case "DELAYED": return stage.delayState === "RED";
    case "AT_RISK": return stage.delayState === "YELLOW";
    case "DUE_WEEK": return due >= today && due <= week;
    case "OVERDUE": return due < today && stage.status !== "COMPLETED";
    case "BLOCKED": return stage.status === "BLOCKED";
    default: return true;
  }
}

export default function ProductionPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
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
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const [orderResult, metaResult, sessionResult, vendorResult] = await Promise.all([
        api<{ orders: Order[] }>("/api/orders"), api<{ users: User[] }>("/api/meta"), api<{ user: SessionUser }>("/api/auth/me"),
        api<{ vendors: { id: string; name: string }[] }>("/api/vendors").catch(() => ({ vendors: [] })),
      ]);
      setOrders(orderResult.orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.status)));
      setUsers(metaResult.users);
      setSessionUser(sessionResult.user);
      setVendors(vendorResult.vendors);
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
  const activeFilterCount = (search.trim() ? 1 : 0) + (delayFilter !== "ALL" ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0) + (dueFilter !== "ALL" ? 1 : 0);

  // Quick views drive the existing select filters so the chip state and the
  // dropdowns always agree. Counts reflect orders with a matching stage.
  const noSelectFilters = delayFilter === "ALL" && statusFilter === "ALL" && dueFilter === "ALL";
  const activeView: PView =
    noSelectFilters ? "ALL" :
    delayFilter === "RED" && statusFilter === "ALL" && dueFilter === "ALL" ? "DELAYED" :
    delayFilter === "YELLOW" && statusFilter === "ALL" && dueFilter === "ALL" ? "AT_RISK" :
    dueFilter === "WEEK" && delayFilter === "ALL" && statusFilter === "ALL" ? "DUE_WEEK" :
    dueFilter === "OVERDUE" && delayFilter === "ALL" && statusFilter === "ALL" ? "OVERDUE" :
    statusFilter === "BLOCKED" && delayFilter === "ALL" && dueFilter === "ALL" ? "BLOCKED" : "";
  function applyView(v: PView) {
    setDelayFilter(v === "DELAYED" ? "RED" : v === "AT_RISK" ? "YELLOW" : "ALL");
    setStatusFilter(v === "BLOCKED" ? "BLOCKED" : "ALL");
    setDueFilter(v === "DUE_WEEK" ? "WEEK" : v === "OVERDUE" ? "OVERDUE" : "ALL");
  }
  const countFor = (v: PView) => orders.filter((o) => o.stages.some((s) => stageMatchesView(s, v))).length;
  const productionViews = useMemo(() => ([
    { id: "ALL" as PView, label: "All work", count: orders.length },
    { id: "DELAYED" as PView, label: "Delayed", count: countFor("DELAYED") },
    { id: "AT_RISK" as PView, label: "At risk", count: countFor("AT_RISK") },
    { id: "DUE_WEEK" as PView, label: "Due this week", count: countFor("DUE_WEEK") },
    { id: "OVERDUE" as PView, label: "Overdue", count: countFor("OVERDUE") },
    { id: "BLOCKED" as PView, label: "Blocked", count: countFor("BLOCKED") },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [orders]);

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

    <section className="card mb-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Find production work</h2>
          <p className="text-xs text-stone-500">{filteredOrders.length} active order{filteredOrders.length===1?"":"s"}{activeFilterCount>0?" match these filters":" in the atelier"}. Search by order, customer, stage, owner or vendor.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount>0 && <button onClick={clearFilters} className="text-xs font-semibold text-wine">Clear filters</button>}
          <button type="button" onClick={()=>setShowFilters(v=>!v)} className="btn-secondary btn-sm flex items-center gap-1.5"><SlidersHorizontal size={14} />Filters{activeFilterCount>0 && <span className="rounded-full bg-wine px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{activeFilterCount}</span>}</button>
        </div>
      </div>
      {showFilters && (
        <div className="mt-4 border-t border-stone-100 pt-4">
          <div className="mb-3"><QuickViews views={productionViews} value={activeView} onChange={applyView} /></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Order, customer, stage or owner"/>
            <Select value={delayFilter} onChange={setDelayFilter} searchable={false} ariaLabel="Filter by delivery health" options={[{value:"ALL",label:"All delivery health"},{value:"GREEN",label:"On track"},{value:"YELLOW",label:"At risk"},{value:"RED",label:"Delayed"}]} />
            <Select value={statusFilter} onChange={setStatusFilter} searchable={false} ariaLabel="Filter by stage status" options={[{value:"ALL",label:"All stage statuses"},...statusOptions.map((s)=>({value:s.value,label:s.label}))]} />
            <Select value={dueFilter} onChange={setDueFilter} searchable={false} ariaLabel="Filter by due date" options={[{value:"ALL",label:"Any due date"},{value:"TODAY",label:"Due today"},{value:"OVERDUE",label:"Overdue"},{value:"WEEK",label:"Due this week"}]} />
          </div>
        </div>
      )}
    </section>

    <section className="card mb-6 p-5">
      <div className="mb-4"><h2 className="font-semibold">Select an order to update</h2><p className="text-xs text-stone-500">Pick a customer, then one of their active orders to review and update its stages.</p></div>
      {!customers.length ? <EmptyState icon={<Factory size={22} />} title="No matching production work" message="No active orders match these filters. Clear the filters to see all work in the atelier." action={<button onClick={clearFilters} className="btn-secondary">Clear filters</button>} /> : <div className="grid gap-4 md:grid-cols-2">
        <div><label htmlFor="production-customer">Customer</label><Select id="production-customer" value={customerId} onChange={chooseCustomer} placeholder="Choose a customer" options={customers.map((customer) => ({ value: customer.id, label: customer.name, hint: customer.phone }))} /><p className="mt-1 text-xs text-stone-400">Only customers with active orders are listed.</p></div>
        <div><label htmlFor="production-order">Order</label><Select id="production-order" disabled={!customerId} value={orderId} onChange={chooseOrder} placeholder={customerId ? "Choose an order" : "Select a customer first"} options={customerOrders.map((order) => ({ value: order.id, label: order.orderNumber, hint: `Delivery ${shortDate(order.deliveryDate)}` }))} /><p className="mt-1 text-xs text-stone-400">Select the order you want to review.</p></div>
      </div>}
      {customers.length > 0 && !selectedOrder && <p className="mt-4 text-sm text-stone-400">{!customerId ? "Choose a customer to see their active orders." : "Now choose an order for this customer."}</p>}
    </section>

    {error && <div className="mb-4"><InlineMessage message={error} /></div>}
    {success && <div className="mb-4"><InlineMessage message={success} tone="success" /></div>}

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
                <div><label>Stage status</label><Select name="status" defaultValue={selectedStage.status} searchable={false} disabled={!canEdit} options={statusOptions.map((option) => ({ value: option.value, label: option.label }))} /><p className="mt-1 text-xs text-stone-400">Choose Completed only when this stage is fully finished.</p></div>
                <div><label>Internal owner</label><Select name="ownerId" defaultValue={selectedStage.ownerId ?? ""} disabled={!canEdit} placeholder="Unassigned" options={[{ value: "", label: "Unassigned" }, ...users.map((user) => ({ value: user.id, label: user.name, hint: user.role.replaceAll("_", " ") }))]} /></div>
                <div><label>External vendor</label><input name="vendorName" list="production-vendor-options" defaultValue={selectedStage.vendorName ?? ""} placeholder="Select or type a vendor" /><datalist id="production-vendor-options">{vendors.map((v) => <option key={v.id} value={v.name} />)}</datalist><p className="mt-1 text-xs text-stone-400">Pick a vendor from your Vendors list, or type a name.</p></div>
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
