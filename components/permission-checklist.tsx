import { PERMISSION_GROUPS } from "@/lib/permissions";

export function PermissionChecklist({ value, onChange }: { value: string[]; onChange: (permissions: string[]) => void }) {
  const selected = new Set(value);
  function toggle(permission: string) {
    onChange(selected.has(permission) ? value.filter((item) => item !== permission) : [...value, permission]);
  }
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {PERMISSION_GROUPS.map((group) => <fieldset key={group.module} className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
      <legend className="px-1 text-sm font-semibold text-ink">{group.module}</legend>
      <div className="mt-2 space-y-2">{group.permissions.map((permission) => <label key={permission} className="flex cursor-pointer items-center gap-2 text-xs font-medium normal-case tracking-normal text-stone-600">
        <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-wine focus:ring-wine" checked={selected.has(permission)} onChange={() => toggle(permission)} />
        <span>{permission.split(".")[1].replaceAll("_", " ")}</span>
      </label>)}</div>
    </fieldset>)}
  </div>;
}
