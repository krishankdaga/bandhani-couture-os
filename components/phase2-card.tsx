
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api, money } from "@/lib/client";

export function Phase2Card({
  title,
  description,
  endpoint,
  fields,
  listKey,
}: {
  title: string;
  description: string;
  endpoint: string;
  listKey: string;
  fields: { name: string; label: string; type?: string; placeholder?: string; options?: string[]; defaultValue?: string }[];
}) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data: any = await api(endpoint);
      setItems(data[listKey] || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial: Record<string, any> = {};
    fields.forEach((f) => {
      if (f.defaultValue !== undefined) initial[f.name] = f.defaultValue;
    });
    setForm(initial);
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await api(endpoint, {
        method: "POST",
        body: JSON.stringify(form),
      });

      const reset: Record<string, any> = {};
      fields.forEach((f) => {
        if (f.defaultValue !== undefined) reset[f.name] = f.defaultValue;
      });
      setForm(reset);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Phase 2 unlocked" title={title} description={description} />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Add New</h2>

          {fields.map((field) => (
            <label key={field.name} className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{field.label}</span>

              {field.options ? (
                <select
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-wine"
                  value={form[field.name] || field.defaultValue || field.options[0]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                >
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-wine"
                  value={form[field.name] || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: field.type === "number" ? Number(e.target.value) : e.target.value }))}
                />
              )}
            </label>
          ))}

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            disabled={saving}
            className="w-full rounded-xl bg-wine px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </form>

        <div className="card overflow-hidden">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-lg font-semibold">Records</h2>
            <p className="text-sm text-stone-500">{loading ? "Loading..." : items.length + " records"}</p>
          </div>

          <div className="divide-y divide-stone-100">
            {items.map((item) => (
              <div key={item.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{item.name || item.vendorName || item.purchaseNo || item.key || item.sku || "Record"}</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {item.sku || item.category || item.status || item.type || item.key || ""}
                    </p>
                  </div>

                  {"finalPrice" in item && <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">{money(item.finalPrice)}</span>}
                  {"totalAmount" in item && <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">{money(item.totalAmount)}</span>}
                  {"amount" in item && <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">{money(item.amount)}</span>}
                  {"quantity" in item && <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{String(item.quantity)} {item.unit}</span>}
                </div>

                {item.notes && <p className="mt-3 text-sm text-stone-600">{item.notes}</p>}
                {item.message && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-sand p-3 text-sm text-stone-700">{item.message}</p>}
              </div>
            ))}

            {!loading && items.length === 0 && (
              <div className="p-8 text-center text-sm text-stone-500">No records yet.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
