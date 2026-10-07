# PROJECT IMPROVEMENT PLAN — Bandhani / Siddhartha Daga Couture OS

> Generated: 2026-06-16
> Priority tiers: Critical (P0) → High (P1) → Medium (P2) → Nice-to-Have (P3)
> Each item includes estimated scope: XS (< 1h), S (1-4h), M (half-day), L (1-2 days), XL (3-5 days)

---

## P0 — Critical Fixes (Block Production Deploy / Data Integrity)

### P0-1: Set AUTH_SECRET in Production Environment
**Scope: XS**

The JWT signing secret falls back to a hardcoded string: `"development-only-secret-change-me"`. If `AUTH_SECRET` is not set in the production environment, any attacker with source code access can forge valid session tokens for any user.

**Fix:**
- Generate a cryptographically random 64-character secret
- Set `AUTH_SECRET=<secret>` in the production environment (`.env.production`, cloud platform secrets)
- Add a startup check that throws if `AUTH_SECRET` is the fallback value in `NODE_ENV=production`

```ts
// lib/auth.ts — add before secret() usage
if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET environment variable must be set in production");
}
```

---

### P0-2: Fix Broken Customer Interaction POST Endpoint
**Scope: S**

`app/(app)/customers/[id]/page.tsx` calls `POST /api/customers/${id}` to add an interaction, but `app/api/customers/[id]/route.ts` only exports GET and PATCH. Every attempt to add an interaction returns **405 Method Not Allowed**. This feature is completely broken.

**Fix:**
Add a `POST` handler to `app/api/customers/[id]/route.ts`:

```ts
// Handle POST /api/customers/[id] — add interaction
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "customers.edit");
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const data = z.object({
      type: z.nativeEnum(InteractionType),
      summary: z.string().min(2),
    }).parse(await request.json());
    const interaction = await prisma.interaction.create({
      data: { customerId: id, userId: user.id, type: data.type, summary: data.summary },
      include: { user: { select: { name: true } } },
    });
    await writeAudit(prisma, { userId: user.id, action: "ADD_INTERACTION", entity: "Customer", entityId: id, newValue: interaction });
    return NextResponse.json({ interaction }, { status: 201 });
  } catch (error) { return validationError(error); }
}
```

---

### P0-3: Fix Incentive.userId Foreign Key
**Scope: S**

`Incentive.userId` is declared as a plain `String` with no `@relation` to `User`. This means:
- Referential integrity is not enforced
- Prisma cannot join Incentive to User
- The `/api/incentives` GET route fetches all users separately and expects the consumer to correlate

**Fix in `prisma/schema.prisma`:**
```prisma
model Incentive {
  ...
  userId   String
  user     User    @relation(fields: [userId], references: [id])
  ...
}

// Add to User model:
model User {
  ...
  incentives Incentive[]
}
```

Create and run a migration. Update the incentives API to use the relation.

---

### P0-4: Add Rate Limiting to Login Endpoint
**Scope: S**

`POST /api/auth/login` has zero rate limiting. Password brute-forcing is possible with no restriction.

**Fix:**
Apply the existing `checkRateLimit()` helper (or replace with Redis-backed rate limiting):

```ts
// In app/api/auth/login/route.ts, before bcrypt.compare:
const ip = request.headers.get("x-forwarded-for") ?? "unknown";
const limit = checkRateLimit(`login:${ip}`, 10, 60_000); // 10 attempts per minute per IP
if (!limit.allowed) {
  return NextResponse.json({ error: "Too many sign-in attempts. Wait a minute and try again." }, { status: 429 });
}
```

Note: Also see P1-1 to replace the in-memory limiter with Redis.

---

### P0-5: Fix Order/Purchase Number Race Condition
**Scope: S**

Both `POST /api/orders` and `POST /api/purchases` generate sequence numbers by counting existing records:
```ts
const count = await tx.order.count();
const orderNumber = `BD-${year}-${String(count + 1).padStart(5, "0")}`;
```

Under concurrent creates, two requests can read the same count and generate duplicate numbers. The `@unique` constraint will reject one with P2002, giving the user an opaque error.

