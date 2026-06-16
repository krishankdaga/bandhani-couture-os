"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { groupedNavigation } from "@/lib/navigation";

type SidebarProps = {
  permissions: string[];
  companyStatus: string;
  mobileOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ permissions, companyStatus, mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const sections = groupedNavigation(permissions, companyStatus === "OWNER");
  const allHrefs = sections.flatMap((section) => section.items.map((item) => item.href));

  // Active = the single longest href that matches, so /production/command-center
  // highlights only Command Center, not Production.
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    const matches = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
    if (!matches(href)) return false;
    return !allHrefs.some((other) => other !== href && other.length > href.length && matches(other));
  };

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-stone-200/80 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:w-64 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-20 items-center justify-between border-b border-stone-100 px-5">
          <Link href="/" onClick={onClose} className="flex min-w-0 items-center" aria-label="Bandhani — Siddhartha Daga, Couture OS home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-wordmark.png" alt="Bandhani — Siddhartha Daga" className="w-44 max-w-full object-contain" />
          </Link>
          <button
            aria-label="Close navigation"
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 lg:hidden"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Main navigation">
          {sections.map((section) => (
            <div key={section.group} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-stone-400">{section.group}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "bg-gradient-to-r from-wine to-wine-dark text-white shadow-sm"
                          : "text-stone-600 hover:bg-stone-100 hover:text-accent-deep"
                      }`}
                    >
                      <Icon
                        size={17}
                        className={active ? "text-white" : "text-stone-400 transition group-hover:text-accent-deep"}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
