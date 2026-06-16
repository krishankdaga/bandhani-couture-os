"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Camera, ChevronDown, ChevronUp, KeyRound, MapPin, Pencil, Plus, Save, Store, Trash2, UserRound, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, InlineMessage, LoadingState } from "@/components/async-state";
import { Hint } from "@/components/ui";
import { api, toast } from "@/lib/client";

type Me = { id: string; name: string; email: string; image: string | null; companyStatus: string; permissions: string[] };
type Setting = { id: string; key: string; value: unknown };
type StoreRecord = { id: string; name: string; code: string; location: string | null; _count: { users: number; customers: number; orders: number } };
type StoreEmployee = { id: string; name: string; email: string; role: string; companyStatus: string; companyRole: { name: string } | null };
type StoreDetail = { store: StoreRecord; employees: StoreEmployee[]; performance: { totalOrders: number; activeOrders: number; deliveredOrders: number; totalRevenue: number; totalCollected: number; outstanding: number } };

function resizeImage(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Your browser cannot process this image"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("That file could not be read as an image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("That file could not be read"));
    reader.readAsDataURL(file);
  });
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function SettingsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const [key, setKey] = useState("business_name");
  const [value, setValue] = useState("");
  const [savingSetting, setSavingSetting] = useState(false);

  const [storeForm, setStoreForm] = useState({ name: "", code: "", location: "" });
  const [savingStore, setSavingStore] = useState(false);
  const [storeError, setStoreError] = useState("");
  const [showStoreForm, setShowStoreForm] = useState(false);

  // Store expand / edit
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  const [storeDetail, setStoreDetail] = useState<StoreDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editStoreForm, setEditStoreForm] = useState({ name: "", location: "" });
  const [savingEditStore, setSavingEditStore] = useState(false);
  const [editStoreError, setEditStoreError] = useState("");

  const isOwner = me?.companyStatus === "OWNER";
  const canEditBusiness = me?.permissions.includes("settings.edit") ?? false;

  async function load() {
    setLoading(true);
    try {
      const meResult = await api<{ user: Me }>("/api/auth/me");
      setMe(meResult.user);
      setName(meResult.user.name);
      setImage(meResult.user.image);
      try {
        const [settingsData, storesData] = await Promise.all([
          api<{ settings: Setting[] }>("/api/settings"),
          api<{ stores: StoreRecord[] }>("/api/stores"),
        ]);
        setSettings(settingsData.settings || []);
        setStores(storesData.stores || []);
      } catch {
        setSettings([]);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setProfileError("");
    try {
      setImage(await resizeImage(file));
    } catch (caught) {
      setProfileError((caught as Error).message);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name, image: image ?? "" }) });
      toast("Profile updated.");
      router.refresh();
      await load();
    } catch (caught) {
      setProfileError((caught as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (pwd.newPassword !== pwd.confirm) { setPwdError("New password and confirmation do not match."); return; }
    setSavingPwd(true);
    setPwdError("");
    try {
      await api("/api/profile/password", { method: "POST", body: JSON.stringify({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword }) });
      toast("Password changed.");
      setPwd({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (caught) {
      setPwdError((caught as Error).message);
    } finally {
      setSavingPwd(false);
    }
  }

  async function saveSetting(event: React.FormEvent) {
    event.preventDefault();
    setSavingSetting(true);
    try {
      await api("/api/settings", { method: "POST", body: JSON.stringify({ key, value }) });
      toast("Setting saved.");
      setValue("");
      await load();
    } catch (caught) {
      toast((caught as Error).message, "error");
    } finally {
      setSavingSetting(false);
    }
  }

  async function createStore(event: React.FormEvent) {
    event.preventDefault();
    setSavingStore(true);
    setStoreError("");
    try {
      await api("/api/stores", { method: "POST", body: JSON.stringify(storeForm) });
      toast("Store created.");
      setStoreForm({ name: "", code: "", location: "" });
      setShowStoreForm(false);
      await load();
    } catch (caught) {
      setStoreError((caught as Error).message);
    } finally {
      setSavingStore(false);
    }
  }

  async function toggleStoreDetail(storeId: string) {
    if (expandedStoreId === storeId) { setExpandedStoreId(null); setStoreDetail(null); return; }
    setExpandedStoreId(storeId);
    setStoreDetail(null);
    setLoadingDetail(true);
    try {
      setStoreDetail(await api<StoreDetail>(`/api/stores/${storeId}`));
    } catch { /* swallow — store detail is optional UI */ } finally { setLoadingDetail(false); }
  }

  function openEditStore(s: StoreRecord) {
    setEditingStoreId(s.id);
    setEditStoreForm({ name: s.name, location: s.location ?? "" });
    setEditStoreError("");
  }

  async function saveEditStore(event: React.FormEvent) {
    event.preventDefault();
    if (!editingStoreId) return;
    setSavingEditStore(true); setEditStoreError("");
    try {
      await api(`/api/stores/${editingStoreId}`, { method: "PATCH", body: JSON.stringify(editStoreForm) });
      toast("Store updated.");
      setEditingStoreId(null);
      await load();
    } catch (caught) {
      setEditStoreError((caught as Error).message);
    } finally { setSavingEditStore(false); }
  }

  if (loading) return <><PageHeader eyebrow="Administration" title="Settings" /><LoadingState label="Loading your settings..." rows={3} /></>;

  return (
    <>
      <PageHeader eyebrow="Administration" title="Settings" description="Manage your personal account and, as an owner, business-level configuration." />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {/* My profile */}
        <form onSubmit={saveProfile} className="card p-5 md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-wine/10 text-wine"><UserRound size={20} /></span>
            <div><h2 className="font-semibold">My profile</h2><p className="text-xs text-stone-500">Your name and picture across Couture OS</p></div>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative">
              {image
                ? <img src={image} alt="Profile preview" className="h-20 w-20 rounded-2xl object-cover ring-1 ring-stone-200" />
                : <span className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-wine to-wine-dark text-lg font-bold text-white">{initials(name || me?.name || "?")}</span>}
              <button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm hover:text-wine" aria-label="Change picture"><Camera size={15} /></button>
            </div>
            <div className="text-sm">
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary btn-sm">Upload picture</button>
              {image && <button type="button" onClick={() => setImage(null)} className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"><Trash2 size={13} />Remove</button>}
              <p className="mt-2 text-xs text-stone-400">PNG or JPG. Automatically resized.</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
          </div>

          <div className="mt-5 grid gap-4">
            <div><label>Full name</label><input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></div>
            <div><label>Email</label><input value={me?.email ?? ""} disabled /><p className="mt-1 text-xs normal-case tracking-normal text-stone-400">Contact the owner to change your sign-in email.</p></div>
          </div>
          {profileError && <div className="mt-4"><InlineMessage message={profileError} /></div>}
          <div className="mt-5 flex justify-end"><button disabled={savingProfile} className="btn-primary flex items-center gap-2"><Save size={16} />{savingProfile ? "Saving..." : "Save profile"}</button></div>
        </form>

        {/* Change password */}
        <form onSubmit={changePassword} className="card h-fit p-5 md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-wine/10 text-wine"><KeyRound size={20} /></span>
            <div><h2 className="font-semibold">Change password</h2><p className="text-xs text-stone-500">Use a strong password you don&apos;t reuse elsewhere</p></div>
          </div>
          <div className="grid gap-4">
            <div><label>Current password</label><input type="password" autoComplete="current-password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} required /></div>
            <div><label>New password</label><input type="password" autoComplete="new-password" minLength={8} value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} required /></div>
            <div><label>Confirm new password</label><input type="password" autoComplete="new-password" minLength={8} value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required /></div>
          </div>
          {pwdError && <div className="mt-4"><InlineMessage message={pwdError} /></div>}
          <div className="mt-5 flex justify-end"><button disabled={savingPwd} className="btn-primary flex items-center gap-2"><KeyRound size={16} />{savingPwd ? "Updating..." : "Update password"}</button></div>
        </form>

        {/* Store management (owner only) */}
        {isOwner && (
          <div className="xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-wine/10 text-wine"><Store size={20} /></span>
                <div><h2 className="font-semibold">Store locations</h2><p className="text-xs text-stone-500">Manage boutique locations. Each store has its own customers, staff, and orders.</p></div>
              </div>
              <button onClick={() => setShowStoreForm(!showStoreForm)} className="btn-primary btn-sm flex items-center gap-2"><Plus size={15} />{showStoreForm ? "Cancel" : "Add store"}</button>
            </div>

            {showStoreForm && (
              <form onSubmit={createStore} className="card mb-4 p-5">
                <h3 className="mb-4 font-semibold text-sm">New store</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label>Store name</label>
                    <input value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} placeholder="Mumbai Flagship" required minLength={2} />
                  </div>
                  <div>
                    <label>Store code</label>
                    <input value={storeForm.code} onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value.toUpperCase() })} placeholder="MUM-01" required minLength={2} maxLength={20} />
                    <p className="mt-1 text-xs text-stone-400">Short unique identifier (e.g. AMD-HQ, MUM-01)</p>
                  </div>
                  <div>
                    <label>Location / City</label>
                    <input value={storeForm.location} onChange={(e) => setStoreForm({ ...storeForm, location: e.target.value })} placeholder="Mumbai" />
                  </div>
                </div>
                {storeError && <div className="mt-3"><InlineMessage message={storeError} /></div>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => { setShowStoreForm(false); setStoreError(""); }} className="btn-secondary btn-sm">Cancel</button>
                  <button disabled={savingStore} className="btn-primary btn-sm flex items-center gap-2"><Plus size={14} />{savingStore ? "Creating..." : "Create store"}</button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {stores.length ? stores.map((s) => (
                <div key={s.id} className="card overflow-hidden">
                  {/* Store card header */}
                  <div className="flex items-center justify-between gap-3 p-4">
                    <button type="button" onClick={() => toggleStoreDetail(s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-wine/10 text-wine"><Store size={17} /></span>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{s.name} <span className="ml-1 text-xs font-mono font-normal text-stone-400">{s.code}</span></p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                          {s.location && <span className="flex items-center gap-1"><MapPin size={11} />{s.location}</span>}
                          <span><span className="font-semibold text-ink">{s._count.users}</span> staff</span>
                          <span><span className="font-semibold text-ink">{s._count.customers}</span> customers</span>
                          <span><span className="font-semibold text-ink">{s._count.orders}</span> orders</span>
                        </div>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" onClick={() => openEditStore(s)} className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:border-wine/30 hover:text-wine"><Pencil size={12} />Edit</button>
                      <button type="button" onClick={() => toggleStoreDetail(s.id)} className="rounded-lg border border-stone-200 p-1.5 text-stone-400 hover:bg-stone-50">
                        {expandedStoreId === s.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {editingStoreId === s.id && (
                    <form onSubmit={saveEditStore} className="border-t border-stone-100 bg-stone-50/60 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label>Store name</label>
                          <input value={editStoreForm.name} onChange={(e) => setEditStoreForm({ ...editStoreForm, name: e.target.value })} required minLength={2} />
                        </div>
                        <div>
                          <label>Location / City</label>
                          <input value={editStoreForm.location} onChange={(e) => setEditStoreForm({ ...editStoreForm, location: e.target.value })} placeholder="Ahmedabad" />
                        </div>
                      </div>
                      {editStoreError && <p className="mt-2 text-xs text-red-600">{editStoreError}</p>}
                      <div className="mt-3 flex gap-2">
                        <button disabled={savingEditStore} className="btn-primary btn-sm flex items-center gap-1.5"><Save size={13} />{savingEditStore ? "Saving..." : "Save"}</button>
                        <button type="button" onClick={() => setEditingStoreId(null)} className="btn-secondary btn-sm flex items-center gap-1.5"><X size={13} />Cancel</button>
                      </div>
                    </form>
                  )}

                  {/* Expanded detail panel */}
                  {expandedStoreId === s.id && (
                    <div className="border-t border-stone-100 p-4">
                      {loadingDetail && <p className="text-xs text-stone-400">Loading store details…</p>}
                      {storeDetail && storeDetail.store.id === s.id && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {/* Performance */}
                          <div>
                            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-400">Performance</p>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                ["Total orders", storeDetail.performance.totalOrders],
                                ["Active orders", storeDetail.performance.activeOrders],
                                ["Delivered", storeDetail.performance.deliveredOrders],
                                ["Revenue", `₹${Number(storeDetail.performance.totalRevenue).toLocaleString("en-IN")}`],
                                ["Collected", `₹${Number(storeDetail.performance.totalCollected).toLocaleString("en-IN")}`],
                                ["Outstanding", `₹${Number(storeDetail.performance.outstanding).toLocaleString("en-IN")}`],
                              ].map(([label, val]) => (
                                <div key={String(label)} className="rounded-xl bg-stone-50 p-3">
                                  <p className="text-[10px] uppercase tracking-wide text-stone-400">{label}</p>
                                  <p className="mt-1 text-sm font-semibold">{val}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Employees */}
                          <div>
                            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-400">Staff ({storeDetail.employees.length})</p>
                            <div className="space-y-2">
                              {storeDetail.employees.length ? storeDetail.employees.map((e) => (
                                <div key={e.id} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
                                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-wine to-wine-dark text-[10px] font-bold text-white">
                                    {e.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{e.name}</p>
                                    <p className="text-xs text-stone-400 truncate">{e.companyRole?.name ?? e.role.replaceAll("_", " ")} · {e.companyStatus.replaceAll("_", " ")}</p>
                                  </div>
                                </div>
                              )) : <p className="text-xs text-stone-400">No staff assigned to this store.</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )) : <EmptyState message="No stores found." />}
            </div>
          </div>
        )}

        {/* Business settings (owner / settings.edit) */}
        {canEditBusiness && (
          <div className="xl:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-wine/10 text-wine"><Building2 size={20} /></span>
              <div><h2 className="font-semibold">Business settings</h2><p className="text-xs text-stone-500">Key/value configuration for Bandhani / Siddhartha Daga</p></div>
            </div>
            <Hint title="What is this">Store business-wide configuration as key/value pairs (for example <code>business_name</code> or <code>gst_number</code>). These are shared across the whole workspace.</Hint>
            <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
              <form onSubmit={saveSetting} className="card space-y-4 p-5">
                <div><label>Key</label><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="business_name" required minLength={2} /></div>
                <div><label>Value</label><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Bandhani & Siddhartha Daga" /></div>
                <button disabled={savingSetting} className="btn-primary w-full">{savingSetting ? "Saving..." : "Save setting"}</button>
              </form>
              <div className="card divide-y divide-stone-100 overflow-hidden">
                <div className="border-b border-stone-100 p-4"><h3 className="section-title">Saved settings</h3><p className="text-xs text-stone-500">{settings.length} configured</p></div>
                {settings.length
                  ? settings.map((s) => (
                      <button key={s.id} type="button" onClick={() => { setKey(s.key); setValue(typeof s.value === "string" ? s.value : JSON.stringify(s.value)); }} className="block w-full p-4 text-left hover:bg-stone-50">
                        <p className="font-mono text-xs font-semibold text-stone-500">{s.key}</p>
                        <p className="mt-1 text-sm">{typeof s.value === "string" ? s.value : JSON.stringify(s.value)}</p>
                      </button>
                    ))
                  : <div className="p-4"><EmptyState message="No business settings yet. Add the first one on the left." /></div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
