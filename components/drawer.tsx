"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/* ----------------------------------------------------------------------------
   Right-side slide-in drawer for create/edit flows.
   Replaces inline-expanding forms that shove page content down. Focus-trapped,
   closes on Escape / backdrop, locks body scroll, and restores focus on close.
---------------------------------------------------------------------------- */

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // Keep the latest onClose in a ref so the focus/keydown effect below depends
  // only on `open`. Otherwise a parent passing a fresh onClose on every render
  // (e.g. an inline arrow fn) re-runs the effect on each keystroke, which steals
  // focus back to the first field — the "cursor jumps out after one letter" bug.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement;
    const focusTimer = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), select, textarea, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    }, 0);

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) return;
      const list = Array.from(nodes);
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(focusTimer);
      lastFocused.current?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute right-0 top-0 flex h-full w-full ${width} animate-slide-in-right flex-col bg-white shadow-pop`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-100 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3"><span className="hairline-gold" /><h2 className="text-lg font-semibold">{title}</h2></div>
            {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-ink"><X size={18} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="border-t border-stone-100 bg-stone-50/60 p-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
