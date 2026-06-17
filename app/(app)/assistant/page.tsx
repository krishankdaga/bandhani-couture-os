"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Check, Clock, Copy, Send, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";

type Message = { role: "user" | "assistant"; content: string };

// Entity references the assistant mentions become deep links to the matching
// record list (mirrors the hrefs the global search uses).
const ENTITY_RE = /(\bBD-\d{3,}\b|\bPO-\d{4}-\d{3,}\b)/g;
function entityHref(token: string): string | null {
  if (/^BD-\d+$/.test(token)) return `/orders?search=${encodeURIComponent(token)}`;
  if (/^PO-\d{4}-\d+$/.test(token)) return `/purchases?search=${encodeURIComponent(token)}`;
  return null;
}
function linkifyEntities(text: string, keyPrefix: string) {
  return text.split(ENTITY_RE).map((part, i) => {
    const href = entityHref(part);
    if (href) return <Link key={`${keyPrefix}-e${i}`} href={href} className="link font-medium">{part}</Link>;
    return <span key={`${keyPrefix}-t${i}`}>{part}</span>;
  });
}

const PROMPT_GROUPS: Array<{ label: string; prompts: string[] }> = [
  { label: "Business", prompts: ["Summarise business status today", "What requires attention?", "What happened this week?"] },
  { label: "Orders & production", prompts: ["Which orders are delayed?", "Which orders are due this week?", "Show production bottlenecks"] },
  { label: "Inventory & purchases", prompts: ["Show low stock fabrics", "What inventory is reserved?", "Which purchases are pending receipt?"] },
  { label: "People & stores", prompts: ["Show employee performance", "Compare store performance", "Who are our top customers?"] },
];
const RECENTS_KEY = "bandhani:assistant:recents";

/** Render inline markdown emphasis (**bold**), entity links, and strip stray asterisks. */
function renderInline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).flatMap((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return [<strong key={`${keyPrefix}-b${i}`}>{linkifyEntities(part.slice(2, -2), `${keyPrefix}-b${i}`)}</strong>];
    return linkifyEntities(part.replace(/\*\*?/g, ""), `${keyPrefix}-${i}`);
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
      }}
      className="mt-2 inline-flex items-center gap-1 text-xs text-stone-400 transition hover:text-wine"
      aria-label="Copy answer"
    >
      {copied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
    </button>
  );
}

