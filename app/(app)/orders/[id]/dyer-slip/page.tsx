"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { api, shortDate } from "@/lib/client";
import { ErrorState, LoadingState } from "@/components/async-state";

type SlipMaterial = {
  name: string; sku: string; unit: string; category: string;
  requiredQty: number; note: string | null;
  dyeColour: string | null; dyeInstructions: string | null;
};

type Slip = {
  order: {
    orderNumber: string; priority: string; deliveryDate: string; status: string;
    customisations: string[];
    customer: { name: string; phone: string };
    store: { name: string };
    stylist: { name: string };
  };
  materials: SlipMaterial[];
  generatedAt: string;
};

export default function DyerSlipPage() {
  const { id } = useParams<{ id: string }>();
  const [slip, setSlip] = useState<Slip | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await api<{ slip: Slip }>(`/api/orders/${id}/dyer-slip`);
      setSlip(result.slip);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState label="Loading dyer slip…" />;
  if (error || !slip) return <ErrorState message={error || "Order not found."} retry={load} />;

  const { order, materials, generatedAt } = slip;
  const isUrgent = order.priority !== "NORMAL";
  const fabricMaterials = materials.filter((m) => m.category === "FABRIC");
  const otherMaterials = materials.filter((m) => m.category !== "FABRIC");
  const slipMaterials = fabricMaterials.length > 0
    ? [...fabricMaterials, ...otherMaterials]
    : materials;

  const dateStr = new Date(generatedAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const timeStr = new Date(generatedAt).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div>
      {/* Toolbar — hidden on print */}
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/orders/${id}`} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={15} /> Back to order
        </Link>
        <div className="flex items-center gap-3">
          {materials.length === 0 && (
            <p className="text-sm text-amber-700">No materials allocated — slip will be empty.</p>
          )}
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
            <Printer size={15} /> Print Dyer Slip
          </button>
        </div>
      </div>

      {/* Slip document — max-w-2xl on screen, full-width on print */}
      <div className="dyer-slip-doc mx-auto max-w-2xl rounded-xl border-2 border-stone-300 bg-white p-10 shadow-lg">

        {/* ── HEADER ── */}
        <div className="mb-6 border-b-2 border-black pb-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500">
            Bandhani / Siddhartha Daga Couture
          </p>
          <h1 className="mt-1 text-[22px] font-bold uppercase tracking-widest text-black">
            Dyer Slip
          </h1>
          {isUrgent && (
            <p className="mt-2 inline-block border-2 border-black px-3 py-0.5 text-[11px] font-black uppercase tracking-widest">
              ⚠ {order.priority} PRIORITY
            </p>
          )}
        </div>

        {/* ── ORDER DETAILS ── */}
        <div className="mb-6 grid grid-cols-2 gap-x-10 gap-y-1.5 text-[13px]">
          <div>
            <span className="font-semibold">Order No:</span>{" "}
            <span className="font-bold">{order.orderNumber}</span>
          </div>
          <div>
            <span className="font-semibold">Date:</span> {dateStr}
          </div>
          <div>
            <span className="font-semibold">Customer:</span> {order.customer.name}
          </div>
          <div>
            <span className="font-semibold">Phone:</span> {order.customer.phone}
          </div>
          <div>
            <span className="font-semibold">Store:</span> {order.store.name}
          </div>
          <div>
            <span className="font-semibold">Stylist:</span> {order.stylist.name}
          </div>
          <div>
            <span className="font-semibold">Delivery By:</span>{" "}
            <span className={isUrgent ? "font-bold" : ""}>{shortDate(order.deliveryDate)}</span>
          </div>
          <div>
            <span className="font-semibold">Priority:</span>{" "}
            <span className={isUrgent ? "font-bold uppercase" : ""}>{order.priority}</span>
          </div>
        </div>

        {/* ── MATERIAL DETAILS ── */}
        <div className="mb-6">
          <h2 className="mb-3 border-b border-black pb-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-black">
            Material Details
          </h2>
          {slipMaterials.length === 0 ? (
            <p className="text-[13px] text-stone-500 italic">No materials have been allocated to this order.</p>
          ) : (
            <table className="dyer-slip-table w-full text-[12.5px]">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-2 text-left font-bold">Fabric / Material</th>
                  <th className="py-2 text-left font-bold">Code (SKU)</th>
                  <th className="py-2 text-right font-bold">Qty</th>
                  <th className="py-2 pl-4 text-left font-bold">Colour Required</th>
                  <th className="py-2 pl-4 text-left font-bold">Dye Instructions</th>
                </tr>
              </thead>
              <tbody>
                {slipMaterials.map((m, i) => (
                  <tr key={i} className="border-b border-stone-300 last:border-0">
                    <td className="py-2 align-top">
                      <span className="font-semibold">{m.name}</span>
                      {m.category !== "FABRIC" && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-stone-400">
                          ({m.category.replace("_", " ")})
                        </span>
                      )}
                      {m.note && (
                        <p className="mt-0.5 text-[11px] text-stone-500">{m.note}</p>
                      )}
                    </td>
                    <td className="py-2 align-top font-mono text-[11px] text-stone-600">{m.sku}</td>
                    <td className="py-2 align-top text-right tabular-nums">
                      {m.requiredQty} {m.unit}
                    </td>
                    <td className="py-2 pl-4 align-top">
                      {m.dyeColour ?? <span className="text-stone-300">—</span>}
                    </td>
                    <td className="py-2 pl-4 align-top">
                      {m.dyeInstructions ?? <span className="text-stone-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── PRODUCTION NOTES ── */}
        <div className="mb-8">
          <h2 className="mb-3 border-b border-black pb-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-black">
            Production Notes
          </h2>
          <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-[13px]">
            <div>
              <span className="font-semibold">Priority:</span>{" "}
              {isUrgent ? (
                <strong className="uppercase">{order.priority}</strong>
              ) : (
                order.priority
              )}
            </div>
            <div>
              <span className="font-semibold">Expected Delivery:</span>{" "}
              <span className={isUrgent ? "font-bold" : ""}>{shortDate(order.deliveryDate)}</span>
            </div>
          </div>
          {order.customisations.length > 0 && (
            <div className="mt-2 text-[13px]">
              <span className="font-semibold">Special Instructions / Customisations:</span>{" "}
              {order.customisations.join(", ")}
            </div>
          )}
        </div>

        {/* ── SIGNATURES ── */}
        <div className="mt-10 grid grid-cols-2 gap-12">
          <div>
            <div className="border-t-2 border-black pt-2 text-center text-[11px] text-stone-500">
              Prepared by / Stylist
            </div>
            <p className="mt-1 text-center text-[11px] text-stone-400">{order.stylist.name}</p>
          </div>
          <div>
            <div className="border-t-2 border-black pt-2 text-center text-[11px] text-stone-500">
              Dyer&apos;s Signature &amp; Date
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <p className="mt-8 border-t border-stone-200 pt-3 text-center text-[10px] text-stone-400">
          Slip generated {dateStr} at {timeStr} · Bandhani / Siddhartha Daga Couture OS ·{" "}
          {order.orderNumber}
        </p>
      </div>
    </div>
  );
}
