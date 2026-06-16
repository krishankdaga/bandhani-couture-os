import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, validationError } from "@/lib/api";
import { randomUUID } from "node:crypto";
import { assistantFallback, assistantSystemPrompt, assistantTopics, compactAssistantContext, type AssistantContext } from "@/lib/assistant";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getGroqConfig } from "@/lib/groq-config";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({ question: z.string().trim().min(3).max(500) });

async function buildContext(question: string): Promise<AssistantContext> {
  const topics = assistantTopics(question);
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const context: AssistantContext = { generatedAt: now.toISOString() };

  await Promise.all(topics.map(async (topic) => {
    if (topic === "orders") context.orders = await prisma.order.findMany({
      where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
      select: { orderNumber: true, status: true, delayState: true, deliveryDate: true, orderValue: true, customer: { select: { name: true } }, stylist: { select: { name: true } }, stages: { where: { status: { not: "COMPLETED" } }, select: { type: true, status: true, delayState: true, dueDate: true }, orderBy: { dueDate: "asc" } } },
      orderBy: [{ delayState: "desc" }, { deliveryDate: "asc" }], take: 30,
    }).then((rows) => rows.map((row) => ({ ...row, orderValue: Number(row.orderValue) })));
    if (topic === "inventory") context.inventory = await prisma.inventoryItem.findMany({
      where: { reorderAt: { not: null } }, select: { sku: true, name: true, category: true, quantity: true, reorderAt: true, unit: true, storeId: true }, orderBy: { quantity: "asc" }, take: 50,
    }).then((rows) => rows.filter((row) => Number(row.quantity) <= Number(row.reorderAt)).map((row) => ({ ...row, quantity: Number(row.quantity), reorderAt: Number(row.reorderAt) })));
    if (topic === "purchases") context.purchases = await prisma.purchase.findMany({
      where: { status: { in: ["REQUESTED", "ORDERED"] } }, select: { purchaseNo: true, vendorName: true, status: true, totalAmount: true, expectedDate: true, lines: { select: { itemName: true, quantity: true, unit: true } } }, orderBy: { expectedDate: "asc" }, take: 30,
    }).then((rows) => rows.map((row) => ({ ...row, totalAmount: Number(row.totalAmount), lines: row.lines.map((line) => ({ ...line, quantity: Number(line.quantity) })) })));
    if (topic === "customers") {
      const totals = await prisma.order.groupBy({ by: ["customerId"], _sum: { orderValue: true }, _count: { id: true }, orderBy: { _sum: { orderValue: "desc" } }, take: 10 });
      const customers = await prisma.customer.findMany({ where: { id: { in: totals.map((item) => item.customerId) } }, select: { id: true, name: true, phone: true, store: { select: { name: true } } } });
      const map = new Map(customers.map((item) => [item.id, item]));
      context.topCustomers = totals.map((item) => ({ customer: map.get(item.customerId), orderCount: item._count.id, totalValue: Number(item._sum.orderValue ?? 0) }));
    }
    if (topic === "leads") {
      const [followUps, conversions] = await Promise.all([
        prisma.lead.findMany({ where: { followUpDate: { gte: today, lt: tomorrow }, status: { in: ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED"] } }, select: { name: true, phone: true, status: true, followUpDate: true, stylist: { select: { name: true } } }, orderBy: { followUpDate: "asc" }, take: 30 }),
        prisma.lead.groupBy({ by: ["stylistId"], where: { status: "CONVERTED", stylistId: { not: null } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
      ]);
      const stylists = await prisma.user.findMany({ where: { id: { in: conversions.flatMap((item) => item.stylistId ? [item.stylistId] : []) } }, select: { id: true, name: true } });
      const stylistMap = new Map(stylists.map((item) => [item.id, item.name]));
      context.todayFollowUps = followUps;
      context.stylistConversions = conversions.map((item) => ({ stylist: item.stylistId ? stylistMap.get(item.stylistId) : null, convertedLeads: item._count.id }));
    }
  }));
  return context;
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if (isApiError(owner)) return owner;
  let fallbackContext: AssistantContext | null = null;
  let questionForAudit = "";
  let queryId = "";
  try {
    const { question } = schema.parse(await request.json());
    questionForAudit = question;
    const limit = checkRateLimit(`assistant:${owner.id}`, 12, 60_000);
    if (!limit.allowed) {
      await writeAudit(prisma, { userId: owner.id, action: "RATE_LIMITED", entity: "AssistantQuery", entityId: randomUUID(), metadata: { question } });
      return NextResponse.json(
        { error: "Too many assistant requests. Please wait a minute and try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
      );
    }
    const config = getGroqConfig();
    const context = await buildContext(question);
    fallbackContext = context;
    queryId = randomUUID();
    const audit = (outcome: string, metadata?: Record<string, unknown>) => writeAudit(prisma, {
      userId: owner.id, action: "QUERY", entity: "AssistantQuery", entityId: queryId,
      metadata: { question, outcome, topics: assistantTopics(question), ...metadata },
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
        max_tokens: 700,
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
        await writeAudit(prisma, { userId: owner.id, action: "QUERY", entity: "AssistantQuery", entityId: queryId || randomUUID(), metadata: { question: questionForAudit, outcome: "LOCAL_FALLBACK", reason: error.name } });
        return NextResponse.json({ answer: assistantFallback(fallbackContext), fallback: true, generatedAt: new Date() });
      }
      return NextResponse.json({ error: "Bandhani Assistant could not load live business data. Please try again." }, { status: 502 });
    }
    return validationError(error);
  }
}