/** Turn the assistant's lightweight markdown into clean, professional formatting. */
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key} className="my-1.5 space-y-1 pl-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" /><span>{renderInline(b, `${key}-${i}`)}</span></li>
        ))}
      </ul>
    );
    bullets = [];
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (bullet) { bullets.push(bullet[1]); return; }
    flush(`ul-${idx}`);
    if (!line.trim()) return;
    if (heading) { blocks.push(<p key={idx} className="mt-2 font-semibold">{renderInline(heading[1], `h-${idx}`)}</p>); return; }
    blocks.push(<p key={idx} className="leading-relaxed">{renderInline(line, `p-${idx}`)}</p>);
  });
  flush("ul-end");
  return <div className="space-y-1.5">{blocks}</div>;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  // Progressive (typewriter) reveal of the latest answer. The API returns a
  // single JSON answer; we stream it client-side so it feels live without
  // changing the request/response contract.
  const [streaming, setStreaming] = useState<string | null>(null);
  const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = loading || streaming !== null;

  useEffect(() => {
    try { setRecents(JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]")); } catch { /* ignore */ }
  }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading, streaming]);
  useEffect(() => () => { if (streamTimer.current) clearInterval(streamTimer.current); }, []);

  function revealAnswer(full: string) {
    if (streamTimer.current) clearInterval(streamTimer.current);
    if (!full) { setMessages((items) => [...items, { role: "assistant", content: "No answer was returned." }]); return; }
    const step = Math.max(2, Math.ceil(full.length / 80));
    let i = 0;
    setStreaming("");
    streamTimer.current = setInterval(() => {
      i += step;
      if (i >= full.length) {
        if (streamTimer.current) clearInterval(streamTimer.current);
        streamTimer.current = null;
        setStreaming(null);
        setMessages((items) => [...items, { role: "assistant", content: full }]);
      } else {
        setStreaming(full.slice(0, i));
      }
    }, 18);
  }

  function rememberQuestion(value: string) {
    setRecents((prev) => {
      const next = [value, ...prev.filter((item) => item !== value)].slice(0, 8);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  function clearRecents() {
    setRecents([]);
    try { localStorage.removeItem(RECENTS_KEY); } catch { /* ignore */ }
  }

  async function ask(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 3 || busy) return;
    rememberQuestion(trimmed);
    setMessages((items) => [...items, { role: "user", content: trimmed }]);
    setQuestion(""); setLoading(true); setError("");
    try {
      const result = await api<{ answer: string }>("/api/assistant/chat", { method: "POST", body: JSON.stringify({ question: trimmed }) });
      setLoading(false);
      revealAnswer(result.answer);
    } catch (caught) { setError((caught as Error).message); setLoading(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); ask(question); }

  return (
    <>
      <PageHeader eyebrow="Intelligence" title="Bandhani Assistant" description="Your AI business analyst. Ask anything across orders, production, inventory, purchases, customers, leads, employees, incentives and stores — answered from live records." />
      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-wine/10 text-wine"><Sparkles size={19} /></span>
              <div><p className="font-semibold">Quick questions</p><p className="text-xs text-stone-500">Tap to ask instantly.</p></div>
            </div>
            <div className="mt-4 space-y-4">
              {PROMPT_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-stone-400">{group.label}</p>
                  <div className="space-y-2">
                    {group.prompts.map((prompt) => (
                      <button key={prompt} onClick={() => ask(prompt)} disabled={busy} className="w-full rounded-xl border border-stone-200 p-2.5 text-left text-xs font-medium transition hover:border-wine/30 hover:bg-wine/5 disabled:opacity-50">{prompt}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {recents.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold"><Clock size={15} className="text-stone-400" />Recent questions</p>
                <button onClick={clearRecents} className="flex items-center gap-1 text-xs text-stone-400 hover:text-wine"><Trash2 size={13} />Clear</button>
              </div>
              <div className="mt-3 space-y-1.5">
                {recents.map((item) => (
                  <button key={item} onClick={() => ask(item)} disabled={busy} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-stone-600 transition hover:bg-stone-50 hover:text-ink disabled:opacity-50" title={item}>{item}</button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="card flex min-h-[620px] flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-5">
            {!messages.length && !loading && streaming === null && (
              <div className="grid min-h-[430px] place-items-center text-center">
                <div>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-wine/10 text-wine"><Bot size={28} /></span>
                  <h2 className="mt-4 text-lg font-semibold">What would you like to know?</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">Answers are generated from your current records and limited to what you have access to. The assistant will tell you when data is unavailable.</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {["Summarise business status today", "Which orders are delayed?", "Compare store performance"].map((prompt) => (
                      <button key={prompt} onClick={() => ask(prompt)} className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-wine/30 hover:bg-wine/5">{prompt}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {messages.map((message, index) => message.role === "user" ? (
              <div key={index} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-wine to-wine-dark px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">{message.content}</div>
              </div>
            ) : (
              <div key={index} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-wine/10 text-wine"><Bot size={16} /></span>
                <div className="max-w-[80%] rounded-2xl rounded-tl-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm">
                  <FormattedMessage content={message.content} />
                  <CopyButton text={message.content} />
                </div>
              </div>
            ))}
            {streaming !== null && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-wine/10 text-wine"><Bot size={16} /></span>
                <div className="max-w-[80%] rounded-2xl rounded-tl-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm">
                  <FormattedMessage content={streaming} />
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-wine/60 align-middle" aria-hidden />
                </div>
              </div>
            )}
            {loading && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-wine/10 text-wine"><Bot size={16} /></span>
                <div className="max-w-[80%] space-y-2 rounded-2xl rounded-tl-md border border-stone-200 bg-white px-4 py-3">
                  <p className="text-xs text-stone-400">Analysing live records…</p>
                  {["w-40", "w-56", "w-32"].map((width) => <div key={width} className={`h-2.5 animate-pulse rounded bg-stone-200 ${width}`} />)}
                </div>
              </div>
            )}
            {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-stone-100 p-4">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about orders, production, stock, purchases, customers, leads, staff or stores…" />
            <button disabled={busy || question.trim().length < 3} className="btn-primary flex items-center gap-2"><Send size={16} />Send</button>
          </form>
        </section>
      </div>
    </>
  );
}
