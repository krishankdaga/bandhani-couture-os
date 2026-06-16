"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Download } from "lucide-react";
import { api, toast } from "@/lib/client";
import Link from "next/link";

type Store = {
  id: string;
  name: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    storeId: "",
    preferences: "",
  });

  async function loadCustomers(q = search) {
    const data: any = await api(`/api/customers${q ? `?search=${encodeURIComponent(q)}` : ""}`);
    setCustomers(data.customers || []);
  }

  async function loadMeta() {
    const [data, session]: any[] = await Promise.all([api("/api/meta"), api("/api/auth/me")]);
    setPermissions(session.user.permissions || []);
    const loadedStores = data.stores || [];
    setStores(loadedStores);

    if (!form.storeId && loadedStores[0]) {
      setForm((prev) => ({ ...prev, storeId: loadedStores[0].id }));
    }
  }

  useEffect(() => {
    loadMeta();
    loadCustomers("");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      storeId: stores[0]?.id || "",
      preferences: "",
    });
  }

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();

    if (editingId) {
      await api(`/api/customers/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
    } else {
      await api("/api/customers", {
        method: "POST",
        body: JSON.stringify(form),
      });
    }

    const wasEditing = Boolean(editingId);
    resetForm();
    await loadCustomers();
    toast(wasEditing ? "Customer updated." : "Customer created.");
  }

  function editCustomer(customer: any) {
    setEditingId(customer.id);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      storeId: customer.storeId || stores[0]?.id || "",
      preferences: Array.isArray(customer.preferences)
        ? customer.preferences.join(", ")
        : "",
    });
  }

  const stats = useMemo(() => {
    return {
      total: customers.length,
      withAddress: customers.filter((c) => c.address).length,
      withOrders: customers.filter((c) => c._count?.orders > 0).length,
    };
  }, [customers]);
  const canCreate = permissions.includes("customers.create");
  const canEdit = permissions.includes("customers.edit");

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Customers"
        description="Add, search and edit customer contact details, preferences and addresses."
        action={<a href="/api/export/customers" className="btn-secondary flex items-center gap-2"><Download size={16} />Export CSV</a>}
      />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <Kpi label="Visible Customers" value={stats.total} />
        <Kpi label="With Address" value={stats.withAddress} />
        <Kpi label="With Orders" value={stats.withOrders} />
      </div>

      <div className={`grid gap-5 ${canCreate||canEdit?"xl:grid-cols-[420px_1fr]":""}`}>
        {(canCreate || (canEdit && editingId)) && <form onSubmit={saveCustomer} className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit Customer" : "Add Customer"}
            </h2>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-stone-500"
              >
                Cancel
              </button>
            )}
          </div>

          <Input
            label="Customer Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />

          <Input
            label="Phone"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
          />

          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Address
            </span>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-wine"
              placeholder="Full customer address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Store
            </span>
            <select
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-wine"
              value={form.storeId}
              onChange={(e) => setForm({ ...form, storeId: e.target.value })}
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Preferences"
            placeholder="bridal, red, lehenga, high value"
            value={form.preferences}
            onChange={(v) => setForm({ ...form, preferences: v })}
          />

          <button className="w-full rounded-xl bg-wine px-4 py-2 text-sm font-semibold text-white">
            {editingId ? "Update Customer" : "Save Customer"}
          </button>
        </form>}

        <div className="card overflow-hidden">
          <div className="border-b border-stone-100 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Customer Records</h2>
                <p className="text-sm text-stone-500">{customers.length} records</p>
              </div>

              <input
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-wine md:w-80"
                placeholder="Search name, phone, email or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="divide-y divide-stone-100">
            {customers.map((customer) => (
              <div key={customer.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{customer.name}</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {customer.phone}
                      {customer.email ? ` · ${customer.email}` : ""}
                    </p>
                  </div>

                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
                    {customer.store?.name || "No store"}
                  </span>
                </div>

                {customer.address && (
                  <p className="mt-3 rounded-xl bg-sand p-3 text-sm text-stone-700">
                    {customer.address}
                  </p>
                )}

                {customer.preferences?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customer.preferences.map((pref: string) => (
                      <span
                        key={pref}
                        className="rounded-full bg-wine/10 px-3 py-1 text-xs font-semibold text-wine"
                      >
                        {pref}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 text-sm text-stone-500">
                  <span>{customer._count?.orders || 0} orders</span>
                  <span>·</span>
                  <span>{customer._count?.interactions || 0} interactions</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {canEdit && <button
                    onClick={() => editCustomer(customer)}
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    Edit Contact
                  </button>}
                  <Link href={`/customers/${customer.id}`} className="rounded-xl border px-3 py-2 text-sm">View summary</Link>
                </div>
              </div>
            ))}

            {customers.length === 0 && (
              <div className="p-8 text-center text-sm text-stone-500">
                {canCreate ? "No customers found. Add the first customer using the form." : "No customers are visible for your store or current access."}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: any;
  onChange: (value: any) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-wine"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
