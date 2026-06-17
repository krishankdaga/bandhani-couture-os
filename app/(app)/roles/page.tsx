"use client";

import { useEffect, useState } from "react";
import { Plus, Save, ShieldCheck, Users } from "lucide-react";
import { EmptyState, ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { PermissionChecklist } from "@/components/permission-checklist";
import { Drawer } from "@/components/drawer";
import { api, toast } from "@/lib/client";

type RoleItem = { id: string; name: string; description: string | null; isSystem: boolean; permissions: Array<{ permission: string }>; _count?: { users: number } };
const blank = { name: "", description: "", permissions: [] as string[] };

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load(select?: string) {
    setLoading(true); setError("");
    try {
      const data = await api<{ roles: RoleItem[] }>("/api/roles");
      setRoles(data.roles);
      if (select) { const role = data.roles.find((item) => item.id === select); if (role) selectRole(role); }
    } catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function selectRole(role: RoleItem) {
    setSelectedId(role.id);
    setForm({ name: role.name, description: role.description ?? "", permissions: role.permissions.map((item) => item.permission) });
  }
  function openCreate() { setSelectedId(null); setForm(blank); setError(""); setShowForm(true); }
  function openEdit(role: RoleItem) { selectRole(role); setError(""); setShowForm(true); }
  function closeForm() { setShowForm(false); setSelectedId(null); setForm(blank); setError(""); }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const result = await api<{ role: RoleItem }>(selectedId ? `/api/roles/${selectedId}` : "/api/roles", { method: selectedId ? "PATCH" : "POST", body: JSON.stringify(form) });
      toast(selectedId ? "Role access updated." : "Role created.");
      setShowForm(false);
      await load(result.role.id);
      setShowForm(false);
    } catch (caught) { setError((caught as Error).message); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader eyebrow="Owner controls" title="Roles & Access" description="Create reusable company roles and choose exactly which Couture OS actions each role can perform." action={<button className="btn-primary flex items-center gap-2" onClick={openCreate}><Plus size={16} />New role</button>} />

    {loading ? <LoadingState label="Loading roles and permissions..." /> : error && !roles.length ? <ErrorState message={error} retry={() => load()} /> : roles.length ? (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <button key={role.id} onClick={() => openEdit(role)} className="card card-hover p-5 text-left">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold">{role.name}</span>
              {role.isSystem && <span className="flex items-center gap-1 text-[11px] font-semibold text-gold"><ShieldCheck size={14} />System</span>}
            </div>
            {role.description && <p className="mt-1 text-xs text-stone-500 line-clamp-2">{role.description}</p>}
            <div className="mt-4 flex items-center gap-4 border-t border-stone-100 pt-3 text-xs text-stone-500">
              <span><span className="font-semibold text-ink">{role.permissions.length}</span> permissions</span>
              <span className="flex items-center gap-1"><Users size={13} className="text-stone-400" /><span className="font-semibold text-ink">{role._count?.users ?? 0}</span> users</span>
            </div>
          </button>
        ))}
      </div>
    ) : <EmptyState title="No roles yet" message="Create your first company role to control access." action={<button className="btn-primary" onClick={openCreate}>New role</button>} />}

    <Drawer
      open={showForm}
      onClose={closeForm}
      title={selectedId ? "Edit role" : "New role"}
      description="Choose exactly which actions this role can perform."
      width="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={closeForm} className="btn-secondary btn-sm">Cancel</button>
          <button form="role-form" disabled={saving} className="btn-primary btn-sm flex items-center gap-1.5"><Save size={15} />{saving ? "Saving..." : selectedId ? "Save role" : "Create role"}</button>
        </div>
      }
    >
      <form id="role-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div><label>Role name</label><input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Store Manager" /></div>
          <div><label>Description</label><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Manages store sales and daily operations" /></div>
        </div>
        <div className="border-t border-stone-100 pt-5">
          <h2 className="font-semibold">Module permissions</h2>
          <p className="mb-4 mt-1 text-xs text-stone-500">Changes apply to assigned users after they refresh the app.</p>
          <PermissionChecklist value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
        </div>
        {error && <InlineMessage message={error} />}
      </form>
    </Drawer>
  </>;
}
