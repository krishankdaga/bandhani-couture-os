"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

/* ----------------------------------------------------------------------------
   Branded, focus-trapped confirm / prompt dialog.
   Replaces native window.confirm()/prompt() with an in-app modal that matches
   the design system, traps focus, restores it on close, and resolves a Promise
   so call sites read like `if (await confirm({...})) { ... }`.
---------------------------------------------------------------------------- */

type Tone = "default" | "danger";
type BaseOpts = { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: Tone };
type PromptOpts = BaseOpts & { input: { label?: string; defaultValue?: string; placeholder?: string; type?: string } };

type Request =
  | (BaseOpts & { kind: "confirm"; resolve: (value: boolean) => void })
  | (PromptOpts & { kind: "prompt"; resolve: (value: string | null) => void });

type ConfirmAPI = {
  confirm: (opts: BaseOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<string | null>;
};

const Ctx = createContext<ConfirmAPI | null>(null);

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  const confirm = useCallback(
    (opts: BaseOpts) => new Promise<boolean>((resolve) => setReq({ kind: "confirm", ...opts, resolve })),
    [],
  );
  const prompt = useCallback(
    (opts: PromptOpts) => new Promise<string | null>((resolve) => {
      setValue(opts.input?.defaultValue ?? "");
      setReq({ kind: "prompt", ...opts, resolve });
    }),
    [],
  );

  const close = useCallback((result: boolean | string | null) => {
    setReq((current) => {
      if (current) {
        if (current.kind === "confirm") current.resolve(result as boolean);
        else current.resolve(result as string | null);
      }
      return null;
    });
  }, []);

  const cancel = useCallback(() => close(req?.kind === "prompt" ? null : false), [close, req]);

  useEffect(() => {
    if (!req) return;
    lastFocused.current = document.activeElement as HTMLElement;
    const focusTimer = setTimeout(() => {
      (req.kind === "prompt" ? inputRef.current : confirmBtnRef.current)?.focus();
    }, 0);

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(req!.kind === "prompt" ? null : false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const list = Array.from(focusables);
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
  }, [req, close]);

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}
      {mounted && req && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={cancel} aria-hidden="true" />
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="card animate-scale-in relative w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              {req.tone === "danger" && (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-600"><AlertTriangle size={20} /></span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id="confirm-dialog-title" className="text-lg font-semibold">{req.title}</h2>
                {req.message && <div className="mt-1.5 text-sm leading-relaxed text-stone-500">{req.message}</div>}
                {req.kind === "prompt" && (
                  <div className="mt-4">
                    {req.input.label && <label htmlFor="confirm-dialog-input">{req.input.label}</label>}
                    <input
                      id="confirm-dialog-input"
                      ref={inputRef}
                      type={req.input.type ?? "text"}
                      value={value}
                      placeholder={req.input.placeholder}
                      onChange={(event) => setValue(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); close(value); } }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={cancel}>{req.cancelLabel ?? "Cancel"}</button>
              <button
                type="button"
                ref={confirmBtnRef}
                className={req.tone === "danger" ? "btn-danger" : "btn-primary"}
                onClick={() => close(req.kind === "prompt" ? value : true)}
              >
                {req.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}
