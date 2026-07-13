"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Phone, Plus, Save, Truck, UserSquare } from "lucide-react";
import { EmptyState, ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Drawer } from "@/components/drawer";
import { SearchInput, Select } from "@/components/ui";
import { api, toast } from "@/lib/client";

type Vendor = { id: string; name: string; phone: string | null; panNo: string | null; address: string | null; email: string | null; notes: string | null; active: boolean };
const blank = { name: "", phone: "", panNo: "", address: "", email: "", notes: "", active: true };

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => vendors.filter((v) => `${v.name} ${v.phone ?? ""} ${v.panNo ?? ""} ${v.email ?? ""}`.toLowerCase().includes(search.toLowerCase())),
    [vendors, search],
  );

  async function load(select?: string) {
    setLoading(true); setError("");
    try {
      const [result, session] = await Promise.all([
        api<{ vendors: Vendor[] }>("/api/vendors"),
        api<{ user: { permissions: string[] } }>("/api/auth/me"),
      ]);
      setVendors(result.vendors);
      setPermissions(session.user.permissions);
      if (select) { const found = result.vendors.find((v) => v.id === select); if (found) choose(found); }
    } catch (caught) { setError((caught as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function choose(vendor: Vendor | null) {
    setSelectedId(vendor?.id ?? null); setError("");
    if (!vendor) { setForm(blank); return; }
    setForm({ name: vendor.name, phone: vendor.phone ?? "", panNo: vendor.panNo ?? "", address: vendor.address ?? "", email: vendor.email ?? "", notes: vendor.notes ?? "", active: vendor.active });
  }
  function openCreate() { choose(null); setShowForm(true); }
  function openEdit(vendor: Vendor) { choose(vendor); setShowForm(true); }
  function closeForm() { setShowForm(false); setSelectedId(null); setForm(blank); setError(""); }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const result = await api<{ vendor: Vendor }>(selectedId ? `/api/vendors/${selectedId}` : "/api/vendors", { method: selectedId ? "PATCH" : "POST", body: JSON.stringify(form) });
      toast(selectedId ? "Vendor updated." : "Vendor added.");
      closeForm();
      await load(result.vendor.id);
    } catch (caught) { setError((caught as Error).message); } finally { setSaving(false); }
  }

  const canCreate = permissions.includes("vendors.create");
  const canEdit = permissions.includes("vendors.edit");

  return <>
    <PageHeader eyebrow="Administration" title="Vendors" description="Dyers, tailors, embroiderers and suppliers — contact details, PAN and address." action={canCreate ? <button className="btn-primary flex items-center gap-2" onClick={openCreate}><Plus size={16} />Add vendor</button> : undefined} />

    {loading ? <LoadingState label="Loading vendors..." /> : error && !vendors.length ? <ErrorState message={error} retry={() => load()} /> : <>
      <div className="card mb-5 p-4"><SearchInput value={search} onChange={setSearch} placeholder="Search vendors by name, phone, PAN or email" /><p className="mt-3 text-xs text-stone-500">{filtered.length} of {vendors.length} {vendors.length === 1 ? "vendor" : "vendors"}.</p></div>

      {filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((vendor) => (
            <div key={vendor.id} className="card card-hover flex flex-col p-5">
              <Link href={`/vendors/${vendor.id}`} className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{vendor.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-stone-500"><Phone size={12} />{vendor.phone || "No phone"}</p>
                  </div>
                  <StatusBadge value={vendor.active ? "ACTIVE" : "INACTIVE"} />
                </div>
                <div className="mt-3 space-y-1 text-xs text-stone-500">
                  {vendor.panNo && <p>PAN · <span className="font-medium text-stone-700">{vendor.panNo}</span></p>}
                  {vendor.address && <p className="line-clamp-2">{vendor.address}</p>}
                </div>
              </Link>
              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                {canEdit ? <button onClick={() => openEdit(vendor)} className="text-xs font-semibold text-wine hover:underline">Edit details</button> : <span />}
                <Link href={`/vendors/${vendor.id}`} className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-accent-deep"><UserSquare size={14} />Profile</Link>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={<Truck size={22} />} title={vendors.length ? "No matching vendors" : "No vendors yet"} message={vendors.length ? "No vendors match this search." : "Add your dyers, tailors and suppliers to keep their contact details in one place."} action={canCreate && !vendors.length ? <button className="btn-primary" onClick={openCreate}>+ Add vendor</button> : undefined} />}
    </>}

    <Drawer
      open={showForm}
      onClose={closeForm}
      title={selectedId ? "Edit vendor" : "New vendor"}
      description="Vendor contact details and identification"
      width="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {selectedId && <Link href={`/vendors/${selectedId}`} className="btn-secondary btn-sm mr-auto flex items-center gap-1.5"><UserSquare size={15} />View profile</Link>}
          <button type="button" onClick={closeForm} className="btn-secondary btn-sm">Cancel</button>
          <button form="vendor-form" disabled={saving} className="btn-primary btn-sm flex items-center gap-1.5"><Save size={15} />{saving ? "Saving..." : selectedId ? "Save vendor" : "Add vendor"}</button>
        </div>
      }
    >
      <form id="vendor-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label htmlFor="vendor-name">Vendor name</label><input id="vendor-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rajasthan Dyers" /></div>
        <div><label htmlFor="vendor-phone">Phone</label><input id="vendor-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></div>
        <div><label htmlFor="vendor-pan">PAN number</label><input id="vendor-pan" value={form.panNo} onChange={(e) => setForm({ ...form, panNo: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" /></div>
        <div><label htmlFor="vendor-email">Email <span className="font-normal text-stone-400">(optional)</span></label><input id="vendor-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vendor@example.com" /></div>
        <div><label htmlFor="vendor-status">Status</label><Select id="vendor-status" value={form.active ? "ACTIVE" : "INACTIVE"} onChange={(v) => setForm({ ...form, active: v === "ACTIVE" })} searchable={false} options={[{ value: "ACTIVE", label: "ACTIVE" }, { value: "INACTIVE", label: "INACTIVE" }]} /></div>
        <div className="sm:col-span-2"><label htmlFor="vendor-address">Address</label><textarea id="vendor-address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Workshop / billing address" /></div>
        <div className="sm:col-span-2"><label htmlFor="vendor-notes">Notes <span className="font-normal text-stone-400">(optional)</span></label><textarea id="vendor-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. specialises in natural-dye bandhani; 7-day turnaround" /></div>
        {error && <div className="sm:col-span-2"><InlineMessage message={error} /></div>}
      </form>
    </Drawer>
  </>;
}