**Fix Option A (Recommended — PostgreSQL sequence):**
```sql
CREATE SEQUENCE order_number_seq START 1;
```
```ts
const seq = await tx.$queryRaw`SELECT nextval('order_number_seq')`;
const orderNumber = `BD-${year}-${String(Number(seq[0].nextval)).padStart(5, "0")}`;
```

**Fix Option B (simpler — retry on conflict):**
Wrap the create in a retry loop that catches P2002 and regenerates.

---

## P1 — High Impact Improvements

### P1-1: Replace In-Memory Rate Limiter with Redis/Upstash
**Scope: M**

The current `lib/rate-limit.ts` uses a module-level `Map`. It:
- Resets on every Next.js hot reload in development
- Doesn't survive server restarts
- Doesn't work across multiple instances or Vercel serverless workers

**Fix:**
Replace with `@upstash/ratelimit` (Redis-backed, works on serverless):
```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(12, "60s"),
});
```

Apply to: login endpoint AND assistant chat endpoint.

---

### P1-2: Add Audit Trail for Customer Create and Update
**Scope: XS**

`POST /api/customers` and `PATCH /api/customers/[id]` do not call `writeAudit()`. Every other create/update operation is audited. Customers are a core business entity — changes should be traceable.

**Fix:**
Wrap customer create in a `$transaction` and call `writeAudit()`:
```ts
// In POST /api/customers/route.ts
const customer = await prisma.$transaction(async (tx) => {
  const created = await tx.customer.create({ ... });
  await writeAudit(tx, { userId: user.id, action: "CREATE", entity: "Customer", entityId: created.id, newValue: created });
  return created;
});
```

Same pattern for PATCH.

---

### P1-3: Fix Inconsistent Store Scope Checks
**Scope: S**

`app/api/customers/route.ts`, `app/api/leads/route.ts`, and `app/api/orders/route.ts` use raw role string checks for store scoping:
```ts
user.storeId && !["OWNER", "PARTNER"].includes(user.role) ? { storeId: user.storeId } : {}
```

The canonical utility `storeScope(user)` in `lib/scope.ts` uses `companyStatus`, which is the correct field. The raw role check is inconsistent and will diverge if role assignments change.

**Fix:**
Replace the inline checks with `storeScope(user)` in all three files:
```ts
// Replace ad-hoc role check with:
import { storeScope } from "@/lib/scope";
where: { ...storeScope(user), ... }
```

---

### P1-4: Add Pagination to All List APIs
**Scope: L**

All list endpoints (`GET /api/orders`, `/api/customers`, `/api/leads`, `/api/inventory`, `/api/purchases`) return the full table with no pagination. At scale (1000+ records), this causes:
- Slow Prisma queries
- Large JSON payloads over the wire
- Long client-side render times

**Fix:**
Add cursor-based or offset pagination to all list routes:
```ts
const page = parseInt(request.nextUrl.searchParams.get("page") ?? "1");
const limit = 50;
const items = await prisma.order.findMany({
  ...where,
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: "desc" },
});
const total = await prisma.order.count({ where });
return NextResponse.json({ orders: items, total, page, pages: Math.ceil(total / limit) });
```

Update page components to handle pagination UI.

---

### P1-5: Remove Dead Code — phase2-permissions.ts Imports
**Scope: XS**

`lib/phase2-permissions.ts` exports are imported in 7 API files but never used in any function body. They create the false impression that role-array gating is active.

**Files to fix (remove unused import):**
- `app/api/inventory/route.ts` — `import { INVENTORY_ROLES }`
- `app/api/inventory/[id]/route.ts` — `import { INVENTORY_ROLES }`
- `app/api/purchases/route.ts` — `import { PURCHASE_ROLES }`
- `app/api/reports/route.ts` — `import { REPORT_ROLES }`
- `app/api/incentives/route.ts` — `import { INCENTIVE_ROLES }`
- `app/api/whatsapp/route.ts` — `import { WHATSAPP_ROLES }`
- `app/api/settings/route.ts` — `import { SETTINGS_ROLES }`

Then delete `lib/phase2-permissions.ts`.

Also delete `navigationForRole()` from `lib/navigation.ts` (dead function, only partially maps 4 of 9 roles, never called).

---

### P1-6: Add TypeScript Types to Inventory and Reports Pages
**Scope: S**

