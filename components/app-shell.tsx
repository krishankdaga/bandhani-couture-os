"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FileClock, LogOut, Menu, Settings, UserRound } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { labelForPath } from "@/lib/navigation";
import { permissionForPath } from "@/lib/navigation";
import { AccessDenied } from "@/components/access-denied";
import { GlobalSearch } from "@/components/global-search";
import { NotificationCenter } from "@/components/notification-center";
import { CbosAssistant } from "@/components/cbos-assistant";
import { ToastViewport } from "@/components/toast-viewport";

type ShellUser = { name: string; email: string; image: string | null; role: string; companyStatus: string; companyRoleName: string | null; permissions: string[] };

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pageLabel = labelForPath(pathname);
  const detailPage = pathname.split("/").filter(Boolean).length > 1;
  const requiredPermission = permissionForPath(pathname);
  const ownerOnlyPage = pathname.startsWith("/employees") || pathname.startsWith("/roles") || pathname.startsWith("/assistant");
  const canViewPage = (!ownerOnlyPage || user.companyStatus === "OWNER") && (!requiredPermission || user.companyStatus === "OWNER" || user.permissions.includes(requiredPermission));
  const sidebarPermissions = user.companyStatus === "OWNER"
    ? user.permissions
    : user.permissions.filter((permission) => !permission.startsWith("employees.") && !permission.startsWith("roles."));

  useEffect(() => {
    function close(event: MouseEvent) { if (!menuRef.current?.contains(event.target as Node)) setProfileOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function logout() {
    if (!window.confirm("Sign out of Couture OS?")) return;
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.push("/login"); router.refresh(); }
  }

  return <div className="flex min-h-screen bg-sand">
    <Sidebar permissions={sidebarPermissions} companyStatus={user.companyStatus} mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-stone-200/80 bg-white/80 px-4 backdrop-blur-md md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button aria-label="Open navigation" className="rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-50 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link href="/" className="hidden text-stone-400 hover:text-wine sm:inline">Couture OS</Link>
            <ChevronRight size={14} className="hidden text-stone-300 sm:block" />
            {detailPage && <><Link href={`/${pathname.split("/").filter(Boolean)[0]}`} className="text-stone-400 hover:text-accent-deep">{pageLabel}</Link><ChevronRight size={14} className="text-stone-300" /><span className="truncate font-semibold text-ink">Details</span></>}
            {!detailPage && <span className="truncate font-semibold text-ink">{pageLabel}</span>}
          </nav>
        </div>

        <div className="flex items-center gap-2"><GlobalSearch /><NotificationCenter /><div ref={menuRef} className="relative">
          <button aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-xl p-1.5 pr-2 hover:bg-stone-50">
            {user.image
              ? <img src={user.image} alt={user.name} className="h-9 w-9 rounded-lg object-cover ring-1 ring-stone-200" />
              : <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-wine to-wine-dark text-xs font-bold text-white ring-1 ring-gold/30">{initials(user.name)}</span>}
            <span className="hidden text-left md:block"><span className="block max-w-36 truncate text-sm font-semibold">{user.name}</span><span className="block text-[10px] uppercase tracking-wide text-stone-400">{user.companyStatus.replaceAll("_", " ")}</span></span>
            <ChevronDown size={14} className="text-stone-400" />
          </button>
          {profileOpen && <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-pop animate-scale-in">
            <div className="border-b border-stone-100 p-4"><p className="font-semibold">{user.name}</p><p className="mt-0.5 truncate text-xs text-stone-500">{user.email}</p></div>
            <div className="p-2">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-500"><UserRound size={16} /><span>{user.companyRoleName ?? user.role.replaceAll("_", " ")}</span></div>
              {user.permissions.includes("audit.view") && <Link role="menuitem" href="/audit-logs" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"><FileClock size={16} />Audit Logs</Link>}
              {user.permissions.includes("settings.view") && <Link role="menuitem" href="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"><Settings size={16} />Settings</Link>}
            </div>
            <div className="border-t border-stone-100 p-2"><button role="menuitem" disabled={loggingOut} onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><LogOut size={16} />{loggingOut ? "Signing out..." : "Sign out"}</button></div>
          </div>}
        </div></div>
      </header>
      <main className="min-w-0 p-4 md:p-6 lg:p-8">
        <div key={pathname} className="page-enter mx-auto max-w-[1500px]">{canViewPage ? children : <AccessDenied />}</div>
      </main>
    </div>
    {user.companyStatus === "OWNER" && !pathname.startsWith("/assistant") && <CbosAssistant />}
    <ToastViewport />
  </div>;
}
