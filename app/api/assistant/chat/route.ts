import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { randomUUID } from "node:crypto";
import { assistantFallback, assistantSystemPrompt, compactAssistantContext, selectModules, type AssistantContext } from "@/lib/assistant";
import { buildAssistantContext } from "@/lib/assistant-context";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getGroqConfig } from "@/lib/groq-config";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({ question: z.string().trim().min(3).max(500) });

export async function POST(request: NextRequest) {
  // Assistant access is gated by reports.view: owners always have it, managers
  // have it when granted, employees only if explicitly given it. Within the
  // context builder each module is further filtered by the caller's own
  // permissions and store scope, so users only ever see what they are allowed to.
  const user = await requireUser(request, "reports.view");
  if (isApiError(user)) return user;
  let fallbackContext: AssistantContext | null = null;
  let questionForAudit = "";
  let queryId = "";
  try {
    const { question } = schema.parse(await request.json());
    questionForAudit = question;
    const limit = checkRateLimit(`assistant:${user.id}`, 12, 60_000);
    if (!limit.allowed) {
      await writeAudit(prisma, { userId: user.id, action: "RATE_LIMITED", entity: "AssistantQuery", entityId: randomUUID(), metadata: { question } });
      return NextResponse.json(
        { error: "Too many assistant requests. Please wait a minute and try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
      );
    }
    const config = getGroqConfig();
    const context = await buildAssistantContext(user, question);
    fallbackContext = context;
    queryId = randomUUID();
    const audit = (outcome: string, metadata?: Record<string, unknown>) => writeAudit(prisma, {
      userId: user.id, action: "QUERY", entity: "AssistantQuery", entityId: queryId,
      metadata: { question, outcome, modules: selectModules(question), ...metadata },
    });
    if (!config.exists) {
      await audit("LOCAL_FALLBACK", { reason: "not_configured" });
      return NextResponse.json({ answer: assistantFallback(context), fallback: true, generatedAt: new Date() });
    }
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          { role: "system", content: assistantSystemPrompt() },
          { role: "user", content: `Question: ${question}\n\nDatabase context:\n${compactAssistantContext(context)}` },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) {
      await audit("LOCAL_FALLBACK", { groqStatus: response.status, groqMessage: payload.error?.message });
      return NextResponse.json({ answer: assistantFallback(context), fallback: true, generatedAt: new Date() });
    }
    const answer = payload.choices?.[0]?.message?.content?.trim();
    await audit("GROQ_SUCCESS", { model: config.model });
    return NextResponse.json({ answer: answer || "No answer was returned.", generatedAt: new Date() });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error instanceof TypeError)) {
      if (fallbackContext) {
        await writeAudit(prisma, { userId: user.id, action: "QUERY", entity: "AssistantQuery", entityId: queryId || randomUUID(), metadata: { question: questionForAudit, outcome: "LOCAL_FALLBACK", reason: error.name } });
        return NextResponse.json({ answer: assistantFallback(fallbackContext), fallback: true, generatedAt: new Date() });
      }
      return NextResponse.json({ error: "Bandhani Assistant could not load live business data. Please try again." }, { status: 502 });
    }
    return validationError(error);
  }
}