`app/(app)/inventory/page.tsx` uses `useState<any[]>()` and `useState<any>()` throughout. `app/(app)/reports/page.tsx` uses `useState<any>(null)`. These bypass TypeScript's value entirely.

**Fix:**
Define proper types matching the API response shape and replace all `any` usages. Pattern already established in other pages (e.g., `orders/page.tsx`, `production/page.tsx`).

---

### P1-7: Remove Hardcoded Default Password from Employees Form
**Scope: XS**

`const blank = { ..., password: "Password@123", ... }` pre-fills the password field when creating a new employee. This is insecure UX — it encourages weak passwords and makes it unclear the field needs to be changed.

**Fix:**
Change `password: "Password@123"` to `password: ""` in the blank form state. Make the field required and let the admin choose a password. Optionally add a "Generate password" button.

---

### P1-8: Link Purchase Receive to Inventory Stock Update
**Scope: M**

Currently, `POST /api/purchases/[id]/receive` marks the purchase as received but does NOT update `InventoryItem` quantities. This means received stock must be manually entered separately in the inventory module. In a real couture operation, receiving a purchase should automatically record a `StockMovement.IN`.

**Fix:**
In the receive handler, for each `PurchaseLine`, attempt to match to an `InventoryItem` by name (or SKU if added to purchase lines), and create a `StockMovement` of type `IN`. If no match found, log a warning.

This requires either:
- Adding an `inventoryItemId` FK to `PurchaseLine`
- Or fuzzy matching by `itemName`

---

## P2 — Medium Priority Improvements

### P2-1: Link Pricing Templates to Orders
**Scope: M**

`PricingTemplate` is completely disconnected from `Order`. Pricing is advisory only. There is no mechanism to attach a calculated price to an order.

**Options:**
- Add `pricingTemplateId` FK to `Order`
- Or add a `priceBreakdown Json?` field to `Order` capturing the snapshot

---

### P2-2: Expand Measurement Fields
**Scope: S**

The order creation form only captures 4 measurements (bust, waist, hip, length). The `Order.measurements` DB field is `Json` (flexible), but the UI hardcodes exactly 4 fields. A couture fitting requires many more (sleeve, neck, shoulder width, etc.).

**Fix:**
Replace the hardcoded 4-field UI with a dynamic measurement form driven by a configurable list stored in `SystemSetting`.

---

### P2-3: Fix Middleware to Redirect on Invalid JWT
**Scope: XS**

`middleware.ts` only checks `request.cookies.has("cbos_session")` for page routes. An expired or tampered JWT passes this check, causing `AppShell` to render with `AccessDenied` instead of redirecting to `/login`.

**Fix:**
Verify the JWT in middleware for page routes:
```ts
// middleware.ts
import { jwtVerify } from "jose";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "development-only-secret-change-me");

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  const token = request.cookies.get("cbos_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", request.url));
  try {
    await jwtVerify(token, secret());
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("cbos_session");
    return response;
  }
}
```

---

### P2-4: Add Dedicated Lead Detail Page (`/leads/[id]`)
**Scope: M**

The global search links to `/leads?search=<phone>` for lead results, not to a specific lead. There is no lead detail page — all lead editing happens inline on the list page. Adding a detail page would enable: full interaction history, lead timeline, conversion context.

---

### P2-5: Add Orders Export to CSV
**Scope: XS**

`GET /api/export/customers`, `/inventory`, `/purchases`, `/reports` all exist, but there is no `GET /api/export/orders`. Orders are the most critical business data.

**Fix:** Add `app/api/export/orders/route.ts` following the same pattern.

---

### P2-6: Add Audit Log Export
**Scope: XS**

Audit logs can't be exported. For a production ERP with compliance requirements, this is a gap.

**Fix:** Add `GET /api/export/audit-logs` returning CSV.

---

### P2-7: Add `inventory.movement` Permission Check to Movement Route
**Scope: XS**

Verify `app/api/inventory/[id]/movement/route.ts` uses `requireUser(request, "inventory.movement")`. Confirm the permission string is enforced correctly and not just defaulting to `inventory.edit`.

---

### P2-8: Replace `delayedOrders` Label in Reports
**Scope: XS**

The reports page shows "Delayed Orders" with a count that includes both YELLOW (at risk) and RED (delayed) orders. "At risk" and "delayed" are meaningfully different states. The label misleads.

