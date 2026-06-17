"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ClipboardList, CornerDownLeft, Package, Search, ShoppingBag, UserPlus, Users, X } from "lucide-react";
import { api } from "@/lib/client";
type Result = { id: string; title: string; subtitle: string; href: string };

// Shown when the field is empty — explains the search's reach without looking sparse.
const SEARCHABLE = [
  { icon: Users, label: "Customers", hint: "by name, phone or email" },
  { icon: UserPlus, label: "Leads", hint: "by name or phone" },
  { icon: ClipboardList, label: "Orders", hint: "by order number" },
  { icon: Package, label: "Inventory", hint: "by SKU or item name" },
  { icon: ShoppingBag, label: "Purchases", hint: "by PO number or vendor" },
];
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [groups, setGroups] = useState<Record<string, Result[]>>({}), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setMounted(true), []);
  // Flat, ordered list across groups so arrow keys move through every result.
  const flat = Object.entries(groups).flatMap(([label, items]) => items.map((item) => ({ ...item, label })));

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); else { setQuery(""); setGroups({}); setError(""); } }, [open]);
  useEffect(() => {
    if (query.trim().length < 2) { setGroups({}); setLoading(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try { const result = await api<{ groups: Record<string, Result[]> }>(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }); setGroups(result.groups); }
      catch (caught) { if ((caught as Error).name !== "AbortError") setError((caught as Error).message); }
      finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  // Keep the highlighted result in range as results change.
  useEffect(() => { setActiveIndex(0); }, [groups]);

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!flat.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((i) => (i + 1) % flat.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((i) => (i - 1 + flat.length) % flat.length); }
    else if (event.key === "Enter") {
      const target = flat[activeIndex];
      if (target) { event.preventDefault(); setOpen(false); router.push(target.href); }
    }
  }

  const total = Object.values(groups).reduce((sum, items) => sum + items.length, 0);

  return (
    <>
      <button onClick={() => setOpen(true)} className="hidden min-w-56 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500 transition hover:border-stone-300 hover:bg-white md:flex">
        <Search size={16} /><span className="flex-1 text-left">Search Couture OS</span><kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px] font-medium text-stone-500">⌘K</kbd>
      </button>
      <button aria-label="Search Couture OS" onClick={() => setOpen(true)} className="rounded-xl border border-stone-200 p-2.5 md:hidden"><Search size={18} /></button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-ink/40 px-4 pt-[12vh] animate-fade-in" onMouseDown={(event) => event.currentTarget === event.target && setOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl animate-scale-in">
            {/* Search field */}
            <div className="flex items-center gap-3 border-b border-stone-100 px-4">
              <Search size={18} className="shrink-0 text-stone-400" />
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onInputKey} role="combobox" aria-expanded={total > 0} aria-controls="global-search-results" aria-activedescendant={flat[activeIndex] ? `gs-${flat[activeIndex].label}-${flat[activeIndex].id}` : undefined} className="flex-1 border-0 bg-transparent px-0 py-4 text-[15px] text-ink placeholder:text-stone-400 focus:outline-none focus:ring-0" placeholder="Search customers, leads, orders, inventory…" />
              <button aria-label="Close search" onClick={() => setOpen(false)} className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-ink"><X size={16} /></button>
            </div>

            {/* Results */}
            <div id="global-search-results" role="listbox" className="max-h-[60vh] overflow-y-auto">
              {query.trim().length < 2 && (
                <div className="p-2">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[.18em] text-stone-400">What you can find</p>
                  {SEARCHABLE.map((entity) => (
                    <div key={entity.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500"><entity.icon size={16} /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{entity.label}</p>
                        <p className="text-xs text-stone-400">Search {entity.hint}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {loading && <div className="space-y-2 p-3">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-stone-100" />)}</div>}
              {error && <p className="m-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
              {!loading && query.trim().length >= 2 && !error && total === 0 && (
                <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-stone-100 text-stone-400"><Search size={20} /></span>
                  <p className="text-sm font-medium text-stone-600">No results for “{query}”</p>
                  <p className="text-xs text-stone-400">No matching records found within your access.</p>
                </div>
              )}
              {!loading && Object.entries(groups).map(([label, items]) => items.length ? (
                <section key={label} className="px-2 pb-2 pt-1">
                  <h3 className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-stone-400">{label}</h3>
                  {items.map((item) => {
                    const index = flat.findIndex((f) => f.label === label && f.id === item.id);
                    const active = index === activeIndex;
                    return (
                      <Link
                        key={`${label}-${item.id}`}
                        id={`gs-${label}-${item.id}`}
                        href={item.href}
                        role="option"
                        aria-selected={active}
                        ref={(el) => { if (active) el?.scrollIntoView({ block: "nearest" }); }}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => setOpen(false)}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 ${active ? "bg-stone-100" : "hover:bg-stone-50"}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                          <p className="mt-0.5 truncate text-xs text-stone-500">{item.subtitle}</p>
                        </div>
                        <ArrowRight size={15} className={`shrink-0 transition group-hover:translate-x-0.5 ${active ? "text-accent-deep" : "text-stone-300 group-hover:text-accent-deep"}`} />
                      </Link>
                    );
                  })}
                </section>
              ) : null)}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/60 px-4 py-2.5 text-[11px] text-stone-400">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-stone-200 bg-white px-1.5 py-0.5 font-medium">↑</kbd>
                <kbd className="rounded border border-stone-200 bg-white px-1.5 py-0.5 font-medium">↓</kbd>
                to navigate
                <span className="ml-1.5 flex items-center gap-1.5"><CornerDownLeft size={12} /> to open</span>
              </span>
              <span className="flex items-center gap-1.5"><kbd className="rounded border border-stone-200 bg-white px-1.5 py-0.5 font-medium">Esc</kbd> to close</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
