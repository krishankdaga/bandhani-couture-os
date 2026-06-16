"use client";

import { FormEvent, useState } from "react";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { safeResponseJson } from "@/lib/json";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const result = await safeResponseJson<{ error?: string }>(response, {});
    if (!response.ok) { setError(result.error || `Sign in failed (${response.status})`); setLoading(false); return; }
    router.push("/"); router.refresh();
  }

  return <main className="grid min-h-screen bg-sand lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden bg-gradient-to-br from-wine via-wine to-wine-dark p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-gold/30"/><div className="absolute -bottom-36 -left-20 h-96 w-96 rounded-full border border-white/10"/><div className="absolute right-10 bottom-1/3 h-64 w-64 rounded-full bg-gold/10 blur-3xl"/>
      {/* Brand emblem watermark (inverted to white for the dark panel) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bandhani-emblem.png" alt="" aria-hidden className="pointer-events-none absolute -right-12 bottom-0 h-[460px] w-[460px] object-contain opacity-[0.07] [filter:invert(1)]" />
      <div className="relative flex items-center gap-4"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-gold/30">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/bandhani-emblem.png" alt="Bandhani emblem" className="h-full w-full object-contain" /></span><div><p className="display-title text-lg font-semibold">Bandhani · Siddhartha Daga</p><p className="text-xs font-bold uppercase tracking-[.28em] text-gold">Couture OS</p></div></div>
      <div className="relative max-w-xl"><p className="text-xs font-bold uppercase tracking-[.28em] text-gold">Designed for considered couture</p><h1 className="display-title mt-5 text-5xl font-semibold leading-[1.08]">Every client, order, and atelier detail in one place.</h1><p className="mt-6 max-w-lg text-base leading-relaxed text-white/70">A private operating workspace for the Bandhani / Siddhartha Daga team.</p></div>
      <div className="relative flex gap-6 text-xs text-white/60"><span className="flex items-center gap-2"><ShieldCheck size={15}/>Role-based access</span><span className="flex items-center gap-2"><Sparkles size={15}/>Couture workflows</span></div>
    </section>
    <section className="grid place-items-center p-6 sm:p-10"><div className="w-full max-w-md rounded-2xl border border-stone-200/70 bg-white p-8 shadow-card-lg animate-scale-in sm:p-10">
      <div className="mb-8">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/logo-wordmark.png" alt="Bandhani — Siddhartha Daga" className="mb-7 h-9 w-auto object-contain lg:hidden" /><p className="text-xs font-bold uppercase tracking-[.3em] text-gold">Private team access</p><h2 className="display-title mt-2 text-3xl font-semibold">Welcome back</h2><p className="mt-2 text-sm text-stone-500">Sign in to continue to Couture OS.</p></div>
      <form onSubmit={submit} className="space-y-4">
        <div><label>Email</label><input name="email" type="email" autoComplete="email" placeholder="you@company.com" required /></div>
        <div><label>Password</label><input name="password" type="password" autoComplete="current-password" required /></div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="btn-primary w-full">{loading ? "Signing in..." : "Sign in"}</button>
      </form>
      <div className="mt-6 flex items-start gap-3 rounded-xl bg-stone-50 p-4"><KeyRound size={17} className="mt-0.5 shrink-0 text-gold"/><p className="text-xs leading-relaxed text-stone-500"><strong className="text-stone-700">Forgot your password?</strong><br/>Contact the Bandhani / Siddhartha Daga owner or system administrator to reset access.</p></div>
    </div></section>
  </main>;
}
