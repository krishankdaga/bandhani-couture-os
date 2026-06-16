"use client";

import type { ReactNode } from "react";
import { Info, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <article className="card card-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-600">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        {Icon && (
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${statAccent[tone]}`}>
            <Icon size={19} />
          </span>
        )}
      </div>
      {hint && <p className="mt-3 text-xs text-stone-400">{hint}</p>}
    </article>
  );
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

/** Small labelled metric used inside cards and detail panels. */
export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
