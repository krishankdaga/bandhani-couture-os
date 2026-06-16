"use client";

import { useEffect, useState } from "react";
import { Plus, Save, ShieldCheck } from "lucide-react";
import { EmptyState, ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { PermissionChecklist } from "@/components/permission-checklist";
import { api } from "@/lib/client";

type RoleItem = { id: string; name: string; description: string | null; isSystem: boolean; permissions: Array<{ permission: string }>; _count?: { users: number } };
const blank = { name: "", description: "", permissions: [] as string[] };

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(select?: string) {
    setLoading(true); setError("");
    try {
      const data = await api<{ roles: RoleItem[] }>("/api/roles");
      setRoles(data.roles);
      const id = select ?? selectedId ?? data.roles[0]?.id ?? null;
      const role = data.roles.find((item) => item.id === id);
      setSelectedId(id); setForm(role ? { name: role.name, description: role.description ?? "", permissions: role.permissions.map((item) => item.permission) } : blank);
    } catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function select(role: RoleItem) {
    setSelectedId(role.id); setMessage("");
    setForm({ name: role.name, description: role.description ?? "", permissions: role.permissions.map((item) => item.permission) });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const result = await api<{ role: RoleItem }>(selectedId ? `/api/roles/${selectedId}` : "/api/roles", { method: selectedId ? "PATCH" : "POST", body: JSON.stringify(form) });
      setMessage(selectedId ? "Role access updated." : "Role created."); await load(result.role.id);
    } catch (caught) { setError((caught as Error).message); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader eyebrow="Owner controls" title="Roles & Access" description="Create reusable company roles and choose exactly which Couture OS actions each role can perform." action={<button className="btn-secondary flex items-center gap-2" onClick={() => { setSelectedId(null); setForm(blank); setMessage(""); }}><Plus size={16} />New role</button>} />
    {loading ? <LoadingState label="Loading roles and permissions..." /> : error && !roles.length ? <ErrorState message={error} retry={() => load()} /> : <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
      <aside className="card h-fit overflow-hidden"><div className="border-b border-stone-100 p-4"><p className="text-xs font-bold uppercase tracking-wide text-stone-400">Company roles</p></div>{roles.length ? <div className="divide-y divide-stone-100">{roles.map((role) => <button key={role.id} onClick={() => select(role)} className={`w-full p-4 text-left ${selectedId === role.id ? "bg-wine/5" : "hover:bg-stone-50"}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{role.name}</span>{role.isSystem && <ShieldCheck size={15} className="text-gold" />}</div><p className="mt-1 text-xs text-stone-500">{role.permissions.length} permissions · {role._count?.users ?? 0} users</p></button>)}</div> : <div className="p-4"><EmptyState message="No roles created yet." /></div>}</aside>
      <form onSubmit={submit} className="card p-5 md:p-6"><div className="grid gap-4 md:grid-cols-2"><div><label>Role name</label><input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Store Manager" /></div><div><label>Description</label><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Manages store sales and daily operations" /></div></div><div className="my-5 border-t border-stone-100" /><div className="mb-4"><h2 className="font-semibold">Module permissions</h2><p className="mt-1 text-xs text-stone-500">Changes apply to assigned users after they refresh the app.</p></div><PermissionChecklist value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />{error && <div className="mt-4"><InlineMessage message={error} /></div>}{message && <div className="mt-4"><InlineMessage tone="success" message={message} /></div>}<div className="mt-5 flex justify-end"><button disabled={saving} className="btn-primary flex items-center gap-2"><Save size={16} />{saving ? "Saving..." : selectedId ? "Save role" : "Create role"}</button></div></form>
    </div>}
  </>;
}
