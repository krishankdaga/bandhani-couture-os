"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Drawer } from "@/components/drawer";
import { Select } from "@/components/ui";
import { Download, Plus } from "lucide-react";
import { api, money, shortDate, toast } from "@/lib/client";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiveLines, setReceiveLines] = useState<Record<string, any>>({});
  const [search,setSearch]=useState(""); const [statusFilter,setStatusFilter]=useState("ALL"); const [receiptFilter,setReceiptFilter]=useState("ALL"); const [overdueOnly,setOverdueOnly]=useState(false); const [sort,setSort]=useState("NEWEST");

  const [form, setForm] = useState({
    vendorName: "",
    itemName: "",
    quantity: 1,
    unit: "pcs",
    rate: 0,
    expectedDate: "",
    notes: "",
  });

  async function load() {
    const data: any = await api("/api/purchases");
    setPurchases(data.purchases || []);
  }

  useEffect(() => {
    load();
  }, []);
  // Pre-fill the search box from ?search= (global-search deep links).
  useEffect(() => { const q = new URLSearchParams(window.location.search).get("search"); if (q) setSearch(q); }, []);
  const filteredPurchases=useMemo(()=>purchases.filter((purchase)=>{const text=`${purchase.purchaseNo} ${purchase.vendorName} ${purchase.lines?.map((line:any)=>line.itemName).join(" ")}`.toLowerCase();const pending=purchase.status!=="RECEIVED"&&purchase.status!=="CANCELLED";const overdue=pending&&purchase.expectedDate&&new Date(purchase.expectedDate)<new Date();return text.includes(search.toLowerCase())&&(statusFilter==="ALL"||purchase.status===statusFilter)&&(receiptFilter==="ALL"||(receiptFilter==="PENDING"&&pending)||(receiptFilter==="RECEIVED"&&purchase.status==="RECEIVED"))&&(!overdueOnly||overdue);}).sort((a,b)=>sort==="EXPECTED"?new Date(a.expectedDate||"2999-01-01").getTime()-new Date(b.expectedDate||"2999-01-01").getTime():sort==="AMOUNT"?Number(b.totalAmount)-Number(a.totalAmount):new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()),[purchases,search,statusFilter,receiptFilter,overdueOnly,sort]);
  function clearFilters(){setSearch("");setStatusFilter("ALL");setReceiptFilter("ALL");setOverdueOnly(false);setSort("NEWEST");}
  const receivingPurchase = useMemo(() => purchases.find((p) => p.id === receivingId), [purchases, receivingId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    await api("/api/purchases", {
      method: "POST",
      body: JSON.stringify({
        vendorName: form.vendorName,
        expectedDate: form.expectedDate || null,
        notes: form.notes,
        lines: [
          {
            itemName: form.itemName,
            quantity: form.quantity,
            unit: form.unit,
            rate: form.rate,
          },
        ],
      }),
    });

    setForm({
      vendorName: "",
      itemName: "",
      quantity: 1,
      unit: "pcs",
      rate: 0,
      expectedDate: "",
      notes: "",
    });

    setShowCreate(false);
    await load();
    toast("Purchase created.");
  }

  function startReceiving(purchase: any) {
    setReceivingId(purchase.id);

    const initial: Record<string, any> = {};
    purchase.lines.forEach((line: any) => {
      initial[line.id] = {
        purchaseLineId: line.id,
        sku: line.itemName
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 20),
        category: "OTHER",
      };
    });

    setReceiveLines(initial);
  }

  async function receivePurchase(purchase: any) {
    const lines = purchase.lines.map((line: any) => receiveLines[line.id]);

    await api(`/api/purchases/${purchase.id}/receive`, {
      method: "POST",
      body: JSON.stringify({ lines }),
    });

    setReceivingId(null);
    setReceiveLines({});
    await load();
    toast("Purchase received and inventory updated.");
  }

  return (
    <>
      <PageHeader
        eyebrow="Phase 2 unlocked"
        title="Purchases"
        description="Create purchase entries and receive stock directly into inventory."
        action={
          <div className="flex items-center gap-2">
            <a href="/api/export/purchases" className="btn-secondary flex items-center gap-2"><Download size={16} />Export CSV</a>
            <button type="button" onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus size={16} />New purchase</button>
          </div>
        }
      />
      <div className="card mb-5 p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="font-semibold">Find purchases</h2><p className="text-xs text-stone-500">Search vendors and items, then focus on receipts that need action.</p></div><button onClick={clearFilters} className="text-xs font-semibold text-wine">Clear filters</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Purchase no., vendor or item"/><Select value={statusFilter} onChange={setStatusFilter} searchable={false} ariaLabel="Filter by status" options={[{ value: "ALL", label: "All statuses" }, ...["REQUESTED","ORDERED","RECEIVED","CANCELLED"].map((item) => ({ value: item, label: item }))]} /><Select value={receiptFilter} onChange={setReceiptFilter} searchable={false} ariaLabel="Filter by receipt" options={[{ value: "ALL", label: "All receipts" }, { value: "PENDING", label: "Pending receipt" }, { value: "RECEIVED", label: "Received" }]} /><Select value={sort} onChange={setSort} searchable={false} ariaLabel="Sort" options={[{ value: "NEWEST", label: "Newest" }, { value: "EXPECTED", label: "Expected date" }, { value: "AMOUNT", label: "Amount: high to low" }]} /><label className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 normal-case tracking-normal"><input type="checkbox" className="h-4 w-4" checked={overdueOnly} onChange={(e)=>setOverdueOnly(e.target.checked)}/><span className="text-sm">Expected date overdue</span></label></div><p className="mt-3 text-xs text-stone-500">Showing {filteredPurchases.length} of {purchases.length} purchases.</p></div>

      <Drawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New purchase"
        description="Record a purchase order; receive it into inventory once it arrives."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary btn-sm">Cancel</button>
            <button form="purchase-form" className="btn-primary btn-sm flex items-center gap-1.5"><Plus size={14} />Add purchase</button>
          </div>
        }
      >
        <form id="purchase-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input label="Vendor Name" value={form.vendorName} onChange={(v) => setForm({ ...form, vendorName: v })} /></div>
          <div className="sm:col-span-2"><Input label="Item Name" value={form.itemName} onChange={(v) => setForm({ ...form, itemName: v })} /></div>
          <Input label="Quantity" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: Number(v) })} />
          <Input label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
          <Input label="Rate" type="number" value={form.rate} onChange={(v) => setForm({ ...form, rate: Number(v) })} />
          <Input label="Expected Date" type="date" value={form.expectedDate} onChange={(v) => setForm({ ...form, expectedDate: v })} />
          <div className="sm:col-span-2"><Input label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /></div>
        </form>
      </Drawer>

      <div className="grid gap-5">
        <div className="card overflow-hidden">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-lg font-semibold">Purchase Records</h2>
            <p className="text-sm text-stone-500">{filteredPurchases.length} matching records</p>
          </div>

          <div className="divide-y divide-stone-100">
            {filteredPurchases.map((purchase) => (
              <div key={purchase.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {purchase.purchaseNo} · {purchase.vendorName}
                      </h3>

                      <span
                        className={
                          purchase.status === "RECEIVED"
                            ? "rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700"
                            : "rounded-full bg-yellow-50 px-2 py-1 text-xs font-bold text-yellow-700"
                        }
                      >
                        {purchase.status}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-stone-500">
                      {purchase.expectedDate
                        ? "Expected " + shortDate(purchase.expectedDate)
                        : "No expected date"}
                      {purchase.receivedDate
                        ? " · Received " + shortDate(purchase.receivedDate)
                        : ""}
                    </p>
                  </div>

                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                    {money(purchase.totalAmount)}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {purchase.lines?.map((line: any) => (
                    <div
                      key={line.id}
                      className="rounded-xl border border-stone-100 bg-stone-50 p-3 text-sm"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-medium">{line.itemName}</span>
                        <span>
                          {String(line.quantity)} {line.unit} × {money(line.rate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {purchase.notes && (
                  <p className="mt-3 text-sm text-stone-600">{purchase.notes}</p>
                )}

                {purchase.status !== "RECEIVED" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => startReceiving(purchase)}
                      className="btn-secondary btn-sm"
                    >
                      Receive stock
                    </button>
                  </div>
                )}
              </div>
            ))}

            {filteredPurchases.length === 0 && (
              <div className="p-8 text-center text-sm text-stone-500">
                No purchases match these filters. Clear filters or add a purchase.
              </div>
            )}
          </div>
        </div>
      </div>

      <Drawer
        open={!!receivingPurchase}
        onClose={() => { setReceivingId(null); setReceiveLines({}); }}
        title="Receive stock"
        description={
          receivingPurchase
            ? `${receivingPurchase.purchaseNo} · ${receivingPurchase.vendorName}`
            : undefined
        }
        footer={
          receivingPurchase && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setReceivingId(null); setReceiveLines({}); }}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => receivePurchase(receivingPurchase)}
                className="btn-primary btn-sm"
              >
                Confirm receipt
              </button>
            </div>
          )
        }
      >
        {receivingPurchase && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-stone-100 bg-stone-50 p-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-stone-400">Expected</dt>
                <dd className="mt-1 font-medium">{receivingPurchase.expectedDate ? shortDate(receivingPurchase.expectedDate) : "—"}</dd>
              </div>
              <div className="text-right">
                <dt className="text-xs font-medium uppercase tracking-wide text-stone-400">Total</dt>
                <dd className="mt-1 font-medium">{money(receivingPurchase.totalAmount)}</dd>
              </div>
            </dl>

            <p className="text-sm text-stone-500">
              Map each purchased line to an inventory SKU and category. Confirming the receipt adds the quantities to inventory.
            </p>

            <div className="space-y-4">
              {receivingPurchase.lines?.map((line: any) => (
                <div key={line.id} className="rounded-xl border border-stone-100 p-4">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium">{line.itemName}</span>
                    <span className="text-stone-500">{String(line.quantity)} {line.unit} × {money(line.rate)}</span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Input
                      label="Inventory SKU"
                      value={receiveLines[line.id]?.sku || ""}
                      onChange={(v) =>
                        setReceiveLines((prev) => ({
                          ...prev,
                          [line.id]: { ...prev[line.id], sku: v },
                        }))
                      }
                    />
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Category</span>
                      <Select
                        className="mt-1"
                        value={receiveLines[line.id]?.category || "OTHER"}
                        onChange={(v) =>
                          setReceiveLines((prev) => ({
                            ...prev,
                            [line.id]: { ...prev[line.id], category: v },
                          }))
                        }
                        searchable={false}
                        options={["FABRIC", "FINISHED_GOOD", "ACCESSORY", "PACKAGING", "OTHER"].map((c) => ({ value: c, label: c }))}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
