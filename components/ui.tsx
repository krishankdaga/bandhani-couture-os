"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, Info, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SelectOption = { value: string; label: string; hint?: string; disabled?: boolean };

/* ----------------------------------------------------------------------------
   Select — a custom, in-app dropdown that replaces the native <select> so every
   menu looks the same across the OS (no browser/Safari chrome). Type-to-search,
   keyboard navigable, closes on outside click / Escape.

   Two modes:
   • Controlled  — pass `value` + `onChange`.
   • Uncontrolled — pass `defaultValue`; with `name` it renders a hidden input so
     it still works inside FormData-based forms as a drop-in for <select name=…>.
---------------------------------------------------------------------------- */
export function Select({
  value, onChange, defaultValue, options, placeholder = "Select…", name, disabled = false,
  searchable, id, ariaLabel, className = "", required = false,
}: {
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  options: SelectOption[];
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  /** Force the search box on/off. Defaults to on when there are more than 7 options. */
  searchable?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
  required?: boolean;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const setCurrent = (v: string) => { onChange?.(v); if (!isControlled) setInternal(v); };

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === current) ?? null;
  const canSearch = searchable ?? options.length > 7;
  const filtered = query.trim()
    ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  useEffect(() => { if (open && canSearch) searchRef.current?.focus(); }, [open, canSearch]);
  useEffect(() => { setActive(0); }, [query, open]);

  function choose(v: string) { setCurrent(v); setOpen(false); setQuery(""); }
  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); setOpen(true); } return; }
    if (e.key === "Escape") { setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const opt = filtered[active]; if (opt && !opt.disabled) choose(opt.value); }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={current} required={required} />}
      <button
        type="button" id={id} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm shadow-sm transition disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400 ${open ? "border-wine ring-2 ring-wine/20" : "border-stone-300 hover:border-stone-400"}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-ink" : "text-stone-400"}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={15} className={`shrink-0 text-stone-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id={listId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-pop">
          {canSearch && (
            <div className="border-b border-stone-100 p-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} placeholder="Type to search…" className="h-9 pl-8 text-sm" />
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-stone-400">No matches.</p>
            ) : filtered.map((o, i) => {
              const isSel = o.value === current;
              return (
                <button
                  key={o.value || "__empty"} type="button" role="option" aria-selected={isSel} disabled={o.disabled}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); if (!o.disabled) choose(o.value); }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition disabled:opacity-40 ${i === active ? "bg-stone-50" : ""} ${isSel ? "font-medium text-wine" : "text-ink"}`}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {o.hint && <span className="text-xs text-stone-400">{o.hint}</span>}
                    {isSel && <Check size={14} className="text-wine" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Couture OS shared UI primitives.
   Composable building blocks used across modules so every page shares the same
   spacing, hierarchy, and interaction language.
---------------------------------------------------------------------------- */

type StatTone = "default" | "danger" | "success" | "warning";

const statAccent: Record<StatTone, string> = {
  default: "bg-wine/10 text-wine",
  danger: "bg-red-100 text-red-600",
  success: "bg-emerald-100 text-emerald-600",
  warning: "bg-amber-100 text-amber-600",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
  tone?: StatTone;
  /** When set, the whole card becomes a link to this destination. */
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-600">{label}</p>
          <p className="numeral mt-2 text-3xl">{value}</p>
        </div>
        {Icon && (
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${statAccent[tone]}`}>
            <Icon size={19} />
          </span>
        )}
      </div>
      {hint && <p className="mt-3 text-xs text-stone-400">{hint}</p>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card card-hover group relative block p-5 transition hover:border-wine/30 hover:shadow-pop">
        <ArrowUpRight size={15} className="absolute right-4 top-4 text-stone-300 opacity-0 transition group-hover:opacity-100" />
        {body}
      </Link>
    );
  }

  return <article className="card card-hover p-5">{body}</article>;
}

/** Beginner-friendly guidance banner: "What is this / what should I do here". */
export function Hint({ children, title = "What to do here" }: { children: ReactNode; title?: string }) {
  return (
    <div className="mb-5 flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
      <Info size={18} className="mt-0.5 shrink-0 text-blue-500" />
      <p className="leading-relaxed">
        <strong className="font-semibold">{title}:</strong> {children}
      </p>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-center gap-3">{children}</div>;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-ink"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            value === option.value ? "bg-white text-ink shadow-sm" : "text-stone-500 hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Quick-filter "saved views" — pill row with optional live counts. */
export function QuickViews<T extends string>({
  views,
  value,
  onChange,
}: {
  views: ReadonlyArray<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {views.map((view) => {
        const active = value === view.id;
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onChange(view.id)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active ? "border-wine bg-wine text-white" : "border-stone-200 text-stone-600 hover:border-wine/30 hover:text-wine"
            }`}
          >
            {view.label}
            {typeof view.count === "number" && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"}`}>{view.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Small labelled metric used inside cards and detail panels. */
export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
