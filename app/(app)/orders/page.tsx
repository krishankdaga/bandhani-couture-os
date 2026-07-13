"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, Plus, Trash2, UserPlus, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { QuickViews, SearchInput, Select } from "@/components/ui";
import { api, money, shortDate, toast } from "@/lib/client";
import { EmptyState, ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import { useConfirm } from "@/components/confirm-dialog";
import { Drawer } from "@/components/drawer";

type Order = { id: string; orderNumber: string; orderValue: string; priority: string; deliveryDate: string; status: string; delayState: string; customer: { name: string; phone: string }; stylist: { name: string }; stages: Array<{ status: string }> };
type Meta = { stores: Array<{ id: string; name: string }>; users: Array<{ id: string; name: string; role: string }>; customers: Customer[] };
type Customer = { id: string; name: string; phone: string; store: { name: string }; measurements?: Record<string, unknown> | null };
type CustomMeasurement = { name: string; value: string; notes: string };

const STANDARD_FIELDS = ["bust", "waist", "hip", "length"] as const;

// Split a stored measurements blob into the four standard fields and the
// free-form custom list, so a selected customer's saved measurements can
// pre-fill the new-order form.
function splitMeasurements(raw: Record<string, unknown> | null | undefined) {
  const standard: Record<string, string> = {};
  const custom: CustomMeasurement[] = [];
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (k === "_custom") {
        if (Array.isArray(v)) for (const item of v) {
          const m = (item ?? {}) as Record<string, unknown>;
          if (m.name) custom.push({ name: String(m.name), value: String(m.value ?? ""), notes: m.notes ? String(m.notes) : "" });
        }
      } else if (STANDARD_FIELDS.includes(k as (typeof STANDARD_FIELDS)[number])) {
        standard[k] = String(v ?? "");
      }
    }
  }
  return { standard, custom };
}
type NewCust = { name: string; phone: string; email: string; address: string; preferences: string };

const PRIORITY_DOT: Record<string, string> = { NORMAL: "bg-stone-300", HIGH: "bg-amber-400", URGENT: "bg-red-500" };
const NEW_CUST_BLANK: NewCust = { name: "", phone: "", email: "", address: "", preferences: "" };

