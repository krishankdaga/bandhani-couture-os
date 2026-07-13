"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Download, MapPin, Plus, Save, Users, UserSquare } from "lucide-react";
import { EmptyState, ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { StatCard, SearchInput, Select } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { api, toast } from "@/lib/client";

type Store = { id: string; name: string };
type Customer = {
  id: string; name: string; phone: string; email: string | null; address: string | null;
  storeId: string; preferences: string[] | null; store: { name: string } | null;
  _count?: { orders: number; interactions: number };
};
const blank = { name: "", phone: "", email: "", address: "", storeId: "", preferences: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadCustomers(q = "") {
    const data = await api<{ customers: Customer[] }>(`/api/customers${q ? `?search=${encodeURIComponent(q)}` : ""}`);
    setCustomers(data.customers || []);
  }

  async function loadAll() {
    setLoading(true); setError("");
    try {
      const [meta, session] = await Promise.all([
        api<{ stores: Store[] }>("/api/meta"),
        api<{ user: { permissions: string[] } }>("/api/auth/me"),
      ]);
      setStores(meta.stores || []);
      setPermissions(session.user.permissions || []);
      await loadCustomers("");
    } catch (caught) { setError((caught as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  // Debounced server-side search.
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => { loadCustomers(search).catch((e) => setError((e as Error).message)); }, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditingId(null);
    setForm({ ...blank, storeId: stores[0]?.id ?? "" });
    setFormError(""); setShowForm(true);
  }
  function openEdit(customer: Customer) {
    setEditingId(customer.id);
    setForm({
      name: customer.name ?? "", phone: customer.phone ?? "", email: customer.email ?? "",
      address: customer.address ?? "", storeId: customer.storeId || stores[0]?.id || "",
      preferences: Array.isArray(customer.preferences) ? customer.preferences.join(", ") : "",
    });
    setFormError(""); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditingId(null); setForm(blank); setFormError(""); }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      await api(editingId ? `/api/customers/${editingId}` : "/api/customers", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      const wasEditing = Boolean(editingId);
      closeForm();
      await loadCustomers(search);
      toast(wasEditing ? "Customer updated." : "Customer created.");
    } catch (caught) { setFormError((caught as Error).message); } finally { setSaving(false); }
  }

  const stats = useMemo(() => ({
    total: customers.length,
    withAddress: customers.filter((c) => c.address).length,
    withOrders: customers.filter((c) => (c._count?.orders ?? 0) > 0).length,
  }), [customers]);
  const canCreate = permissions.includes("customers.create");
  const canEdit = permissions.includes("customers.edit");

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Customers"
        description="Add, search and edit customer contact details, preferences and addresses."
        action={
          <div className="flex items-center gap-2">
            <a href="/api/export/customers" className="btn-secondary flex items-center gap-2"><Download size={16} />Export CSV</a>
            {canCreate && <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} />Add customer</button>}
          </div>
        }
      />

      {loading ? <LoadingState label="Loading customers..." rows={3} /> : error && !customers.length ? <ErrorState message={error} retry={loadAll} /> : (
        <>
          <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Visible customers" value={stats.total} icon={Users} />
            <StatCard label="With address" value={stats.withAddress} icon={MapPin} />
            <StatCard label="With orders" value={stats.withOrders} icon={ClipboardList} />
          </section>

          <div className="card mb-5 p-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, email or address" />
            <p className="mt-3 text-xs text-stone-500">{customers.length} {customers.length === 1 ? "customer" : "customers"}{search ? " match this search" : ""}.</p>
          </div>

          {customers.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {customers.map((customer) => (
                <div key={customer.id} className="card card-hover flex flex-col p-5">
                  <Link href={`/customers/${customer.id}`} className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{customer.name}</p>
                        <p className="mt-0.5 truncate text-xs text-stone-500">{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">{customer.store?.name || "No store"}</span>
                    </div>
                    {customer.address && <p className="mt-3 line-clamp-2 rounded-lg bg-sand px-3 py-2 text-xs text-stone-600">{customer.address}</p>}
                    {customer.preferences && customer.preferences.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {customer.preferences.map((pref) => <span key={pref} className="rounded-full bg-wine/10 px-2.5 py-0.5 text-[11px] font-semibold text-wine">{pref}</span>)}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
                      <span>{customer._count?.orders ?? 0} orders</span><span>·</span><span>{customer._count?.interactions ?? 0} interactions</span>
                    </div>
                  </Link>
                  <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                    {canEdit ? <button onClick={() => openEdit(customer)} className="text-xs font-semibold text-wine hover:underline">Edit contact</button> : <span />}
                    <Link href={`/customers/${customer.id}`} className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-accent-deep"><UserSquare size={14} />View summary</Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users size={22} />}
              title={search ? "No matching customers" : "No customers yet"}
              message={search ? "No customers match this search." : canCreate ? "Add your first customer to start capturing preferences, measurements and orders." : "No customers are visible for your current access."}
              action={canCreate && !search ? <button className="btn-primary" onClick={openCreate}>+ Add customer</button> : undefined}
            />
          )}
        </>
      )}

      <Drawer
        open={showForm}
        onClose={closeForm}
        title={editingId ? "Edit customer" : "New customer"}
        description="Customer contact details, store and preferences"
        width="max-w-2xl"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {editingId && <Link href={`/customers/${editingId}`} className="btn-secondary btn-sm mr-auto flex items-center gap-1.5"><UserSquare size={15} />View summary</Link>}
            <button type="button" onClick={closeForm} className="btn-secondary btn-sm">Cancel</button>
            <button form="customer-form" disabled={saving} className="btn-primary btn-sm flex items-center gap-1.5"><Save size={15} />{saving ? "Saving..." : editingId ? "Save customer" : "Add customer"}</button>
          </div>
        }
      >
        <form id="customer-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label>Customer name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Priya Sharma" /></div>
          <div><label>Phone</label><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></div>
          <div><label>Email <span className="font-normal text-stone-400">(optional)</span></label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="priya@example.com" /></div>
          <div className="sm:col-span-2"><label>Store</label><Select value={form.storeId} onChange={(v) => setForm({ ...form, storeId: v })} placeholder="Select a store" options={stores.map((store) => ({ value: store.id, label: store.name }))} /></div>
          <div className="sm:col-span-2"><label>Address <span className="font-normal text-stone-400">(optional)</span></label><textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full customer address" /></div>
          <div className="sm:col-span-2"><label>Preferences <span className="font-normal text-stone-400">(comma separated)</span></label><input value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} placeholder="bridal, red, lehenga, high value" /></div>
          {formError && <div className="sm:col-span-2"><InlineMessage message={formError} /></div>}
        </form>
      </Drawer>
    </>
  );
}
