export type AssistantContext = Record<string, unknown>;

/**
 * Every business module the assistant can pull live context from. Adding a new
 * module is a matter of extending this union, registering a keyword matcher
 * below, and adding a builder in lib/assistant-context.ts.
 */
export type ModuleKey =
  | "orders"
  | "production"
  | "inventory"
  | "purchases"
  | "customers"
  | "leads"
  | "employees"
  | "incentives"
  | "stores"
  | "notifications"
  | "audit";

/** Keyword matchers used to decide which modules a question touches. */
const MODULE_KEYWORDS: Array<{ key: ModuleKey; re: RegExp }> = [
  { key: "orders", re: /\border|delay|at[-\s]?risk|due|deliver|backlog/i },
  { key: "production", re: /\bproduction|stage|bottleneck|stuck|overdue|stitch|qc\b|embroider|tailor|finishing/i },
  { key: "inventory", re: /\binventory|stock|fabric|sku|reorder|reserved|material|shortage/i },
  { key: "purchases", re: /\bpurchase|vendor|supplier|receipt|procure|po\b/i },
  { key: "customers", re: /\bcustomer|client|buyer|top customer|order value|not ordered|repeat/i },
  { key: "leads", re: /\blead|follow[-\s]?up|convert|conversion|enquir|inquir|prospect/i },
  { key: "employees", re: /\bemployee|staff|team member|workforce|performance|manager|who.*(handl|conver)|most active|pending work/i },
  { key: "incentives", re: /\bincentive|payout|commission|unpaid|approval/i },
  { key: "stores", re: /\bstore|branch|outlet/i },
  { key: "notifications", re: /\bnotification|alert|critical|unread/i },
  { key: "audit", re: /\baudit|change ?log|recent change|history|who changed|modified/i },
];

/** Broad business questions that should pull the operational picture. */
const OVERVIEW_RE = /\b(business|overview|summar(y|ise|ize)|status|attention|today|this week|happen|going on|requir|priorit)/i;
const OVERVIEW_MODULES: ModuleKey[] = ["orders", "production", "inventory", "purchases", "leads", "notifications"];

/**
 * Decide which modules are relevant to a question. Matches keywords, and for
 * broad "how is the business doing" questions (or anything unmatched) falls back
 * to the operational overview set. The result is de-duplicated and ordered.
 */
export function selectModules(question: string): ModuleKey[] {
  const text = question.toLowerCase();
  const selected = new Set<ModuleKey>();
  for (const { key, re } of MODULE_KEYWORDS) if (re.test(text)) selected.add(key);
  if (OVERVIEW_RE.test(text) || selected.size === 0) OVERVIEW_MODULES.forEach((key) => selected.add(key));
  return [...selected];
}

export function assistantSystemPrompt() {
  return [
    "You are Bandhani Assistant, the AI business analyst inside the Bandhani / Siddhartha Daga couture ERP.",
    "Answer the user's question using ONLY the structured database context provided. The context is already filtered to what this user is permitted to see.",
    "Rules:",
    "- Never invent records, counts, totals, names or dates. If the context lacks the data, say so plainly.",
    "- Be concise, accurate and actionable. Lead with the answer.",
    "- Prefer counts and totals first, then a short bulleted list of the key records (use identifiers like order numbers, SKUs, names).",
    "- Group by severity where relevant (Critical / Warning) and end with a one-line Recommended Action when it helps.",
    "- Use INR for money and keep numbers rounded. Use tables only for clear comparisons/rankings.",
    "- The context reflects this user's store scope; do not claim company-wide figures if the data is store-scoped.",
  ].join("\n");
}

export function compactAssistantContext(context: AssistantContext) {
  return JSON.stringify(context, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
}

/** Small helper to read a nested module record from a built context. */
function moduleOf(context: AssistantContext, key: ModuleKey): Record<string, unknown> | undefined {
  const modules = context.modules as Record<string, unknown> | undefined;
  const value = modules?.[key];
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

const num = (value: unknown) => (typeof value === "number" ? value : 0);
const len = (value: unknown) => (Array.isArray(value) ? value.length : 0);

/**
 * Deterministic, data-grounded summary used when the Groq service is
 * unavailable. Reads the same structured context the model would have seen.
 */
export function assistantFallback(context: AssistantContext) {
  const lines: string[] = [];
  const orders = moduleOf(context, "orders");
  if (orders) lines.push(`- Orders: ${num(orders.delayedCount)} delayed, ${num(orders.atRiskCount)} at risk, ${len(orders.dueThisWeek)} due this week`);
  const production = moduleOf(context, "production");
  if (production) lines.push(`- Production: ${len(production.overdueStages)} overdue stages, ${len(production.stuckOrders)} stuck orders`);
  const inventory = moduleOf(context, "inventory");
  if (inventory) lines.push(`- Inventory: ${num(inventory.lowStockCount)} items low/short`);
  const purchases = moduleOf(context, "purchases");
  if (purchases) lines.push(`- Purchases: ${num(purchases.pendingCount)} pending receipt (${num(purchases.overdueCount)} overdue)`);
  const customers = moduleOf(context, "customers");
  if (customers) lines.push(`- Customers: ${len(customers.topCustomers)} ranked by value, ${len(customers.inactiveCustomers)} inactive`);
  const leads = moduleOf(context, "leads");
  if (leads) lines.push(`- Leads: ${num(leads.followUpsDueCount)} follow-ups due, ${num(leads.conversionRate)}% conversion`);
  const employees = moduleOf(context, "employees");
  if (employees) lines.push(`- Employees: ${len(employees.topByActivity)} ranked by activity`);
  const incentives = moduleOf(context, "incentives");
  if (incentives) lines.push(`- Incentives: data available for pending/approved/paid`);
  const stores = moduleOf(context, "stores");
  if (stores) lines.push(`- Stores: ${len(stores.stores)} compared`);

  return [
    "The AI service is temporarily unavailable. Here is a live database snapshot instead:",
    ...(lines.length ? lines : ["- No matching records were available for this question."]),
    `- Snapshot generated ${new Date(String(context.generatedAt)).toLocaleString("en-IN")}`,
    "Open the relevant module for record-level details.",
  ].join("\n");
}