// Saved views — quick filters over existing list fields (no extra API calls).
type OrderView = "ALL" | "ATTENTION" | "DUE_WEEK" | "IN_PROD" | "READY";
const INACTIVE_ORDER_STATUSES = ["DELIVERED", "CANCELLED"];
function matchesView(o: Order, view: OrderView): boolean {
  switch (view) {
    case "ATTENTION": return o.delayState === "RED" || o.delayState === "YELLOW";
    case "DUE_WEEK": return !INACTIVE_ORDER_STATUSES.includes(o.status) && new Date(o.deliveryDate).getTime() <= Date.now() + 7 * 86400000;
    case "IN_PROD": return o.status === "IN_PRODUCTION";
    case "READY": return o.status === "READY";
    default: return true;
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<Meta>({ stores: [], users: [], customers: [] });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [companyStatus, setCompanyStatus] = useState("");
  const [requestingDelete, setRequestingDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [customMeasurements, setCustomMeasurements] = useState<CustomMeasurement[]>([]);
  // Pre-filled standard measurements from the selected customer's saved profile.
  const [stdPrefill, setStdPrefill] = useState<Record<string, string>>({});
  const { confirm } = useConfirm();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [delayFilter, setDelayFilter] = useState("ALL");
  const [view, setView] = useState<OrderView>("ALL");

  // Customer combobox
  const [custSearch, setCustSearch] = useState("");
  const [selectedCustId, setSelectedCustId] = useState("");
  const [showCustDrop, setShowCustDrop] = useState(false);
  const custDropRef = useRef<HTMLDivElement>(null);

  // Quick-create customer
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCust, setNewCust] = useState<NewCust>(NEW_CUST_BLANK);
  const [savingCust, setSavingCust] = useState(false);
  const [custError, setCustError] = useState("");

  // Track selected store so new-customer call knows which store to assign (owners only;
  // non-owners get their storeId from the server automatically).
  const [formStoreId, setFormStoreId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setPageError("");
    try {
      const [orderResult, metaResult, session] = await Promise.all([
        api<{ orders: Order[] }>("/api/orders"),
        api<Meta>("/api/meta"),
        api<{ user: { permissions: string[]; companyStatus: string } }>("/api/auth/me"),
      ]);
      setOrders(orderResult.orders);
      setMeta(metaResult);
      setCustomers(metaResult.customers);
      setPermissions(session.user.permissions);
      setCompanyStatus(session.user.companyStatus);
    } catch (e) { setPageError((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Pre-fill filters from URL params so global-search, the assistant and the
  // command-center cards can deep-link straight to a filtered list.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("search"); if (q) setSearch(q);
    const status = params.get("status"); if (status) setStatusFilter(status);
    const delay = params.get("delay"); if (delay) setDelayFilter(delay);
    const v = params.get("view"); if (v && ["ALL", "ATTENTION", "DUE_WEEK", "IN_PROD", "READY"].includes(v)) setView(v as OrderView);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (custDropRef.current && !custDropRef.current.contains(e.target as Node)) {
        setShowCustDrop(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedCust = customers.find((c) => c.id === selectedCustId) ?? null;
  const filteredCustomers = custSearch.trim()
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
        c.phone.includes(custSearch)
      )
    : customers;

  function selectCustomer(c: Customer) {
    setSelectedCustId(c.id);
    setCustSearch("");
    setShowCustDrop(false);
    // Pre-fill measurements from the customer's saved profile, if any.
    const { standard, custom } = splitMeasurements(c.measurements);
    setStdPrefill(standard);
    setCustomMeasurements(custom);
  }

  function openNewCust() {
    setShowCustDrop(false);
    setShowNewCust(true);
    setCustError("");
    // Pre-fill name from whatever the user typed
    setNewCust({ ...NEW_CUST_BLANK, name: custSearch });
  }

  function closeNewCust() {
    setShowNewCust(false);
    setCustError("");
    setNewCust(NEW_CUST_BLANK);
  }

  async function saveNewCustomer() {
    if (!newCust.name.trim() || !newCust.phone.trim()) {
      setCustError("Name and phone are required.");
      return;
    }
    setSavingCust(true); setCustError("");
    try {
      const result = await api<{ customer: Customer }>("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: newCust.name.trim(),
          phone: newCust.phone.trim(),
          email: newCust.email.trim() || null,
          address: newCust.address.trim() || null,
          preferences: newCust.preferences.trim() || null,
          storeId: formStoreId || meta.stores[0]?.id || "",
        }),
      });
      const created = result.customer;
      // Add to list, auto-select
      setCustomers((prev) => [created, ...prev]);
      setSelectedCustId(created.id);
      setCustSearch("");
      // A freshly created customer has no saved measurements yet — start clean.
      setStdPrefill({}); setCustomMeasurements([]);
      closeNewCust();
      toast(`Customer ${created.name} created and selected.`);
    } catch (e) { setCustError((e as Error).message); } finally { setSavingCust(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    if (!selectedCustId) {
      setError("Please select or create a customer first.");
      setSaving(false);
      return;
    }
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form);
    const validCustom = customMeasurements.filter((m) => m.name.trim() && m.value.trim());
    const advanceRaw = String(values.advanceAmount || "").trim();
    try {
      await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          customerId: selectedCustId,
          productionManagerId: String(values.productionManagerId || "") || null,
          advanceAmount: advanceRaw ? Number(advanceRaw) : null,
          advanceMethod: String(values.advanceMethod || "CASH"),
          customisations: String(values.customisations || "").split(",").map((v) => v.trim()).filter(Boolean),
          referenceImages: String(values.referenceImages || "").split(",").map((v) => v.trim()).filter(Boolean),
          measurements: {
            bust: values.bust, waist: values.waist, hip: values.hip, length: values.length,
            _custom: validCustom.map((m) => ({ name: m.name.trim(), value: m.value.trim(), notes: m.notes.trim() || undefined })),
          },
        }),
      });
      setShow(false);
      setCustomMeasurements([]);
      setStdPrefill({});
      setSelectedCustId("");
      setCustSearch("");
      setFormStoreId("");
      await load();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  function addCustomMeasurement() {
    setCustomMeasurements((prev) => [...prev, { name: "", value: "", notes: "" }]);
  }

  function updateCustomMeasurement(index: number, field: keyof CustomMeasurement, val: string) {
    setCustomMeasurements((prev) => prev.map((m, i) => i === index ? { ...m, [field]: val } : m));
  }

  function removeCustomMeasurement(index: number) {
    setCustomMeasurements((prev) => prev.filter((_, i) => i !== index));
  }

  async function requestDelete(order: Order) {
    if (!(await confirm({ title: "Request deletion?", message: `The owner will be asked to approve deleting ${order.orderNumber}.`, confirmLabel: "Send request" }))) return;
    setRequestingDelete(order.id);
    try {
      await api(`/api/orders/${order.id}/request-delete`, { method: "POST" });
      toast(`Deletion request sent to the owner for ${order.orderNumber}.`);
    } catch (e) { toast((e as Error).message, "error"); } finally { setRequestingDelete(null); }
  }

  async function deleteOrder(order: Order) {
    if (!(await confirm({ title: `Delete ${order.orderNumber}?`, message: "This permanently removes the order and all its payments, materials and production stages. This cannot be undone.", confirmLabel: "Delete order", tone: "danger" }))) return;
    setDeletingId(order.id);
    try {
      await api(`/api/orders/${order.id}`, { method: "DELETE" });
      toast(`${order.orderNumber} deleted.`);
      await load();
    } catch (e) { toast((e as Error).message, "error"); } finally { setDeletingId(null); }
  }

  const canWrite = permissions.includes("orders.create");
  const canDelete = permissions.includes("orders.edit");
  const canCreateCustomer = permissions.includes("customers.create") || companyStatus === "OWNER";
  const isOwner = companyStatus === "OWNER";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) =>
      matchesView(o, view) &&
      (statusFilter === "ALL" || o.status === statusFilter) &&
      (delayFilter === "ALL" || o.delayState === delayFilter) &&
      (!q || `${o.orderNumber} ${o.customer.name} ${o.customer.phone} ${o.stylist.name}`.toLowerCase().includes(q)),
    );
  }, [orders, search, statusFilter, delayFilter, view]);
  const orderViews = useMemo(() => ([
    { id: "ALL" as OrderView, label: "All orders", count: orders.length },
    { id: "ATTENTION" as OrderView, label: "Needs attention", count: orders.filter((o) => matchesView(o, "ATTENTION")).length },
    { id: "DUE_WEEK" as OrderView, label: "Due this week", count: orders.filter((o) => matchesView(o, "DUE_WEEK")).length },
    { id: "IN_PROD" as OrderView, label: "In production", count: orders.filter((o) => matchesView(o, "IN_PROD")).length },
    { id: "READY" as OrderView, label: "Ready", count: orders.filter((o) => matchesView(o, "READY")).length },
  ]), [orders]);
  const filtersActive = search.trim() !== "" || statusFilter !== "ALL" || delayFilter !== "ALL" || view !== "ALL";
  function clearFilters() { setSearch(""); setStatusFilter("ALL"); setDelayFilter("ALL"); setView("ALL"); }
  function resetCreateForm() {
    setShow(false);
    setSelectedCustId(""); setCustSearch(""); setShowCustDrop(false);
    setShowNewCust(false); setNewCust(NEW_CUST_BLANK); setCustError("");
    setCustomMeasurements([]); setStdPrefill({}); setFormStoreId(""); setError("");
  }

  return (
    <>
      <PageHeader
        title="Order Management"
        description="Create couture orders and track delivery commitments."
        action={canWrite ? (
          <button
            disabled={!customers.length && !canCreateCustomer}
            className="btn-primary"
            onClick={() => setShow(!show)}
          >
            + New order
          </button>
        ) : undefined}
      />

      <Drawer
        open={show && canWrite}
        onClose={resetCreateForm}
        title="New order"
        description="Create a couture order, pick or add the customer, and capture measurements."
        width="max-w-3xl"
        footer={<div className="flex justify-end gap-2"><button type="button" disabled={saving} className="btn-secondary" onClick={resetCreateForm}>Cancel</button><button form="order-form" disabled={saving} className="btn-primary">{saving ? "Creating..." : "Create order"}</button></div>}
      >
        <form id="order-form" onSubmit={create} className="grid gap-4 sm:grid-cols-2">

          {/* ── Customer combobox ── */}
          <div ref={custDropRef} className="relative">
            <label htmlFor="order-customer-search">Customer</label>
            {selectedCust ? (
              /* Selected state — show name with a clear button */
              <div className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 shadow-sm">
                <span className="flex-1 truncate text-sm font-medium text-ink">
                  {selectedCust.name}
                  <span className="ml-1.5 font-normal text-stone-400">· {selectedCust.phone}</span>
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedCustId(""); setCustSearch(""); setStdPrefill({}); setCustomMeasurements([]); }}
                  className="ml-1 shrink-0 rounded p-0.5 text-stone-400 hover:text-ink"
                  aria-label="Clear customer"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              /* Search state */
              <input
                id="order-customer-search"
                type="text"
                value={custSearch}
                onChange={(e) => { setCustSearch(e.target.value); setShowCustDrop(true); }}
                onFocus={() => setShowCustDrop(true)}
                placeholder="Search by name or phone…"
                autoComplete="off"
              />
            )}

            {/* Dropdown */}
            {showCustDrop && !selectedCust && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-pop">
                {filteredCustomers.length === 0 && !canCreateCustomer && (
                  <p className="px-3 py-2.5 text-sm text-stone-400">
                    No customers found{custSearch ? ` for "${custSearch}"` : ""}.
                  </p>
                )}
                {filteredCustomers.slice(0, 30).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => selectCustomer(c)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-stone-50"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-stone-400">{c.phone} · {c.store.name}</span>
                  </button>
                ))}
                {filteredCustomers.length === 0 && canCreateCustomer && (
                  <p className="px-3 py-2 text-sm text-stone-400">
                    No customers found{custSearch ? ` for "${custSearch}"` : ""}.
                  </p>
                )}
                {canCreateCustomer && (
                  <button
                    type="button"
                    onMouseDown={openNewCust}
                    className="flex w-full items-center gap-2 border-t border-stone-100 px-3 py-2.5 text-sm font-medium text-accent-deep transition hover:bg-accent/5"
                  >
                    <UserPlus size={14} />
                    {custSearch ? `Create "${custSearch}" as new customer` : "Create new customer"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div><label htmlFor="order-stylist">Stylist</label><Select id="order-stylist" name="stylistId" required defaultValue="" placeholder="Select" options={meta.users.filter((v) => v.role === "STYLIST").map((v) => ({ value: v.id, label: v.name }))} /></div>
          <div>
            <label htmlFor="order-production-manager">Production manager <span className="font-normal text-stone-400">(assign now or later)</span></label>
            <Select id="order-production-manager" name="productionManagerId" defaultValue="" placeholder="Assign later" options={[{ value: "", label: "Assign later" }, ...meta.users.filter((v) => v.role === "PRODUCTION_MANAGER").map((v) => ({ value: v.id, label: v.name }))]} />
          </div>
          <div>
            <label htmlFor="order-store">Store</label>
            <Select id="order-store" name="storeId" required value={formStoreId} onChange={setFormStoreId} placeholder="Select" options={meta.stores.map((v) => ({ value: v.id, label: v.name }))} />
          </div>
          <div><label htmlFor="order-value">Order value</label><input id="order-value" name="orderValue" type="number" min="1" required /></div>

          {/* ── Quick-create customer form ── */}
          {showNewCust && canCreateCustomer && (
            <div className="sm:col-span-2 rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <UserPlus size={15} className="text-accent-deep" />
                  New customer
                </div>
                <button
                  type="button"
                  onClick={closeNewCust}
                  className="rounded-lg p-1 text-stone-400 hover:text-ink"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="new-cust-name">Name <span className="text-red-500">*</span></label>
                  <input
                    id="new-cust-name"
                    value={newCust.name}
                    onChange={(e) => setNewCust((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Priya Sharma"
                  />
                </div>
                <div>
                  <label htmlFor="new-cust-phone">Phone <span className="text-red-500">*</span></label>
                  <input
                    id="new-cust-phone"
                    value={newCust.phone}
                    onChange={(e) => setNewCust((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label htmlFor="new-cust-email">Email <span className="font-normal text-stone-400">(optional)</span></label>
                  <input
                    id="new-cust-email"
                    type="email"
                    value={newCust.email}
                    onChange={(e) => setNewCust((p) => ({ ...p, email: e.target.value }))}
                    placeholder="priya@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="new-cust-address">Address <span className="font-normal text-stone-400">(optional)</span></label>
                  <input
                    id="new-cust-address"
                    value={newCust.address}
                    onChange={(e) => setNewCust((p) => ({ ...p, address: e.target.value }))}
                    placeholder="City, locality"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="new-cust-preferences">Preferences <span className="font-normal text-stone-400">(comma separated, optional)</span></label>
                  <input
                    id="new-cust-preferences"
                    value={newCust.preferences}
                    onChange={(e) => setNewCust((p) => ({ ...p, preferences: e.target.value }))}
                    placeholder="e.g. Anarkali, Lehenga, pastels"
                  />
                </div>
              </div>
              {custError && <div className="mt-3"><InlineMessage message={custError} /></div>}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={saveNewCustomer}
                  disabled={savingCust}
                  className="btn-primary btn-sm flex items-center gap-1.5"
                >
                  {savingCust ? "Saving…" : <><UserPlus size={13} />Save customer</>}
                </button>
                <button
                  type="button"
                  onClick={closeNewCust}
                  disabled={savingCust}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {[["bust", "Bust"], ["waist", "Waist"], ["hip", "Hip"], ["length", "Length"]].map(([n, l]) => <div key={n}><label htmlFor={`order-measure-${n}`}>{l}</label><input key={`${selectedCustId}-${n}`} id={`order-measure-${n}`} name={n} required placeholder="inches" defaultValue={stdPrefill[n] ?? ""} /></div>)}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between"><label className="mb-0">Custom measurements</label><button type="button" onClick={addCustomMeasurement} className="btn-secondary btn-sm flex items-center gap-1"><Plus size={13} />Add</button></div>
            {customMeasurements.map((cm, i) => (
              <div key={i} className="mt-2 grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4"><label className="text-xs" htmlFor={`custom-measure-name-${i}`}>Name</label><input id={`custom-measure-name-${i}`} value={cm.name} onChange={(e) => updateCustomMeasurement(i, "name", e.target.value)} placeholder="e.g. Shoulder Drop" /></div>
                <div className="col-span-3"><label className="text-xs" htmlFor={`custom-measure-value-${i}`}>Value</label><input id={`custom-measure-value-${i}`} value={cm.value} onChange={(e) => updateCustomMeasurement(i, "value", e.target.value)} placeholder="inches" /></div>
                <div className="col-span-4"><label className="text-xs" htmlFor={`custom-measure-notes-${i}`}>Notes (optional)</label><input id={`custom-measure-notes-${i}`} value={cm.notes} onChange={(e) => updateCustomMeasurement(i, "notes", e.target.value)} placeholder="e.g. at booking" /></div>
                <div className="col-span-1 flex justify-end pb-0.5"><button type="button" onClick={() => removeCustomMeasurement(i)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"><X size={14} /></button></div>
              </div>
            ))}
          </div>
          <div><label htmlFor="order-priority">Priority</label><Select id="order-priority" name="priority" defaultValue="NORMAL" searchable={false} options={[{ value: "NORMAL", label: "NORMAL" }, { value: "HIGH", label: "HIGH" }, { value: "URGENT", label: "URGENT" }]} /></div>
          <div><label htmlFor="order-delivery-date">Delivery date</label><input id="order-delivery-date" name="deliveryDate" type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} required /></div>
          <div><label htmlFor="order-advance-amount">Advance received <span className="font-normal text-stone-400">(optional)</span></label><input id="order-advance-amount" name="advanceAmount" type="number" min="1" step="1" placeholder="₹ amount" /></div>
          <div><label htmlFor="order-advance-method">Advance via</label><Select id="order-advance-method" name="advanceMethod" defaultValue="CASH" searchable={false} options={[{ value: "CASH", label: "Cash" }, { value: "UPI", label: "UPI" }, { value: "CARD", label: "Card" }, { value: "BANK_TRANSFER", label: "Bank transfer" }, { value: "CHEQUE", label: "Cheque" }, { value: "OTHER", label: "Other" }]} /></div>
          <div className="sm:col-span-2"><label htmlFor="order-customisations">Customisations (comma separated)</label><input id="order-customisations" name="customisations" /></div>
          <div className="sm:col-span-2"><label htmlFor="order-reference-images">Reference image URLs (comma separated)</label><input id="order-reference-images" name="referenceImages" placeholder="https://example.com/reference.jpg" /></div>
          {error && <div className="sm:col-span-2"><InlineMessage message={error} /></div>}
        </form>
      </Drawer>

      {pageError && <div className="mb-4"><ErrorState message={pageError} retry={load} /></div>}

      {!loading && orders.length > 0 && (
        <section className="card mb-6 p-4">
          <div className="mb-3"><QuickViews views={orderViews} value={view} onChange={setView} /></div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Search order, customer, phone or stylist" />
            <Select ariaLabel="Filter by status" value={statusFilter} onChange={setStatusFilter} className="md:w-44" options={[{ value: "ALL", label: "All statuses" }, ...["DRAFT", "CONFIRMED", "IN_PRODUCTION", "READY", "DELIVERED", "CANCELLED"].map((s) => ({ value: s, label: s.replaceAll("_", " ") }))]} />
            <Select ariaLabel="Filter by delivery health" value={delayFilter} onChange={setDelayFilter} searchable={false} className="md:w-44" options={[{ value: "ALL", label: "All delivery health" }, { value: "GREEN", label: "On track" }, { value: "YELLOW", label: "At risk" }, { value: "RED", label: "Delayed" }]} />
            <button type="button" onClick={clearFilters} disabled={!filtersActive} className="btn-ghost btn-sm whitespace-nowrap">Clear filters</button>
          </div>
          <p className="mt-3 text-xs text-stone-500">{filtered.length} of {orders.length} order{orders.length === 1 ? "" : "s"}{filtersActive ? " match these filters" : ""}.</p>
        </section>
      )}

      {loading ? <LoadingState label="Loading orders..." /> : !orders.length ? (
        <EmptyState
          icon={<ClipboardList size={22} />}
          title={canWrite ? "No orders yet" : "Nothing assigned to you"}
          message={canWrite ? "Create your first couture order to start tracking measurements, materials and delivery." : "No orders are assigned to your store or current access yet."}
          action={canWrite ? <button className="btn-primary" onClick={() => setShow(true)}>+ New order</button> : undefined}
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={<ClipboardList size={22} />}
          title="No matching orders"
          message="No orders match these filters. Clear them to see every order."
          action={<button className="btn-secondary" onClick={clearFilters}>Clear filters</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100 text-left text-[11px] font-bold uppercase tracking-wide text-stone-400">
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Value</th>
                <th className="hidden px-5 py-3 md:table-cell">Stylist</th>
                <th className="px-5 py-3">Delivery</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Health</th>
                {canDelete && <th className="w-10 px-3 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((o) => (
                <tr key={o.id} className="group">
                  <td className="px-5 py-3">
                    <Link href={`/orders/${o.id}`} className="flex items-center gap-2 hover:text-wine">
                      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[o.priority] ?? "bg-stone-300"}`} />
                      <div>
                        <p className="font-semibold text-wine group-hover:underline">{o.orderNumber}</p>
                        <p className="text-xs text-stone-400">{o.priority}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/orders/${o.id}`} className="block">
                      <p className="text-sm font-medium">{o.customer.name}</p>
                      <p className="text-xs text-stone-400">{o.customer.phone}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/orders/${o.id}`} className="block text-sm font-medium">{money(o.orderValue)}</Link>
                  </td>
                  <td className="hidden px-5 py-3 md:table-cell">
                    <Link href={`/orders/${o.id}`} className="block text-sm">{o.stylist.name}</Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/orders/${o.id}`} className="block text-sm">
                      {new Date(o.deliveryDate) < new Date() && !["DELIVERED", "CANCELLED"].includes(o.status)
                        ? <span className="font-medium text-red-600">{shortDate(o.deliveryDate)}<span className="block text-[11px] font-normal">overdue</span></span>
                        : shortDate(o.deliveryDate)}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/orders/${o.id}`} className="block"><StatusBadge value={o.status} /></Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/orders/${o.id}`} className="flex items-center gap-3">
                      <StatusBadge value={o.delayState} dot />
                      <ArrowRight size={15} className="shrink-0 text-stone-200 transition group-hover:translate-x-0.5 group-hover:text-wine" />
                    </Link>
                  </td>
                  {canDelete && (
                    <td className="px-3 py-3">
                      {isOwner ? (
                        <button
                          onClick={() => deleteOrder(o)}
                          disabled={deletingId === o.id}
                          title="Delete order"
                          className="rounded-lg p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => requestDelete(o)}
                          disabled={requestingDelete === o.id}
                          title="Request deletion"
                          className="rounded-lg p-1.5 text-stone-300 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
