"use client";

import { PERMISSION_GROUPS } from "@/lib/permissions";

export function PermissionChecklist({ value, onChange }: { value: string[]; onChange: (permissions: string[]) => void }) {
  const selected = new Set(value);
  const toggle = (permission: string) => onChange(selected.has(permission) ? value.filter((item) => item !== permission) : [...value, permission]);
  const toggleModule = (permissions: readonly string[], allOn: boolean) =>
    onChange(allOn ? value.filter((item) => !permissions.includes(item)) : [...new Set([...value, ...permissions])]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {PERMISSION_GROUPS.map((group) => {
        const count = group.permissions.filter((permission) => selected.has(permission)).length;
        const allOn = count === group.permissions.length;
        return (
          <div key={group.module} className="rounded-xl border border-stone-200 bg-white p-3.5">
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                {group.module}
                {count > 0 && <span className="rounded-full bg-wine/10 px-1.5 py-0.5 text-[10px] font-bold text-wine">{count}/{group.permissions.length}</span>}
              </span>
              <button type="button" onClick={() => toggleModule(group.permissions, allOn)} className="text-[11px] font-semibold text-accent-deep hover:underline">
                {allOn ? "Clear" : "All"}
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {group.permissions.map((permission) => {
                const on = selected.has(permission);
                return (
                  <button
                    key={permission}
                    type="button"
                    onClick={() => toggle(permission)}
                    aria-pressed={on}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition ${
                      on ? "border-wine bg-wine text-white shadow-sm" : "border-stone-200 bg-stone-50 text-stone-500 hover:border-stone-300 hover:text-stone-700"
                    }`}
                  >
                    {permission.split(".")[1].replaceAll("_", " ")}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
