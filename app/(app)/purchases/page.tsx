"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Download } from "lucide-react";
import { api, money, shortDate, toast } from "@/lib/client";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
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
  const filteredPurchases=useMemo(()=>purchases.filter((purchase)=>{const text=`${purchase.purchaseNo} ${purchase.vendorName} ${purchase.lines?.map((line:any)=>line.itemName).join(" ")}`.toLowerCase();const pending=purchase.status!=="RECEIVED"&&purchase.status!=="CANCELLED";const overdue=pending&&purchase.expectedDate&&new Date(purchase.expectedDate)<new Date();return text.includes(search.toLowerCase())&&(statusFilter==="ALL"||purchase.status===statusFilter)&&(receiptFilter==="ALL"||(receiptFilter==="PENDING"&&pending)||(receiptFilter==="RECEIVED"&&purchase.status==="RECEIVED"))&&(!overdueOnly||overdue);}).sort((a,b)=>sort==="EXPECTED"?new Date(a.expectedDate||"2999-01-01").getTime()-new Date(b.expectedDate||"2999-01-01").getTime():sort==="AMOUNT"?Number(b.totalAmount)-Number(a.totalAmount):new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()),[purchases,search,statusFilter,receiptFilter,overdueOnly,sort]);
  function clearFilters(){setSearch("");setStatusFilter("ALL");setReceiptFilter("ALL");setOverdueOnly(false);setSort("NEWEST");}

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
        action={<a href="/api/export/purchases" className="btn-secondary flex items-center gap-2"><Download size={16} />Export CSV</a>}
      />
      <div className="card mb-5 p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="font-semibold">Find purchases</h2><p className="text-xs text-stone-500">Search vendors and items, then focus on receipts that need action.</p></div><button onClick={clearFilters} className="text-xs font-semibold text-wine">Clear filters</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Purchase no., vendor or item"/><select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="ALL">All statuses</option>{["REQUESTED","ORDERED","RECEIVED","CANCELLED"].map((item)=><option key={item}>{item}</option>)}</select><select value={receiptFilter} onChange={(e)=>setReceiptFilter(e.target.value)}><option value="ALL">All receipts</option><option value="PENDING">Pending receipt</option><option value="RECEIVED">Received</option></select><select value={sort} onChange={(e)=>setSort(e.target.value)}><option value="NEWEST">Newest</option><option value="EXPECTED">Expected date</option><option value="AMOUNT">Amount: high to low</option></select><label className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 normal-case tracking-normal"><input type="checkbox" className="h-4 w-4" checked={overdueOnly} onChange={(e)=>setOverdueOnly(e.target.checked)}/><span className="text-sm">Expected date overdue</span></label></div><p className="mt-3 text-xs text-stone-500">Showing {filteredPurchases.length} of {purchases.length} purchases.</p></div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">New Purchase</h2>

          <Input
            label="Vendor Name"
            value={form.vendorName}
            onChange={(v) => setForm({ ...form, vendorName: v })}
          />

          <Input
            label="Item Name"
            value={form.itemName}
            onChange={(v) => setForm({ ...form, itemName: v })}
          />

          <Input
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(v) => setForm({ ...form, quantity: Number(v) })}
          />

          <Input
            label="Unit"
            value={form.unit}
            onChange={(v) => setForm({ ...form, unit: v })}
          />

          <Input
            label="Rate"
            type="number"
            value={form.rate}
            onChange={(v) => setForm({ ...form, rate: Number(v) })}
          />

          <Input
            label="Expected Date"
            type="date"
            value={form.expectedDate}
            onChange={(v) => setForm({ ...form, expectedDate: v })}
          />

          <Input
            label="Notes"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
          />

          <button className="w-full rounded-xl bg-wine px-4 py-2 text-sm font-semibold text-white">
            Add Purchase
          </button>
        </form>

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

                      {receivingId === purchase.id && (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Input
                            label="Inventory SKU"
                            value={receiveLines[line.id]?.sku || ""}
                            onChange={(v) =>
                              setReceiveLines((prev) => ({
                                ...prev,
                                [line.id]: {
                                  ...prev[line.id],
                                  sku: v,
                                },
                              }))
                            }
                          />

                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                              Category
                            </span>
                            <select
                              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                              value={receiveLines[line.id]?.category || "OTHER"}
                              onChange={(e) =>
                                setReceiveLines((prev) => ({
                                  ...prev,
                                  [line.id]: {
                                    ...prev[line.id],
                                    category: e.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="FABRIC">FABRIC</option>
                              <option value="FINISHED_GOOD">FINISHED_GOOD</option>
                              <option value="ACCESSORY">ACCESSORY</option>
                              <option value="PACKAGING">PACKAGING</option>
                              <option value="OTHER">OTHER</option>
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {purchase.notes && (
                  <p className="mt-3 text-sm text-stone-600">{purchase.notes}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {purchase.status !== "RECEIVED" && receivingId !== purchase.id && (
                    <button
                      onClick={() => startReceiving(purchase)}
                      className="rounded-xl border px-3 py-2 text-sm"
                    >
                      Receive Stock
                    </button>
                  )}

                  {receivingId === purchase.id && (
                    <>
                      <button
                        onClick={() => receivePurchase(purchase)}
                        className="rounded-xl bg-wine px-3 py-2 text-sm font-semibold text-white"
                      >
                        Receive Stock
                      </button>

                      <button
                        onClick={() => {
                          setReceivingId(null);
                          setReceiveLines({});
                        }}
                        className="rounded-xl border px-3 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
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
        className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-wine"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