**Fix:** Split into two cards: "Orders at risk" (YELLOW count) and "Delayed orders" (RED count).

---

### P2-9: Add Customer Couture Profile Edit UI
**Scope: S**

`Customer.likedPieces` and `Customer.piecesTried` are visible on the customer detail page but not editable. The PATCH endpoint accepts updates, but there's no edit form in the UI.

**Fix:** Add an edit section or modal on the customer detail page for liked/tried pieces.

---

### P2-10: Add `/api/auth/me` Session Sync
**Scope: S**

Multiple pages call `GET /api/auth/me` to get the current user's permissions. This requires an additional round-trip on page load. Permissions are already available from the `AppShell` props.

**Fix:** Pass permissions down from AppShell (already available as `user.permissions`) to child pages via React Context, eliminating redundant `/api/auth/me` calls from Orders, Leads, Production pages.

---

### P2-11: Add Health Check Endpoint
**Scope: XS**

No `GET /api/health` endpoint exists. Required for uptime monitoring, load balancers, and deployment verification.

**Fix:**
```ts
// app/api/health/route.ts
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
```

---

### P2-12: Add Inventory Loading State
**Scope: XS**

The inventory page calls `api("/api/inventory")` in `useEffect` but shows nothing while loading (no `<LoadingState />`). All other pages use the shared `LoadingState` component. This creates an inconsistent UX.

---

### P2-13: Resolve `phase2-card.tsx` Status
**Scope: XS**

`components/phase2-card.tsx` exists but does not appear to be imported anywhere in the scanned codebase. Confirm it is truly unused and delete it, or document its intended use.

---

### P2-14: Add Notification Persistence for Dynamic Keys
**Scope: S**

Notification keys like `stage-{id}`, `order-{id}` are deterministic — if the underlying record is resolved (e.g., stage completed), the notification disappears from the list, but the `UserNotificationRead` record remains in the DB with a stale key. This is harmless but accumulates junk rows over time.

**Fix:** Add a periodic cleanup job or prune stale notification read records when notifications are fetched.

---

## P3 — Nice-to-Have Improvements

### P3-1: Multi-Turn AI Assistant (Conversation History)
**Scope: L**

The AI assistant is stateless — each question is independent with no context from prior turns. A multi-turn conversation would allow follow-up questions like "Which of those is most urgent?"

**Fix:**
Store conversation history in component state and pass as `messages` array to Groq:
```ts
messages: [
  { role: "system", content: assistantSystemPrompt() },
  ...history, // prior turns
  { role: "user", content: `Question: ${question}\n\nContext: ${compactAssistantContext(context)}` },
]
```

---

### P3-2: Real WhatsApp Business API Integration
**Scope: XL**

The WhatsApp module is currently a UI for managing templates with a mock send provider. No messages can be sent.

**Fix:**
- Replace `integrations/whatsapp/mock-provider.ts` with a real `WhatsAppBusinessProvider` using the Meta WhatsApp Business Cloud API
- Add phone number formatting/validation
- Add opt-in tracking
- Wire up template variable substitution (customer name, order number, etc.)
- Add a `POST /api/whatsapp/send` endpoint

---

### P3-3: Analytics Dashboard (Charts & Trends)
**Scope: XL**

The reports page shows only current counts. There is no historical trending, funnel analysis, or visual charts. For a business intelligence use case, this is a significant gap.

**Suggested additions:**
- Revenue over time (weekly/monthly line chart)
- Lead → Customer → Order conversion funnel
- Order delay rate trend
- Stylist performance table (orders, value, conversion rate)
- Inventory value trend

**Suggested library:** Recharts or Chart.js (lightweight, good Next.js compatibility).

---

### P3-4: Store Management UI
**Scope: M**

Stores exist in the DB and are used for scoping throughout the app, but there is no UI to create or edit stores. Currently, stores must be created via seed or direct DB access.

**Fix:** Add a simple Store CRUD page under Settings (owner-only).

---

### P3-5: PDF/Print Order Summary
**Scope: M**

Currently only customer profiles have a print button (`window.print()`). Orders don't have a print-friendly view for producing order dockets or delivery receipts.

**Fix:** Add print CSS or a dedicated `/orders/[id]/print` route that renders a clean PDF-ready layout.

---

