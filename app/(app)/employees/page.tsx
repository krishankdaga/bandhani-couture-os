"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, Plus, Save, UserSquare } from "lucide-react";
import { EmptyState, ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import { PageHeader } from "@/components/page-header";
import { PermissionChecklist } from "@/components/permission-checklist";
import { StatusBadge } from "@/components/status-badge";
import { Drawer } from "@/components/drawer";
import { SearchInput, Select } from "@/components/ui";
import { api, toast } from "@/lib/client";

type RoleItem = { id: string; name: string; permissions: Array<{ permission: string }> };
type Employee = { id: string; name: string; email: string; active: boolean; companyStatus: string; role: string; companyRoleId: string | null; storeId: string | null; companyRole: RoleItem | null; permissionOverrides: Array<{ permission: string; granted: boolean }> };
type Data = { employees: Employee[]; roles: RoleItem[]; stores: Array<{ id: string; name: string }>; availablePermissions: string[] };
const blank = { name: "", email: "", password: "", active: true, companyStatus: "EMPLOYEE", companyRoleId: "", storeId: "", legacyRole: "STYLIST", permissions: [] as string[] };

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function effectivePermissions(employee: Employee, available: string[]) {
  const values = new Set(employee.companyRole?.permissions.map((item) => item.permission) ?? []);
  employee.permissionOverrides.forEach((item) => item.granted ? values.add(item.permission) : values.delete(item.permission));
  return available.filter((permission) => values.has(permission));
}

export default function EmployeesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => data?.employees.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(search.toLowerCase())) ?? [], [data, search]);

  async function load(select?: string) {
    setLoading(true); setError("");
    try { const result = await api<Data>("/api/employees"); setData(result); if (select) choose(result.employees.find((item) => item.id === select) ?? null, result); }
    catch (caught) { setError((caught as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function choose(employee: Employee | null, source = data) {
    setSelectedId(employee?.id ?? null); setError("");
    if (!employee || !source) { setForm(blank); return; }
    setForm({ name: employee.name, email: employee.email, password: "", active: employee.active, companyStatus: employee.companyStatus, companyRoleId: employee.companyRoleId ?? "", storeId: employee.storeId ?? "", legacyRole: employee.role, permissions: effectivePermissions(employee, source.availablePermissions) });
  }
  function openCreate() { choose(null); setShowForm(true); }
  function openEdit(employee: Employee) { choose(employee); setShowForm(true); }
  function closeForm() { setShowForm(false); setSelectedId(null); setForm(blank); setError(""); }
  function roleChanged(roleId: string) { const permissions = data?.roles.find((item) => item.id === roleId)?.permissions.map((item) => item.permission) ?? []; setForm({ ...form, companyRoleId: roleId, permissions }); }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = { ...form, companyRoleId: form.companyRoleId || null, storeId: form.storeId || null };
      const result = await api<{ employee: Employee }>(selectedId ? `/api/employees/${selectedId}` : "/api/employees", { method: selectedId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      toast(selectedId ? "Employee updated." : "Employee created.");
      setShowForm(false);
      await load(result.employee.id);
      setShowForm(false);
    } catch (caught) { setError((caught as Error).message); } finally { setSaving(false); }
  }

  async function resetPassword() {
    if (!selectedId || form.password.length < 8) { setError("Enter a new password with at least 8 characters."); return; }
    setSaving(true);
    try { await api(`/api/employees/${selectedId}/reset-password`, { method: "POST", body: JSON.stringify({ password: form.password }) }); setForm({ ...form, password: "" }); toast("Password reset completed."); }
    catch (caught) { setError((caught as Error).message); } finally { setSaving(false); }
  }

  return <>
    <PageHeader eyebrow="Owner controls" title="Employees" description="Add staff, assign stores and roles, customize feature access, and control account status." action={<button className="btn-primary flex items-center gap-2" onClick={openCreate}><Plus size={16} />Add employee</button>} />

    {loading ? <LoadingState label="Loading employees..." /> : error && !data ? <ErrorState message={error} retry={() => load()} /> : data && <>
      <div className="card mb-5 p-4"><SearchInput value={search} onChange={setSearch} placeholder="Search staff by name or email" /><p className="mt-3 text-xs text-stone-500">{filtered.length} of {data.employees.length} {data.employees.length === 1 ? "person" : "people"}.</p></div>

      {filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((employee) => (
            <div key={employee.id} className="card card-hover flex flex-col p-5">
              <button onClick={() => openEdit(employee)} className="flex-1 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{employee.name}</p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">{employee.email}</p>
                  </div>
                  <StatusBadge value={employee.active ? "ACTIVE" : "INACTIVE"} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge value={employee.companyStatus} />
                  <span className="text-xs text-stone-400">{employee.companyRole?.name ?? employee.role.replaceAll("_", " ")}</span>
                </div>
              </button>
              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                <button onClick={() => openEdit(employee)} className="text-xs font-semibold text-wine hover:underline">Edit access</button>
                <Link href={`/employees/${employee.id}`} className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-accent-deep"><UserSquare size={14} />Profile</Link>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState title="No matching staff" message="No employees match this search." />}
    </>}

    <Drawer
      open={showForm}
      onClose={closeForm}
      title={selectedId ? "Edit employee" : "New employee"}
      description="Owner-controlled identity and access settings"
      width="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {selectedId && <Link href={`/employees/${selectedId}`} className="btn-secondary btn-sm mr-auto flex items-center gap-1.5"><UserSquare size={15} />View profile</Link>}
          {selectedId && <button type="button" disabled={saving} onClick={resetPassword} className="btn-secondary btn-sm flex items-center gap-1.5"><KeyRound size={15} />Reset password</button>}
          <button type="button" onClick={closeForm} className="btn-secondary btn-sm">Cancel</button>
          <button form="employee-form" disabled={saving} className="btn-primary btn-sm flex items-center gap-1.5"><Save size={15} />{saving ? "Saving..." : selectedId ? "Save employee" : "Create employee"}</button>
        </div>
      }
    >
      {data && (
        <form id="employee-form" onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label>Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Email</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div>
              <div className="flex items-center justify-between"><label>{selectedId ? "New password (optional)" : "Temporary password"}</label><button type="button" onClick={() => setForm({ ...form, password: generatePassword() })} className="mb-1 text-[11px] font-semibold text-accent-deep hover:underline">Generate</button></div>
              <input required={!selectedId} minLength={8} type={form.password ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={selectedId ? "Leave blank to keep current" : "Set a temporary password"} />
            </div>
            <div><label>Company status</label><Select value={form.companyStatus} onChange={(v) => setForm({ ...form, companyStatus: v })} searchable={false} options={["OWNER", "MANAGER", "EMPLOYEE"].map((s) => ({ value: s, label: s }))} /></div>
            <div><label>Custom role</label><Select value={form.companyRoleId} onChange={roleChanged} placeholder="No custom role" options={[{ value: "", label: "No custom role" }, ...data.roles.map((role) => ({ value: role.id, label: role.name }))]} /></div>
            <div><label>Store</label><Select value={form.storeId} onChange={(v) => setForm({ ...form, storeId: v })} placeholder="All / unassigned" options={[{ value: "", label: "All / unassigned" }, ...data.stores.map((store) => ({ value: store.id, label: store.name }))]} /></div>
            <div><label>Detailed legacy role</label><Select value={form.legacyRole} onChange={(v) => setForm({ ...form, legacyRole: v })} options={["OWNER", "PARTNER", "STORE_MANAGER", "STYLIST", "PRODUCTION_MANAGER", "QC_TEAM", "INVENTORY_TEAM", "PURCHASE_TEAM", "ACCOUNTS_TEAM"].map((role) => ({ value: role, label: role.replaceAll("_", " ") }))} /></div>
            <div><label>Account state</label><Select value={form.active ? "ACTIVE" : "INACTIVE"} onChange={(v) => setForm({ ...form, active: v === "ACTIVE" })} searchable={false} options={["ACTIVE", "INACTIVE"].map((s) => ({ value: s, label: s }))} /></div>
          </div>
          <div className="border-t border-stone-100 pt-5">
            <h3 className="font-semibold">Visible modules and actions</h3>
            <p className="mb-4 text-xs text-stone-500">These selections override the assigned role for this employee.</p>
            <PermissionChecklist value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
          </div>
          {error && <InlineMessage message={error} />}
        </form>
      )}
    </Drawer>
  </>;
}
