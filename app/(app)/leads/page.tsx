"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SearchInput } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { UserRoundPlus } from "lucide-react";
import { api, money, shortDate } from "@/lib/client";
import { EmptyState, ErrorState, InlineMessage, LoadingState } from "@/components/async-state";
import { useConfirm } from "@/components/confirm-dialog";

type Lead = { id: string; name: string; phone: string; source: string; status: string; budget: string | null; followUpDate: string | null; store: { name: string }; stylist: { name: string } | null; customer: { id: string } | null };
type Meta = { stores: Array<{ id: string; name: string }>; users: Array<{ id: string; name: string; role: string; storeId: string | null }> };
type Session = { user: { permissions: string[] } };

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]); const [meta, setMeta] = useState<Meta>({ stores: [], users: [] });
  const [showForm, setShowForm] = useState(false); const [error, setError] = useState(""); const [pageError, setPageError] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [convertingId, setConvertingId] = useState(""); const [permissions, setPermissions] = useState<string[]>([]);
  const { confirm } = useConfirm();
  const [search, setSearch] = useState(""); const [statusFilter, setStatusFilter] = useState("ALL"); const [sourceFilter, setSourceFilter] = useState("ALL");
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return leads.filter((l) => (statusFilter === "ALL" || l.status === statusFilter) && (sourceFilter === "ALL" || l.source === sourceFilter) && (!q || `${l.name} ${l.phone} ${l.store.name} ${l.stylist?.name ?? ""}`.toLowerCase().includes(q))); }, [leads, search, statusFilter, sourceFilter]);
  const filtersActive = search.trim() !== "" || statusFilter !== "ALL" || sourceFilter !== "ALL";
  function clearFilters() { setSearch(""); setStatusFilter("ALL"); setSourceFilter("ALL"); }
  const load = useCallback(async () => { setLoading(true); setPageError(""); try { const [leadResult, metaResult, session] = await Promise.all([api<{ leads: Lead[] }>("/api/leads"), api<Meta>("/api/meta"), api<Session>("/api/auth/me")]); setLeads(leadResult.leads); setMeta(metaResult); setPermissions(session.user.permissions); } catch (e) { setPageError((e as Error).message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  // Pre-fill the search box from ?search= (global-search deep links).
  useEffect(() => { const q = new URLSearchParams(window.location.search).get("search"); if (q) setSearch(q); }, []);
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setSaving(true); const form = new FormData(event.currentTarget); try { await api("/api/leads", { method: "POST", body: JSON.stringify({ ...Object.fromEntries(form), budget: form.get("budget") || null, stylistId: form.get("stylistId") || null, eventDate: form.get("eventDate") || null, followUpDate: form.get("followUpDate") || null, preferences: String(form.get("preferences") || "").split(",").map((v) => v.trim()).filter(Boolean) }) }); setShowForm(false); await load(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }
  async function convert(id: string) { if (!(await confirm({ title: "Convert to customer?", message: "This creates a customer record from the lead so you can take orders.", confirmLabel: "Convert" }))) return; setConvertingId(id); setPageError(""); try { await api(`/api/leads/${id}/convert`, { method: "POST" }); await load(); } catch (e) { setPageError((e as Error).message); } finally { setConvertingId(""); } }
  const canCreate = permissions.includes("leads.create");
  const canConvert = permissions.includes("leads.convert");
  return <><PageHeader title="Lead Management" description="Capture, assign and follow up every enquiry." action={canCreate ? <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ New lead</button> : undefined} />
    <Drawer open={showForm && canCreate} onClose={() => setShowForm(false)} title="New lead" description="Capture a new enquiry and assign a follow-up."
      footer={<div className="flex justify-end gap-2"><button type="button" disabled={saving} className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button form="lead-form" disabled={saving} className="btn-primary">{saving ? "Creating..." : "Create lead"}</button></div>}>
      <form id="lead-form" onSubmit={create} className="grid gap-4 sm:grid-cols-2">
        <div><label>Name</label><input name="name" required /></div>
        <div><label>Phone</label><input name="phone" required /></div>
        <div><label>Source</label><select name="source">{["WALK_IN", "SOCIAL_MEDIA", "CALL", "WHATSAPP", "REFERRAL", "OTHER"].map(v => <option key={v}>{v}</option>)}</select></div>
        <div><label>Store</label><select name="storeId" required><option value="">Select store</option>{meta.stores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
        <div><label>Stylist</label><select name="stylistId"><option value="">Unassigned</option>{meta.users.filter(v => v.role === "STYLIST").map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
        <div><label>Budget</label><input name="budget" type="number" min="0" /></div>
        <div><label>Event date</label><input name="eventDate" type="date" /></div>
        <div><label>Follow-up date</label><input name="followUpDate" type="datetime-local" /></div>
        <div className="sm:col-span-2"><label>Preferences (comma separated)</label><input name="preferences" placeholder="Pastels, lehenga, mirror work" /></div>
        <div className="sm:col-span-2"><label>Notes</label><textarea name="notes" rows={3} /></div>
        {error && <div className="sm:col-span-2"><InlineMessage message={error} /></div>}
      </form>
    </Drawer>
    {pageError && <div className="mb-4"><ErrorState message={pageError} retry={load} /></div>}
    {!loading && leads.length > 0 && <section className="card mb-6 p-4"><div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center"><SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, store or stylist" /><select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">All statuses</option>{["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED", "CONVERTED", "LOST"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select><select aria-label="Filter by source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option value="ALL">All sources</option>{["WALK_IN", "SOCIAL_MEDIA", "CALL", "WHATSAPP", "REFERRAL", "OTHER"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select><button type="button" onClick={clearFilters} disabled={!filtersActive} className="btn-ghost btn-sm whitespace-nowrap">Clear filters</button></div><p className="mt-3 text-xs text-stone-500">{filtered.length} of {leads.length} lead{leads.length === 1 ? "" : "s"}{filtersActive ? " match these filters" : ""}.</p></section>}
    {loading ? <LoadingState label="Loading leads..." /> : !leads.length ? <EmptyState icon={<UserRoundPlus size={22} />} title={canCreate ? "No leads yet" : "Nothing assigned to you"} message={canCreate ? "Capture your first enquiry to start assigning follow-ups and converting customers." : "No leads are assigned to your store or current access yet."} action={canCreate ? <button className="btn-primary" onClick={() => setShowForm(true)}>+ New lead</button> : undefined} /> : !filtered.length ? <EmptyState icon={<UserRoundPlus size={22} />} title="No matching leads" message="No leads match these filters. Clear them to see every lead." action={<button className="btn-secondary" onClick={clearFilters}>Clear filters</button>} /> : <div className="table-wrap"><table><thead><tr><th>Lead</th><th>Source</th><th>Store / Stylist</th><th>Budget</th><th>Follow-up</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map(lead => <tr key={lead.id}><td><strong>{lead.name}</strong><p className="text-xs text-stone-500">{lead.phone}</p></td><td>{lead.source.replaceAll("_", " ")}</td><td>{lead.store.name}<p className="text-xs text-stone-500">{lead.stylist?.name ?? "Unassigned"}</p></td><td>{lead.budget ? money(lead.budget) : "-"}</td><td>{lead.followUpDate ? shortDate(lead.followUpDate) : "-"}</td><td><StatusBadge value={lead.status} /></td><td>{canConvert && !lead.customer && lead.status !== "LOST" && <button disabled={convertingId === lead.id} onClick={() => convert(lead.id)} className="text-xs font-semibold text-wine">{convertingId === lead.id ? "Converting..." : "Convert"}</button>}</td></tr>)}</tbody></table></div>}
  </>;
}
