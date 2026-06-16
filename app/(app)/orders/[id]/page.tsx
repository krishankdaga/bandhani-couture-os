"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CreditCard, IndianRupee, Package, Pencil, Plus, Save, Scissors, Trash2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import { api, money, shortDate, toast } from "@/lib/client";

type Stage = {
  id: string; type: string; sequence: number; status: string; delayState: string;
  dueDate: string; startDate: string | null; completionDate: string | null;
  vendorName: string | null; remarks: string | null; owner: { name: string } | null;
};
type Order = {
  orderNumber: string; orderValue: string; priority: string; deliveryDate: string; status: string; delayState: string;
  measurements: Record<string, string>; customisations: string[]; updatedAt: string;
  customer: { name: string; phone: string; email: string | null; address: string | null };
  stylist: { name: string }; store: { name: string }; stages: Stage[];
};
type Payment = { id: string; amount: string; method: string; kind: string; note: string | null; paidAt: string; recordedBy: { name: string } | null };
type Material = {
  id: string; inventoryItemId: string; sku: string; name: string; unit: string;
  requiredQty: number; consumedQty: number; remainingQty: number; note: string | null; createdBy: string | null;
  itemOnHand: number; itemReserved: number; itemAvailable: number; itemShortage: number;
};
type StockOption = { id: string; sku: string; name: string; unit: string; category: string; onHand: number; available: number };
type Stylist = { id: string; name: string; role: string };

