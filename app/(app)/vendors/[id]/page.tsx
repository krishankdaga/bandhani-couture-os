"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Mail, MapPin, Phone, StickyNote, Truck } from "lucide-react";
import { AccessDenied } from "@/components/access-denied";
import { ErrorState, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api, shortDate } from "@/lib/client";

type Vendor = {
  id: string; name: string; phone: string | null; panNo: string | null; address: string | null;
  email: string | null; notes: string | null; active: boolean; createdAt: string; updatedAt: string;
};

function Field({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400"><Icon size={13} />{label}</p>
      {value ? <p className="mt-1.5 text-sm font-medium text-ink">{value}</p> : <p className="mt-1.5 text-sm text-stone-400">Not recorded</p>}
    </div>
  );
}

export default function VendorProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await api<{ vendor: Vendor }>(`/api/vendors/${id}`); setVendor(result.vendor); }
    catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const denied = /permission|access/i.test(error);

  return (
    <>
      <PageHeader eyebrow="Vendor" title={vendor?.name ?? "Vendor profile"} description={vendor?.phone ?? undefined} action={<Link href="/vendors" className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} />Back to vendors</Link>} />

      {loading ? <LoadingState label="Loading vendor..." /> : denied ? <AccessDenied /> : error ? <ErrorState message={error} retry={load} /> : vendor && (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
          <section className="card h-fit p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-wine/10 text-wine"><Truck size={24} /></span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{vendor.name}</h2>
                <p className="flex items-center gap-1.5 truncate text-sm text-stone-500"><Phone size={14} />{vendor.phone ?? "No phone on file"}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge value={vendor.active ? "ACTIVE" : "INACTIVE"} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-5 text-sm">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Added</dt><dd className="mt-1 font-medium">{shortDate(vendor.createdAt)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Last updated</dt><dd className="mt-1 font-medium">{shortDate(vendor.updatedAt)}</dd></div>
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="font-semibold">Vendor details</h2>
            <p className="text-xs text-stone-500">Contact and identification on record for this vendor.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field icon={Phone} label="Phone" value={vendor.phone} />
              <Field icon={CreditCard} label="PAN number" value={vendor.panNo} />
              <Field icon={Mail} label="Email" value={vendor.email} />
              <Field icon={MapPin} label="Address" value={vendor.address} />
            </div>
            {vendor.notes && (
              <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400"><StickyNote size={13} />Notes</p>
                <p className="mt-1.5 text-sm text-stone-700">{vendor.notes}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