### P3-6: Bulk Lead Import via CSV
**Scope: L**

Leads can only be created one at a time. For a store with historical walk-in data or social media lead exports, bulk import via CSV upload would save significant time.

**Fix:**
- Add `POST /api/leads/import` accepting multipart CSV
- Parse with the existing `lib/csv.ts` utilities
- Validate and create leads in batch (transaction)
- Return summary: created, skipped (duplicate phone), errored

---

### P3-7: Vendor Address Book
**Scope: M**

`Purchase.vendorName` is a free-text field. Repeated vendors must be retyped each time, with no autocomplete. A vendor registry would ensure consistent naming and enable vendor-level reporting.

**Fix:**
- Add a `Vendor` model (name, phone, address, GST number)
- Add `Purchase.vendorId FK`
- Add vendor management page under Settings
- Add autocomplete to the purchase creation form

---

### P3-8: Auto-Create Incentive on Order Creation
**Scope: S**

Incentives currently require manual creation. The percentage formula is already defined (1.5% of order value). Incentive records should be created automatically when a STYLIST creates an order.

**Fix:**
In `POST /api/orders` transaction, after creating the order, create a `PENDING` incentive for the stylist:
```ts
await tx.incentive.create({
  data: { userId: data.stylistId, orderId: created.id, orderValue: data.orderValue, percentage: 1.5, amount: data.orderValue * 0.015, status: "PENDING" },
});
```

---

### P3-9: Notification Preferences Per User
**Scope: M**

Currently all users receive all notification types their permissions allow (production delays, low stock, follow-ups, etc.). A QC team member might not want purchase notifications. Per-user notification preferences would reduce noise.

**Fix:**
- Add `UserNotificationPreference` model (userId, notificationType, enabled)
- Filter notification query results based on user preferences
- Add preferences UI in a user profile page

---

### P3-10: Session Invalidation on Deactivation
**Scope: S**

When an employee is deactivated (`active = false`), their existing JWT session remains valid for up to 12 hours. `getRequestUser()` does check `active: true`, so the next API call will 401 — but only if they make a request. A deactivated employee could still query the API for up to 12 hours after deactivation if they have an active browser session.

**Fix:**
- Reduce JWT expiry from 12h to 4h
- Or: maintain a server-side session blocklist (Redis Set of invalidated jti values)
- Or: add a `sessionVersion` counter to `User` and include it in the JWT; increment on deactivation

---

### P3-11: Structured Logging
**Scope: M**

API routes currently use raw `console.error()` for database errors. No request ID, no structured JSON, no external log sink.

**Fix:**
- Introduce a logger utility wrapping `console` in development, a structured JSON output in production
- Add `x-request-id` header generation in middleware
- Forward to an external logging service (Axiom, Datadog, Sentry)

---

## Priority Summary

| Priority | Count | Theme |
|---|---|---|
| **P0 — Critical** | 5 | Security, broken feature, data integrity |
| **P1 — High** | 8 | Performance, consistency, reliability |
| **P2 — Medium** | 14 | Feature completeness, UX, code quality |
| **P3 — Nice-to-Have** | 11 | Analytics, integrations, polish |

### Recommended Sprint Order (first 3 sprints)

**Sprint 1 (P0 — Must ship before production)**
- P0-1: Set AUTH_SECRET (XS)
- P0-2: Fix interaction POST endpoint (S)
- P0-3: Fix Incentive FK (S)
- P0-4: Login rate limiting (S)
- P0-5: Order/Purchase number race condition (S)

**Sprint 2 (P1 — Reliability + correctness)**
- P1-1: Redis rate limiter (M)
- P1-2: Customer audit trail (XS)
- P1-3: Consistent store scoping (S)
- P1-5: Remove dead code phase2-permissions (XS)
- P1-7: Remove default password (XS)
- P2-3: Middleware JWT validation (XS)
- P2-11: Health check endpoint (XS)

**Sprint 3 (P1+P2 — Scale + feature gaps)**
- P1-4: Pagination on list APIs (L)
- P1-6: TypeScript types in inventory/reports (S)
- P1-8: Purchase receive → inventory stock update (M)
- P2-5: Orders export CSV (XS)
- P2-8: Fix delayed orders label (XS)
- P2-12: Inventory loading state (XS)