const STAGE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as const;
const METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;
const KINDS = ["ADVANCE", "PARTIAL", "FINAL", "REFUND"] as const;
const kindTone: Record<string, string> = { ADVANCE: "bg-blue-100 text-blue-700", PARTIAL: "bg-amber-100 text-amber-700", FINAL: "bg-emerald-100 text-emerald-700", REFUND: "bg-red-100 text-red-700" };

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function StageRow({ stage, canEdit, onSaved }: { stage: Stage; canEdit: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ status: stage.status, vendorName: stage.vendorName ?? "", dueDate: toDateInput(stage.dueDate), remarks: stage.remarks ?? "" });

  async function save() {
    setSaving(true);
    try {
      await api(`/api/stages/${stage.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: form.status, vendorName: form.vendorName || null, dueDate: form.dueDate, remarks: form.remarks || null }),
      });
      toast("Stage updated.");
      setOpen(false);
      onSaved();
    } catch (caught) {
      toast((caught as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">{stage.sequence}</span>
          <div>
            <p className="text-sm font-semibold">{stage.type.replaceAll("_", " ")}</p>
            <p className="text-xs text-stone-500">Due {shortDate(stage.dueDate)} · {stage.owner?.name || stage.vendorName || "Unassigned"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={stage.status} />
          <StatusBadge value={stage.delayState} />
          {canEdit && <button onClick={() => setOpen(!open)} className="btn-secondary btn-sm">{open ? "Close" : "Manage"}</button>}
        </div>
      </div>
      {stage.remarks && !open && <p className="mt-2 pl-10 text-xs text-stone-500">“{stage.remarks}”</p>}
      {open && canEdit && (
        <div className="mt-4 grid gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4 md:grid-cols-2">
          <div><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STAGE_STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></div>
          <div><label>Due date</label><input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          <div><label>Vendor / karigar</label><input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} placeholder="e.g. Riyaz embroidery" /></div>
          <div><label>Remarks</label><input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Notes for this stage" /></div>
          <div className="md:col-span-2 flex justify-end"><button onClick={save} disabled={saving} className="btn-primary btn-sm">{saving ? "Saving..." : "Save stage"}</button></div>
        </div>
      )}
    </div>
  );
}

export default function OrderSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [payForm, setPayForm] = useState({ amount: "", kind: "ADVANCE", method: "CASH", paidAt: "", note: "" });
  const [savingPay, setSavingPay] = useState(false);
  const [payError, setPayError] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);
  const [matForm, setMatForm] = useState({ inventoryItemId: "", requiredQty: "", note: "", allowShortage: false });
  const [savingMat, setSavingMat] = useState(false);
  const [matError, setMatError] = useState("");

  // Edit order state
  const [showEdit, setShowEdit] = useState(false);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [editForm, setEditForm] = useState({ stylistId: "", orderValue: "", priority: "", deliveryDate: "", measurements: {} as Record<string, string>, customisations: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [orderResult, payResult, matResult, meResult, metaResult] = await Promise.all([
        api<{ order: Order }>(`/api/orders/${id}`),
        api<{ payments: Payment[] }>(`/api/orders/${id}/payments`).catch(() => ({ payments: [] })),
        api<{ materials: Material[]; items: StockOption[] }>(`/api/orders/${id}/materials`).catch(() => ({ materials: [], items: [] })),
        api<{ user: { permissions: string[] } }>("/api/auth/me").catch(() => ({ user: { permissions: [] } })),
        api<{ users: Stylist[] }>("/api/meta").catch(() => ({ users: [] })),
      ]);
      setOrder(orderResult.order);
      setPayments(payResult.payments);
      setMaterials(matResult.materials);
      setStockOptions(matResult.items);
      setPermissions(meResult.user.permissions);
      setStylists((metaResult.users || []).filter((u: Stylist) => u.role === "STYLIST"));
    } catch (caught) { setError((caught as Error).message); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function reloadPayments() {
    const result = await api<{ payments: Payment[] }>(`/api/orders/${id}/payments`).catch(() => ({ payments: [] }));
    setPayments(result.payments);
  }

  async function addPayment(event: React.FormEvent) {
    event.preventDefault();
    setSavingPay(true); setPayError("");
    try {
      await api(`/api/orders/${id}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(payForm.amount), kind: payForm.kind, method: payForm.method, note: payForm.note || null, paidAt: payForm.paidAt || undefined }),
      });
      toast("Payment recorded.");
      setPayForm({ amount: "", kind: "ADVANCE", method: "CASH", paidAt: "", note: "" });
      await reloadPayments();
    } catch (caught) { setPayError((caught as Error).message); } finally { setSavingPay(false); }
  }

  async function removePayment(paymentId: string) {
    if (!confirm("Remove this payment record?")) return;
    try { await api(`/api/orders/${id}/payments/${paymentId}`, { method: "DELETE" }); toast("Payment removed."); await reloadPayments(); }
    catch (caught) { toast((caught as Error).message, "error"); }
  }

  async function reloadMaterials() {
    const result = await api<{ materials: Material[]; items: StockOption[] }>(`/api/orders/${id}/materials`).catch(() => ({ materials: [], items: [] }));
    setMaterials(result.materials);
    setStockOptions(result.items);
  }

  async function allocate(event: React.FormEvent) {
    event.preventDefault();
    setSavingMat(true); setMatError("");
    try {
      await api(`/api/orders/${id}/materials`, {
        method: "POST",
        body: JSON.stringify({ inventoryItemId: matForm.inventoryItemId, requiredQty: Number(matForm.requiredQty), note: matForm.note || null, allowShortage: matForm.allowShortage }),
      });
      toast("Material allocated.");
      setMatForm({ inventoryItemId: "", requiredQty: "", note: "", allowShortage: false });
      await reloadMaterials();
    } catch (caught) { setMatError((caught as Error).message); } finally { setSavingMat(false); }
  }

  async function consumeMaterial(material: Material) {
    const input = prompt(`Consume how much ${material.name}? Remaining allocated: ${material.remainingQty} ${material.unit}`, String(material.remainingQty));
    if (input === null) return;
    const quantity = Number(input);
    if (!Number.isFinite(quantity) || quantity <= 0) { toast("Enter a valid quantity.", "error"); return; }
    try { await api(`/api/orders/${id}/materials/${material.id}/consume`, { method: "POST", body: JSON.stringify({ quantity }) }); toast("Consumption recorded."); await reloadMaterials(); }
    catch (caught) { toast((caught as Error).message, "error"); }
  }

  async function removeMaterial(material: Material) {
    if (!confirm(`Remove the allocation of ${material.name}?`)) return;
    try { await api(`/api/orders/${id}/materials/${material.id}`, { method: "DELETE" }); toast("Allocation removed."); await reloadMaterials(); }
    catch (caught) { toast((caught as Error).message, "error"); }
  }

  function openEdit() {
    if (!order) return;
    setEditForm({
      stylistId: "",
      orderValue: String(order.orderValue),
      priority: order.priority,
      deliveryDate: order.deliveryDate.slice(0, 10),
      measurements: { ...order.measurements },
      customisations: order.customisations?.join(", ") ?? "",
    });
    setEditError("");
    setShowEdit(true);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    setSavingEdit(true); setEditError("");
    try {
      await api(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(editForm.stylistId && { stylistId: editForm.stylistId }),
          orderValue: Number(editForm.orderValue),
          priority: editForm.priority,
          deliveryDate: editForm.deliveryDate,
          measurements: editForm.measurements,
          customisations: editForm.customisations.split(",").map((v) => v.trim()).filter(Boolean),
        }),
      });
      toast("Order updated.");
      setShowEdit(false);
      await load();
    } catch (caught) { setEditError((caught as Error).message); } finally { setSavingEdit(false); }
  }

  if (loading) return <LoadingState label="Loading order..." rows={4} />;
  if (error || !order) return <ErrorState message={error || "Order not found."} retry={load} />;

  const canEditOrder = permissions.includes("orders.edit");
  const canEditProduction = permissions.includes("production.edit");
  const orderValue = Number(order.orderValue);
  const net = payments.reduce((sum, p) => sum + (p.kind === "REFUND" ? -Number(p.amount) : Number(p.amount)), 0);
  const balance = Math.max(0, orderValue - net);
  const paidPct = orderValue > 0 ? Math.min(100, Math.round((net / orderValue) * 100)) : 0;
  const totalRequired = materials.reduce((sum, m) => sum + m.requiredQty, 0);
  const totalConsumed = materials.reduce((sum, m) => sum + m.consumedQty, 0);
  const shortageLines = materials.filter((m) => m.itemShortage > 0);
  const selectedStock = stockOptions.find((s) => s.id === matForm.inventoryItemId);

  return (
    <div className="print-summary">
      <PageHeader
        title={order.orderNumber}
        description={`${order.customer.name} · ${order.store.name}`}
        action={
          <div className="flex gap-2 no-print">
            {canEditOrder && (
              <button onClick={openEdit} className="btn-secondary flex items-center gap-2"><Pencil size={15} />Edit order</button>
            )}
            <button onClick={() => window.print()} className="btn-secondary">Print</button>
          </div>
        }
      />
      <p className="mb-5 text-xs text-stone-400">Last updated {new Date(order.updatedAt).toLocaleString("en-IN")}</p>

      {/* Edit order panel */}
      {showEdit && canEditOrder && (
        <form onSubmit={saveEdit} className="card mb-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-wine/10 text-wine"><Pencil size={17} /></span>
              <div><h2 className="font-semibold">Edit order</h2><p className="text-xs text-stone-500">Correct mistakes made during order entry</p></div>
            </div>
            <button type="button" onClick={() => setShowEdit(false)} className="text-sm font-medium text-stone-400 hover:text-ink">Cancel</button>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label>Order value (₹)</label>
              <input type="number" min="1" step="1" required value={editForm.orderValue} onChange={(e) => setEditForm({ ...editForm, orderValue: e.target.value })} />
            </div>
            <div>
              <label>Priority</label>
              <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                {["NORMAL", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label>Delivery date</label>
              <input type="date" required value={editForm.deliveryDate} onChange={(e) => setEditForm({ ...editForm, deliveryDate: e.target.value })} />
            </div>
            <div>
              <label>Reassign stylist</label>
              <select value={editForm.stylistId} onChange={(e) => setEditForm({ ...editForm, stylistId: e.target.value })}>
                <option value="">Keep current ({order.stylist.name})</option>
                {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {(["bust", "waist", "hip", "length"] as const).map((field) => (
              <div key={field}>
                <label className="capitalize">{field}</label>
                <input
                  value={(editForm.measurements as Record<string, string>)[field] ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, measurements: { ...editForm.measurements, [field]: e.target.value } })}
                  placeholder="inches"
                />
              </div>
            ))}
            <div className="md:col-span-2 xl:col-span-4">
              <label>Customisations (comma separated)</label>
              <input value={editForm.customisations} onChange={(e) => setEditForm({ ...editForm, customisations: e.target.value })} placeholder="Full sleeves, Personalised dupatta border" />
            </div>
          </div>
          {editError && <div className="mx-5 mb-4"><InlineMessage message={editError} /></div>}
          <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
            <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary">Cancel</button>
            <button disabled={savingEdit} className="btn-primary flex items-center gap-2"><Save size={15} />{savingEdit ? "Saving..." : "Save changes"}</button>
          </div>
        </form>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-stone-400">Order value</p><p className="mt-1 text-lg font-semibold">{money(order.orderValue)}</p></div>
        <div className="card p-4"><p className="text-xs text-stone-400">Amount paid</p><p className="mt-1 text-lg font-semibold text-emerald-700">{money(net)}</p></div>
        <div className="card p-4"><p className="text-xs text-stone-400">Balance due</p><p className={`mt-1 text-lg font-semibold ${balance > 0 ? "text-wine" : "text-emerald-700"}`}>{money(balance)}</p></div>
        <div className="card p-4"><p className="text-xs text-stone-400">Delivery</p><p className="mt-1 text-lg font-semibold">{shortDate(order.deliveryDate)}</p><div className="mt-2 flex gap-2"><StatusBadge value={order.status} /><StatusBadge value={order.delayState} /></div></div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Customer and styling</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-stone-400">Customer</dt><dd>{order.customer.name} · {order.customer.phone}</dd></div>
            <div><dt className="text-stone-400">Stylist</dt><dd>{order.stylist.name}</dd></div>
            <div><dt className="text-stone-400">Priority</dt><dd>{order.priority}</dd></div>
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Measurements</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{Object.entries(order.measurements || {}).map(([key, value]) => <div key={key}><dt className="capitalize text-stone-400">{key}</dt><dd>{value}</dd></div>)}</dl>
          {order.customisations?.length > 0 && <p className="mt-4 text-sm"><span className="text-stone-400">Customisations:</span> {order.customisations.join(", ")}</p>}
        </div>
      </section>

      {/* Payments */}
      <section className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-100 p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-wine/10 text-wine"><Wallet size={20} /></span><div><h2 className="font-semibold">Payments &amp; advances</h2><p className="text-xs text-stone-500">Record advance, partial and final payments against this order.</p></div></div>
        </div>
        <div className="p-5">
          <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium text-stone-600">{money(net)} collected</span><span className="text-stone-400">{paidPct}% of {money(orderValue)}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all" style={{ width: `${paidPct}%` }} /></div>
          {balance > 0 && <p className="mt-2 text-xs text-wine">{money(balance)} balance still due.</p>}

          {canEditOrder && (
            <form onSubmit={addPayment} className="mt-5 grid gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4 md:grid-cols-12 md:items-end">
              <div className="md:col-span-3"><label>Amount (₹)</label><input type="number" min="1" step="1" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="25000" /></div>
              <div className="md:col-span-2"><label>Type</label><select value={payForm.kind} onChange={(e) => setPayForm({ ...payForm, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
              <div className="md:col-span-2"><label>Method</label><select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>{METHODS.map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}</select></div>
              <div className="md:col-span-2"><label>Date</label><input type="date" value={payForm.paidAt} onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })} /></div>
              <div className="md:col-span-3"><label>Note</label><input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} placeholder="e.g. advance at booking" /></div>
              <div className="md:col-span-12 flex justify-end"><button disabled={savingPay} className="btn-primary btn-sm flex items-center gap-2"><Plus size={15} />{savingPay ? "Saving..." : "Record payment"}</button></div>
              {payError && <div className="md:col-span-12"><InlineMessage message={payError} /></div>}
            </form>
          )}

          <div className="mt-5 divide-y divide-stone-100">
            {payments.length ? payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-stone-100 text-stone-500"><IndianRupee size={16} /></span>
                  <div>
                    <p className="text-sm font-semibold">{money(p.amount)} <span className={`badge ml-1 ${kindTone[p.kind] ?? "bg-stone-100 text-stone-600"}`}>{p.kind}</span></p>
                    <p className="text-xs text-stone-500">{p.method.replaceAll("_", " ")} · {shortDate(p.paidAt)}{p.recordedBy ? ` · by ${p.recordedBy.name}` : ""}{p.note ? ` · ${p.note}` : ""}</p>
                  </div>
                </div>
                {canEditOrder && <button onClick={() => removePayment(p.id)} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove payment"><Trash2 size={15} /></button>}
              </div>
            )) : <div className="flex items-center gap-2 py-4 text-sm text-stone-400"><CreditCard size={16} />No payments recorded yet.</div>}
          </div>
        </div>
      </section>

      {/* Materials & allocation */}
      <section className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-100 p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-wine/10 text-wine"><Package size={20} /></span><div><h2 className="font-semibold">Materials &amp; allocation</h2><p className="text-xs text-stone-500">Reserve fabric and supplies for this order, then mark them consumed as production progresses.</p></div></div>
          {materials.length > 0 && <div className="text-right text-xs text-stone-500"><p className="text-sm font-semibold text-ink">{totalConsumed} / {totalRequired}</p>consumed / allocated</div>}
        </div>
        <div className="p-5">
          {shortageLines.length > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p><span className="font-semibold">Material shortage.</span> {shortageLines.map((m) => `${m.name} (short ${m.itemShortage} ${m.unit})`).join(", ")}. Raise a purchase to cover the gap.</p>
            </div>
          )}

          {canEditOrder && (
            <form onSubmit={allocate} className="mb-5 grid gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4 md:grid-cols-12 md:items-end">
              <div className="md:col-span-5"><label>Inventory item</label><select required value={matForm.inventoryItemId} onChange={(e) => setMatForm({ ...matForm, inventoryItemId: e.target.value })}><option value="">Choose material…</option>{stockOptions.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.available} {s.unit} available)</option>)}</select></div>
              <div className="md:col-span-2"><label>Required {selectedStock ? `(${selectedStock.unit})` : ""}</label><input type="number" min="0.01" step="0.01" required value={matForm.requiredQty} onChange={(e) => setMatForm({ ...matForm, requiredQty: e.target.value })} placeholder="12" /></div>
              <div className="md:col-span-3"><label>Note</label><input value={matForm.note} onChange={(e) => setMatForm({ ...matForm, note: e.target.value })} placeholder="e.g. main body fabric" /></div>
              <div className="md:col-span-2 flex justify-end"><button disabled={savingMat} className="btn-primary btn-sm flex items-center gap-2"><Plus size={15} />{savingMat ? "Saving..." : "Allocate"}</button></div>
              {selectedStock && Number(matForm.requiredQty) > selectedStock.available && (
                <label className="md:col-span-12 flex items-center gap-2 text-xs text-amber-700"><input type="checkbox" className="h-4 w-4" checked={matForm.allowShortage} onChange={(e) => setMatForm({ ...matForm, allowShortage: e.target.checked })} />Only {selectedStock.available} {selectedStock.unit} available — allocate despite shortage (flags a purchase need)</label>
              )}
              {matError && <div className="md:col-span-12"><InlineMessage message={matError} /></div>}
            </form>
          )}

          <div className="divide-y divide-stone-100">
            {materials.length ? materials.map((m) => {
              const pct = m.requiredQty > 0 ? Math.min(100, Math.round((m.consumedQty / m.requiredQty) * 100)) : 0;
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{m.name} <span className="text-xs font-normal text-stone-400">{m.sku}</span>{m.itemShortage > 0 && <span className="badge ml-2 bg-amber-100 text-amber-700">SHORT {m.itemShortage} {m.unit}</span>}</p>
                    <p className="text-xs text-stone-500">Allocated {m.requiredQty} {m.unit} · consumed {m.consumedQty} · {m.remainingQty} remaining{m.note ? ` · ${m.note}` : ""}</p>
                    <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-gradient-to-r from-wine to-wine-dark" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEditProduction && m.remainingQty > 0 && <button onClick={() => consumeMaterial(m)} className="btn-secondary btn-sm flex items-center gap-1"><Scissors size={13} />Consume</button>}
                    {canEditOrder && m.consumedQty === 0 && <button onClick={() => removeMaterial(m)} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove allocation"><Trash2 size={15} /></button>}
                  </div>
                </div>
              );
            }) : <div className="flex items-center gap-2 py-4 text-sm text-stone-400"><Package size={16} />No materials allocated yet.</div>}
          </div>
        </div>
      </section>

      {/* Production stages */}
      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-stone-100 p-5"><h2 className="font-semibold">Production stages</h2><p className="text-xs text-stone-500">{canEditProduction ? "Update status, assign a karigar/vendor, set due dates and notes." : "Live status of each atelier stage."}</p></div>
        <div className="divide-y divide-stone-100">{order.stages.map((stage) => <StageRow key={stage.id} stage={stage} canEdit={canEditProduction} onSaved={load} />)}</div>
      </section>
    </div>
  );
}
