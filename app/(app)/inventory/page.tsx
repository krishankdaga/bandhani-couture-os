"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Download, Plus } from "lucide-react";
import { api, money, toast } from "@/lib/client";
import { useConfirm } from "@/components/confirm-dialog";
import { Drawer } from "@/components/drawer";

const categories = ["FABRIC", "FINISHED_GOOD", "ACCESSORY", "PACKAGING", "OTHER"];
const UNITS = ["metres", "yards", "pcs", "rolls", "kg", "grams", "litres", "sets", "pairs"];

export default function InventoryPage() {
  const { confirm } = useConfirm();
  const [items, setItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [movementItemId, setMovementItemId] = useState<string | null>(null);
  const [search, setSearch] = useState(""); const [categoryFilter, setCategoryFilter] = useState("ALL"); const [lowOnly, setLowOnly] = useState(false); const [movementFilter, setMovementFilter] = useState("ALL"); const [sort, setSort] = useState("NEWEST");

  const [form, setForm] = useState<any>({
    sku: "",
    name: "",
    category: "FABRIC",
    quantity: 0,
    unit: "metres",
    reorderAt: "",
    costPrice: "",
    sellingPrice: "",
    notes: "",
  });

  const [movement, setMovement] = useState<any>({
    type: "IN",
    quantity: 1,
    reason: "",
    reference: "",
  });

  async function load() {
    const data: any = await api("/api/inventory");
    setItems(data.items || []);
  }

  useEffect(() => {
    load();
  }, []);
  // Pre-fill the search box from ?search= (global-search deep links).
  useEffect(() => { const q = new URLSearchParams(window.location.search).get("search"); if (q) setSearch(q); }, []);
  const filteredItems = useMemo(() => items.filter((item) => {
    const text = `${item.sku} ${item.name} ${item.category}`.toLowerCase();
    const low = item.reorderAt != null && Number(item.quantity) <= Number(item.reorderAt);
    const movementMatch = movementFilter === "ALL" || item.movements?.some((entry:any) => entry.type === movementFilter);
    return text.includes(search.toLowerCase()) && (categoryFilter === "ALL" || item.category === categoryFilter) && (!lowOnly || low) && movementMatch;
  }).sort((a,b) => sort === "NAME" ? a.name.localeCompare(b.name) : sort === "QUANTITY" ? Number(a.quantity)-Number(b.quantity) : sort === "VALUE" ? Number(b.quantity)*Number(b.costPrice||0)-Number(a.quantity)*Number(a.costPrice||0) : new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()), [items, search, categoryFilter, lowOnly, movementFilter, sort]);

  function resetForm() {
    setEditingId(null);
    setForm({
      sku: "",
      name: "",
      category: "FABRIC",
      quantity: 0,
      unit: "metres",
      reorderAt: "",
      costPrice: "",
      sellingPrice: "",
      notes: "",
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      ...form,
      reorderAt: form.reorderAt === "" ? null : Number(form.reorderAt),
      costPrice: form.costPrice === "" ? null : Number(form.costPrice),
      sellingPrice: form.sellingPrice === "" ? null : Number(form.sellingPrice),
    };

    if (editingId) {
      delete payload.quantity;
      await api(`/api/inventory/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/inventory", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    const wasEditing = Boolean(editingId);
    resetForm();
    setFormOpen(false);
    await load();
    toast(wasEditing ? "Inventory item updated." : "Inventory item created.");
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function closeForm() {
    resetForm();
    setFormOpen(false);
  }

  function editItem(item: any) {
    setEditingId(item.id);
    setFormOpen(true);
    setForm({
      sku: item.sku,
      name: item.name,
      category: item.category,
      quantity: Number(item.quantity || 0),
      unit: item.unit,
      reorderAt: item.reorderAt ?? "",
      costPrice: item.costPrice ?? "",
      sellingPrice: item.sellingPrice ?? "",
      notes: item.notes ?? "",
    });
  }

  async function deleteItem(id: string) {
    if (!(await confirm({ title: "Delete inventory item?", message: "This permanently removes the item and its stock record. This cannot be undone.", confirmLabel: "Delete", tone: "danger" }))) return;

    await api(`/api/inventory/${id}`, {
      method: "DELETE",
    });

    await load();
    toast("Inventory item deleted.");
  }

  async function saveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movementItemId) return;

    await api(`/api/inventory/${movementItemId}/movement`, {
      method: "POST",
      body: JSON.stringify(movement),
    });

    setMovementItemId(null);
    setMovement({
      type: "IN",
      quantity: 1,
      reason: "",
      reference: "",
    });

    await load();
    toast("Stock movement recorded.");
  }

  const movementItem = items.find((i) => i.id === movementItemId);

  return (
    <>
      <PageHeader
        eyebrow="Phase 2 unlocked"
        title="Inventory"
        description="Track fabrics, accessories, packaging and finished stock."
        action={
          <div className="flex items-center gap-2">
            <a href="/api/export/inventory" className="btn-secondary flex items-center gap-2"><Download size={16} />Export CSV</a>
            <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} />Add item</button>
          </div>
        }
      />
      <div className="card mb-5 p-4"><div className="mb-3"><h2 className="font-semibold">Find inventory</h2><p className="text-xs text-stone-500">Search stock, focus on low quantities, or sort by value.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search SKU, name or category"/><select value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)}><option value="ALL">All categories</option>{categories.map((item)=><option key={item}>{item}</option>)}</select><select value={movementFilter} onChange={(e)=>setMovementFilter(e.target.value)}><option value="ALL">All movements</option><option value="IN">Stock In</option><option value="OUT">Stock Out</option><option value="ADJUSTMENT">Adjustment</option></select><select value={sort} onChange={(e)=>setSort(e.target.value)}><option value="NEWEST">Newest</option><option value="NAME">Name</option><option value="QUANTITY">Quantity: low to high</option><option value="VALUE">Stock value: high to low</option></select><label className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 normal-case tracking-normal"><input type="checkbox" className="h-4 w-4" checked={lowOnly} onChange={(e)=>setLowOnly(e.target.checked)}/><span className="text-sm">Low stock only</span></label></div><p className="mt-3 text-xs text-stone-500">Showing {filteredItems.length} of {items.length} items.</p></div>

      <div className="card overflow-hidden">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-lg font-semibold">Records</h2>
            <p className="text-sm text-stone-500">{filteredItems.length} matching records</p>
          </div>

          <div className="divide-y divide-stone-100">
            {filteredItems.map((item) => {
              const lowStock =
                item.reorderAt !== null &&
                item.reorderAt !== undefined &&
                Number(item.quantity) <= Number(item.reorderAt);

              return (
                <div key={item.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.name}</h3>
                        {lowStock && (
                          <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                            LOW STOCK
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-stone-500">
                        {item.sku} · {item.category}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
                        {String(item.quantity)} {item.unit} on hand
                      </span>
                      {Number(item.shortage) > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                          SHORT {Number(item.shortage)} {item.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 rounded-xl bg-stone-50 p-3 text-sm md:grid-cols-3">
                    <p><span className="text-stone-400">Reserved:</span> <span className="font-semibold">{Number(item.reserved ?? 0)} {item.unit}</span></p>
                    <p><span className="text-stone-400">Available:</span> <span className={`font-semibold ${Number(item.available ?? 0) < 0 ? "text-amber-700" : "text-emerald-700"}`}>{Number(item.available ?? 0)} {item.unit}</span></p>
                    <p><span className="text-stone-400">Consumed:</span> <span className="font-semibold">{Number(item.consumed ?? 0)} {item.unit}</span></p>
                  </div>

                  <div className="mt-2 grid gap-2 text-sm text-stone-600 md:grid-cols-3">
                    <p>Reorder: {item.reorderAt ?? "—"}</p>
                    <p>Cost: {item.costPrice ? money(item.costPrice) : "—"}</p>
                    <p>Selling: {item.sellingPrice ? money(item.sellingPrice) : "—"}</p>
                  </div>

                  {item.notes && <p className="mt-3 text-sm text-stone-600">{item.notes}</p>}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => editItem(item)} className="btn-secondary btn-sm">
                      Edit
                    </button>
                    <button onClick={() => setMovementItemId(item.id)} className="btn-secondary btn-sm">
                      Stock in / out
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="btn-danger btn-sm">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="p-8 text-center text-sm text-stone-500">No inventory matches these filters. Clear filters or add a new item.</div>
            )}
          </div>
      </div>

      <Drawer
        open={formOpen}
        onClose={closeForm}
        title={editingId ? "Edit item" : "New inventory item"}
        description={editingId ? "Update item details. Adjust quantity via Stock in / out." : "Add a fabric, accessory, packaging or finished item."}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="btn-secondary btn-sm">Cancel</button>
            <button form="inventory-form" className="btn-primary btn-sm flex items-center gap-1.5"><Plus size={14} />{editingId ? "Save changes" : "Add item"}</button>
          </div>
        }
      >
        <form id="inventory-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Input label="SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
          <Input label="Item Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Category</span>
            <select className="mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Unit</span>
            <select className="mt-1" value={UNITS.includes(form.unit) ? form.unit : "pcs"} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          {!editingId && <Input label="Opening Quantity" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: Number(v) })} />}
          <Input label="Reorder Level" type="number" value={form.reorderAt} onChange={(v) => setForm({ ...form, reorderAt: v })} />
          <Input label="Cost Price" type="number" value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: v })} />
          <Input label="Selling Price" type="number" value={form.sellingPrice} onChange={(v) => setForm({ ...form, sellingPrice: v })} />
          <div className="sm:col-span-2"><Input label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /></div>
        </form>
      </Drawer>

      <Drawer
        open={!!movementItemId}
        onClose={() => setMovementItemId(null)}
        title="Stock movement"
        description={movementItem ? `${movementItem.sku} · ${movementItem.name}` : undefined}
        footer={<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setMovementItemId(null)}>Cancel</button><button form="movement-form" className="btn-primary">Save movement</button></div>}
      >
        {movementItem && (
          <>
            <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-3 text-sm">
              <p><span className="text-stone-400">On hand</span><br /><span className="numeral text-lg">{Number(movementItem.quantity)}</span> {movementItem.unit}</p>
              <p><span className="text-stone-400">Available</span><br /><span className={`numeral text-lg ${Number(movementItem.available ?? 0) < 0 ? "text-amber-700" : "text-emerald-700"}`}>{Number(movementItem.available ?? 0)}</span> {movementItem.unit}</p>
              <p><span className="text-stone-400">Reserved</span><br /><span className="numeral text-lg">{Number(movementItem.reserved ?? 0)}</span> {movementItem.unit}</p>
            </div>
            <form id="movement-form" onSubmit={saveMovement} className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="movement-type">Type</label><select id="movement-type" value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value })}><option value="IN">Stock In</option><option value="OUT">Stock Out</option><option value="ADJUSTMENT">Adjustment</option></select></div>
              <div><label htmlFor="movement-qty">Quantity</label><input id="movement-qty" type="number" placeholder="Quantity" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: Number(e.target.value) })} /></div>
              <div className="sm:col-span-2"><label htmlFor="movement-reason">Reason</label><input id="movement-reason" placeholder="Reason" value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} /></div>
              <div className="sm:col-span-2"><label htmlFor="movement-ref">Reference <span className="font-normal text-stone-400">(optional)</span></label><input id="movement-ref" placeholder="Reference" value={movement.reference} onChange={(e) => setMovement({ ...movement, reference: e.target.value })} /></div>
            </form>
          </>
        )}
      </Drawer>
    </>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: any;
  onChange: (value: any) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </span>
      <input
        type={type}
        className="mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
