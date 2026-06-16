export type AssistantContext = Record<string, unknown>;

export function assistantTopics(question: string) {
  const text = question.toLowerCase();
  const topics = new Set<string>();
  if (/delay|production|stage|order|business|status/.test(text)) topics.add("orders");
  if (/stock|inventory|fabric|sku|business|status/.test(text)) topics.add("inventory");
  if (/purchase|vendor|receipt|business|status/.test(text)) topics.add("purchases");
  if (/customer|top customer|business|status/.test(text)) topics.add("customers");
  if (/follow.?up|lead|stylist|convert|business|status/.test(text)) topics.add("leads");
  if (!topics.size) ["orders", "inventory", "purchases", "customers", "leads"].forEach((topic) => topics.add(topic));
  return [...topics];
}

export function assistantSystemPrompt() {
  return "You are Bandhani Assistant for the Bandhani / Siddhartha Daga couture ERP owner. Answer only from the supplied database context. Be concise, use clear bullets when useful, include identifiers and dates, and explicitly say when the context does not contain enough data. Never invent records or totals.";
}

export function compactAssistantContext(context: AssistantContext) {
  return JSON.stringify(context, (_key, value) => typeof value === "bigint" ? value.toString() : value);
}

export function assistantFallback(context: AssistantContext) {
  const labels: Array<[string, string]> = [
    ["orders", "active orders"], ["inventory", "low-stock items"], ["purchases", "pending purchases"],
    ["topCustomers", "top customers"], ["todayFollowUps", "follow-ups today"], ["stylistConversions", "stylist conversion records"],
  ];
  const lines = labels.flatMap(([key, label]) => Array.isArray(context[key]) ? [`- ${context[key].length} ${label}`] : []);
  return [
    "The AI service is temporarily unavailable. Here is a live database snapshot instead:",
    ...(lines.length ? lines : ["- No matching records were available for this question."]),
    `- Snapshot generated ${new Date(String(context.generatedAt)).toLocaleString("en-IN")}`,
    "Open the relevant module for record-level details.",
  ].join("\n");
}
