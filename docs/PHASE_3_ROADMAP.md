# PHASE 3 ROADMAP — Bandhani / Siddhartha Daga Couture OS

> Generated: 2026-06-16  
> Author: Senior Staff Engineer Review  
> Basis: Full static audit of all 43 API routes, 16 pages, 22 Prisma models, 13 lib utilities, 13 components

---

## Scoring Key

**Impact (I):** 5 = Critical / 4 = High / 3 = Medium / 2 = Low / 1 = Marginal  
**Complexity (C):** 1 = Trivial (<1h) / 2 = Simple (1-4h) / 3 = Medium (half-day) / 4 = Complex (1-2d) / 5 = Major (3-5d)  
**Impl. Risk (R):** 1 = Isolated / 2 = Low / 3 = Medium / 4 = Touches auth or schema / 5 = Cross-cutting  
**Priority Score = I × (6 - C) × (6 - R)** — higher is better

---

## Audit Correction

> **The PROJECT_FEATURE_MATRIX.md incorrectly listed "Link purchase receive to inventory" as Missing.**  
> `app/api/purchases/[id]/receive/route.ts` fully implements this: it creates `StockMovement.IN` records and auto-creates `InventoryItem` records from each purchase line (matched by SKU). The purchases UI also has a complete "Receive Stock" flow with SKU + category mapping per line. This feature is **Complete**.

---

## Section 1 — Top 20 Business Value Improvements

Ranked by revenue impact, operational efficiency gain, and business decision quality.

| # | Improvement | I | C | R | Score | Notes |
|---|---|---|---|---|---|---|
| **BV-1** | Fix broken customer interaction endpoint | 5 | 2 | 2 | **100** | Silent 405 on every attempt. Couture is relationship-driven; losing interaction history directly costs repeat business. |
| **BV-2** | Real WhatsApp Business API integration | 5 | 5 | 3 | **30** | WhatsApp is the primary sales channel in Indian couture. Templates exist; sending is mock-only. Templates without send capability are theater. |
| **BV-3** | Orders filter / search on orders list page | 4 | 2 | 1 | **80** | Production managers and stylists must currently hunt via global search. No status or date filter on the orders list itself. High daily friction. |
| **BV-4** | Analytics: revenue trend + conversion funnel | 4 | 5 | 1 | **24** | Owner cannot see if business is growing. Only current-state counts are available. No monthly/quarterly view, no lead→customer→order funnel. |
| **BV-5** | Auto-create incentive on order creation | 4 | 2 | 2 | **80** | Stylist commissions manually tracked → inevitably forgotten → disputes. 1.5% formula is already defined in schema. |
| **BV-6** | Orders export to CSV | 4 | 1 | 1 | **100** | The most operationally critical export (customers, inventory, purchases all export; orders don't). Finance team can't analyse orders outside the system. |
| **BV-7** | Custom date range in reports | 4 | 3 | 1 | **48** | Reports show all-time totals. A 3-year-old business can't distinguish last month from last year. Monthly and quarterly views needed. |
| **BV-8** | Stylist performance report | 4 | 3 | 1 | **48** | Who converts best? Who has the most delayed orders attributed? Currently unknowable. Drives training and incentive decisions. |
| **BV-9** | Lead detail page (`/leads/[id]`) | 4 | 3 | 2 | **40** | `GET /api/leads/[id]` already exists. Leads are managed from a flat list with no timeline, full history, or conversion context. |
| **BV-10** | Link pricing template to order | 3 | 3 | 2 | **27** | Pricing templates are advisory-only; not connected to `Order.orderValue`. Cost vs. actual price analysis is impossible. |
| **BV-11** | Store management UI | 4 | 3 | 2 | **40** | Cannot create or edit stores without direct DB access. Business expansion to a second store is currently blocked by missing CRUD. |
| **BV-12** | Measurement fields expansion | 4 | 3 | 2 | **40** | Only bust/waist/hip/length captured. The DB field is `Json` (flexible). A couture fitting requires 12-15 measurements. Data quality directly affects production outcomes. |
| **BV-13** | Audit log export (CSV) | 3 | 1 | 1 | **75** | No export. Finance/compliance reviews of system changes require exporting logs. |
| **BV-14** | Incentive export / per-employee history | 3 | 2 | 1 | **60** | Accounts team must process payroll but can't export incentive data or view per-stylist summaries. |
| **BV-15** | Customer couture profile edit | 3 | 2 | 1 | **60** | `likedPieces` and `piecesTried` visible but not editable in the UI. PATCH endpoint exists; just no form. High value for repeat client visits. |
| **BV-16** | Lead analytics (by source, conversion rate) | 3 | 3 | 1 | **36** | Which acquisition channel converts? Social media vs. walk-in vs. referral? Currently invisible to the owner. |
| **BV-17** | Vendor address book | 3 | 4 | 3 | **9** | Vendor names are free text. Same vendor entered differently → fragmented vendor reporting. |
| **BV-18** | Order delay report (trend over time) | 3 | 4 | 1 | **12** | Is production improving or worsening? Requires time-series data, not current snapshot. |
| **BV-19** | Bulk lead import via CSV | 3 | 4 | 2 | **18** | Migration from prior system, importing social media leads. One-time but high value at launch. |
| **BV-20** | Production floor order docket (print) | 3 | 2 | 1 | **60** | Order detail already has print CSS. Expanding to a structured production docket with measurements, stages, and vendor assignments avoids physical re-entry. |

**Key insight:** BV-1, BV-3, BV-5, BV-6 are all high-impact at low complexity — these four items alone would substantially improve daily operations and should be in the first sprint.

---

## Section 2 — Top 20 User Experience Improvements

Ranked by reduction in friction, cognitive load, and error rate in daily use.

| # | Improvement | I | C | R | Score | Notes |
|---|---|---|---|---|---|---|
| **UX-1** | Fix broken customer interaction endpoint | 5 | 2 | 2 | **100** | Users submit the interaction form, nothing happens, no error shown. Silent broken feature destroys trust in the system. |
| **UX-2** | Add pagination to all list pages | 5 | 4 | 2 | **40** | At 200+ orders, the list becomes unusable (slow load, slow scroll, no navigation). This affects every power user every day. |
| **UX-3** | Orders list: add filter + search UI | 4 | 2 | 1 | **80** | No status filter, no delay filter, no date filter on the orders list. Production managers must use global search. |
| **UX-4** | Fix expired session to redirect to `/login` | 4 | 2 | 3 | **32** | Expired/invalid JWT shows `AccessDenied` component instead of redirecting. Users see a confusing permission-denied screen after timeout. |
| **UX-5** | Inventory loading state | 3 | 1 | 1 | **75** | Every other page shows `<LoadingState />`. Inventory shows a blank screen. Inconsistent, jarring. |
| **UX-6** | Remove hardcoded default password | 3 | 1 | 1 | **75** | Employee creation form pre-fills `Password@123`. Admin must remember to change it every time. Encourages insecure defaults. |
| **UX-7** | Lead detail page | 4 | 3 | 2 | **40** | Editing a lead inline on a list row with a follow-up date, stylist, budget, and notes is cramped. A detail page with timeline view would match the CRM mental model. |
| **UX-8** | Fix "Delayed Orders" label in Reports | 3 | 1 | 1 | **75** | Report counts YELLOW + RED orders as "delayed." YELLOW means "at risk" (within 2 days). Misleads the owner about production health. A simple label/split fix. |
| **UX-9** | Customer couture profile edit | 3 | 2 | 1 | **60** | During a client visit, the stylist needs to update "liked pieces" and "tried pieces." Currently read-only. Requires API call knowledge to update. |
| **UX-10** | Dashboard auto-refresh (configurable interval) | 3 | 2 | 1 | **60** | Dashboard shows "last updated" time. Currently manual refresh only. Store managers want a live board. A 30-second auto-refresh toggle would transform it into a live dashboard. |
| **UX-11** | Toast feedback consistency | 3 | 2 | 1 | **60** | Inventory and purchases show toasts. Orders, leads, customers show error/success inline only. Inconsistent pattern across modules. |
| **UX-12** | Measurement form: dynamic fields | 3 | 3 | 2 | **27** | Creating an order has 4 hardcoded measurement fields. A couture atelier measures 12-15 points. The DB accepts arbitrary JSON. |
| **UX-13** | Orders: explicit cancel button/workflow | 3 | 2 | 1 | **60** | Cancelling an order requires navigating to the order detail, editing status to CANCELLED. No prominent cancel action. |
| **UX-14** | Lead status pipeline / kanban view | 2 | 4 | 1 | **16** | Sales teams think in terms of pipeline stages, not table rows. Optional view toggle. |
| **UX-15** | Assign multiple line items per purchase | 3 | 3 | 2 | **27** | New purchase form accepts only one line item. `PurchaseLine` supports multiple, but the UI creates a single-line PO. |
| **UX-16** | Session user via React Context | 3 | 3 | 1 | **36** | Orders, Leads, Production each call `GET /api/auth/me` to get permissions. This is already available from AppShell. One extra round-trip on every page load. |
| **UX-17** | Audit log: filter and search | 3 | 3 | 1 | **36** | Current audit log is a plain unfiltered table. Owner needs to find "all changes to order BD-2026-00001" or "all actions by Mira Patel." |
| **UX-18** | `AssistantPage` (`/assistant`) is a noop | 2 | 1 | 1 | **50** | The `/assistant` page shown in the sidebar for owners just has a heading. The actual assistant is the floating widget. The page should render the full assistant experience, not a placeholder. |
| **UX-19** | Purchases: multi-line item creation | 3 | 3 | 2 | **27** | Purchase form creates single-line-item POs. Real purchase orders have multiple items. The API already supports it. |
| **UX-20** | Mobile-responsive improvements | 2 | 4 | 1 | **16** | Tables overflow on mobile. Sidebar requires a drawer. Some forms are hard to use on a phone. Staff on the production floor use mobile devices. |

**Key insight:** UX-1, UX-3, UX-5, UX-6, UX-8 are all trivial-to-simple complexity with high impact. These should be batched into a single clean-up sprint.

---

## Section 3 — Top 20 Technical Improvements

Ranked by maintainability, scalability, and developer confidence impact.

| # | Improvement | I | C | R | Score | Notes |
|---|---|---|---|---|---|---|
| **TI-1** | Replace in-memory rate limiter with Redis | 5 | 3 | 3 | **36** | `lib/rate-limit.ts` uses a module-level `Map`. Resets on every restart. Breaks with multiple workers. Rate limiting provides zero protection in production Vercel/Docker environments. |
| **TI-2** | Add pagination to all list APIs | 5 | 4 | 2 | **40** | Without pagination, every list query grows unboundedly. At 1,000 orders, `GET /api/orders` returns 1,000 full records including stages. Will cause timeout + memory issues. |
| **TI-3** | Fix inconsistent store scope checks | 4 | 2 | 3 | **32** | `customers/route.ts`, `leads/route.ts`, `orders/route.ts` use raw `user.role` string checks instead of `storeScope()`. The `lib/scope.ts` utility exists for this. Mixed checks drift as roles evolve. Potential cross-store data leakage. |
| **TI-4** | Remove dead code — `phase2-permissions.ts` | 4 | 1 | 1 | **100** | 7 API files import role arrays they never use. Creates false impression that role-array gating is active when it's not. One of the most common sources of developer confusion in audits. |
| **TI-5** | Fix TypeScript `any` usage | 4 | 2 | 1 | **80** | Inventory and purchases pages use `useState<any[]>()`. Reports uses `useState<any>(null)`. Undermines type safety in the most data-dense modules. |
| **TI-6** | Fix order/purchase number race condition | 4 | 2 | 4 | **16** | `count() + 1` inside a transaction is not atomic. Two concurrent creates get same count → P2002 → cryptic error. Replace with PostgreSQL sequences. |
| **TI-7** | Fix middleware to verify JWT (not just presence) | 4 | 2 | 3 | **32** | `middleware.ts` checks `request.cookies.has("cbos_session")` — any cookie value passes. Expired sessions show `AccessDenied` UI instead of redirect to login. |
| **TI-8** | Add health check endpoint | 4 | 1 | 1 | **100** | No `/api/health`. Required for load balancers, deployment verification, uptime monitoring. Standard production requirement. |
| **TI-9** | Fix `Incentive.userId` foreign key | 4 | 2 | 5 | **8** | Declared as plain `String` with no `@relation`. No referential integrity. Prisma cannot join Incentive → User. Requires schema migration. |
| **TI-10** | Add customer audit trail | 3 | 2 | 2 | **48** | `POST /api/customers` and `PATCH /api/customers/[id]` don't call `writeAudit()`. Every other create/update does. Inconsistent and creates compliance gap. |
| **TI-11** | Session user via React Context | 3 | 3 | 2 | **27** | Orders, Leads, Production call `GET /api/auth/me` to get permissions already in AppShell. Eliminates redundant DB round-trips on every page load. |
| **TI-12** | Add structured logging | 4 | 3 | 2 | **40** | `console.error()` is not production-grade. No request ID, no structured JSON, no log levels. Cannot debug production incidents without correlatable log lines. |
| **TI-13** | Remove dead function `navigationForRole()` | 3 | 1 | 1 | **75** | In `lib/navigation.ts`. Only maps 4 of 9 roles, never called. Misleads developers reviewing navigation logic. |
| **TI-14** | Add request ID headers for log correlation | 3 | 2 | 2 | **48** | Without request IDs, correlating a user-reported error to a specific API call in logs requires timestamp hunting. |
| **TI-15** | Add integration tests for critical API routes | 5 | 5 | 2 | **25** | Zero API integration tests. Auth flow, order creation, production stage update are all untested. Regressions deploy undetected. |
| **TI-16** | Session versioning / immediate invalidation | 3 | 4 | 4 | **9** | Deactivated employees can still make API calls for up to 12h (the JWT lifetime). `getRequestUser()` checks `active: true` but only on API calls, not in middleware. |
| **TI-17** | Extract reusable list query pattern | 3 | 3 | 2 | **27** | GET list routes all have similar pagination/filter/sort shapes. A shared utility would reduce duplication after pagination is added. |
| **TI-18** | Add E2E tests for critical user flows | 4 | 5 | 1 | **24** | No end-to-end tests. Login → create lead → convert → order → stage update is a core path that's completely untested at integration level. |
| **TI-19** | Normalize `@unique` guard on order numbers | 3 | 1 | 4 | **15** | The DB `@unique` constraint on `orderNumber` is correct, but the error surfaced to the user is a generic "record already exists" rather than a meaningful message. |
| **TI-20** | Document secrets rotation procedure | 3 | 1 | 1 | **75** | No documented process for rotating `AUTH_SECRET` or `GROQ_API_KEY`. Rotation invalidates all active sessions — needs a migration plan. |

---

## Section 4 — Top 20 Production Risks

Ranked by `Likelihood × Impact`. Each item has a severity and estimated time to exploit/manifest.

| # | Risk | Likelihood (L) | Impact (I) | Risk Score (L×I) | Time to Manifest | Action |
|---|---|---|---|---|---|---|
| **PR-1** | `AUTH_SECRET` falls back to hardcoded string if env var not set | 5 | 5 | **25** | Immediate if env not configured | P0 — Set secret before deploy. Add startup guard. |
| **PR-2** | Login endpoint has no rate limiting (brute-force possible) | 4 | 5 | **20** | Hours after exposure | P0 — Add rate limiting to login route. |
| **PR-3** | Customer interaction feature is broken (405) | 5 | 5 | **25** | Every time a staff member tries to log a visit | P0 — Add POST handler to `customers/[id]/route.ts`. |
| **PR-4** | In-memory rate limiter resets on any restart | 5 | 4 | **20** | Every deploy or auto-restart | P0 — Replace with Redis/Upstash for AI assistant endpoint. |
| **PR-5** | Order/purchase number race condition under concurrent load | 3 | 4 | **12** | First busy period (weddings, festivals) | P0 — Use PostgreSQL sequence. |
| **PR-6** | No health check endpoint → blind deploys | 5 | 4 | **20** | Every deployment | P1 — Add `/api/health`. |
| **PR-7** | No pagination → list queries time out at scale | 4 | 4 | **16** | ~6 months of real data (500+ orders) | P1 — Add cursor/offset pagination to all list routes. |
| **PR-8** | Expired JWT shows `AccessDenied` instead of redirect to login | 5 | 3 | **15** | After every 12-hour session expiry | P1 — Verify JWT in middleware. |
| **PR-9** | `Incentive.userId` has no FK → orphaned records on user deletion | 2 | 4 | **8** | First employee offboarding | P1 — Add `@relation` + migration. |
| **PR-10** | Inconsistent store scope — `user.role` vs `storeScope()` | 3 | 4 | **12** | Multi-store deployment or role reassignment | P1 — Normalize to `storeScope()` in 3 routes. |
| **PR-11** | No structured logging → blind in production incidents | 5 | 4 | **20** | First serious production issue | P1 — Add request IDs + structured logger. |
| **PR-12** | Missing customer audit trail → compliance gap | 4 | 3 | **12** | Any regulatory audit | P1 — Add `writeAudit()` to 2 routes. |
| **PR-13** | Deactivated employee can API-call for 12h | 2 | 4 | **8** | Disgruntled employee offboarding | P2 — Session versioning or reduce JWT to 4h. |
| **PR-14** | No CI/CD test gate → regressions deploy undetected | 5 | 4 | **20** | Any code push | P1 — Add typecheck + test to CI. |
| **PR-15** | `WhatsApp` module is mock-only — no messages send | 5 | 3 | **15** | First time staff tries to send a template | P2 — Integrate real API or clearly label as "coming soon." |
| **PR-16** | `PricingTemplate` disconnected from orders — pricing decisions untraceable | 4 | 3 | **12** | Regular business operations | P2 — Link templates to orders. |
| **PR-17** | Measurement fields hardcoded at 4 — production quality gap | 5 | 3 | **15** | First complex order with full-body measurements | P2 — Dynamic measurement fields from config. |
| **PR-18** | Purchases form allows only one line item (UI) | 5 | 3 | **15** | Any multi-item purchase | P2 — Add multi-line UI (API already supports it). |
| **PR-19** | No GROQ_API_KEY rotation procedure | 2 | 3 | **6** | If key is leaked or needs rotation | P3 — Document rotation + add startup log of key length only. |
| **PR-20** | No database backup/restore procedure | 2 | 5 | **10** | Data corruption or accidental deletion | P2 — Document and configure automated backups. |

**Three risks score 25 (maximum):** AUTH_SECRET fallback, broken interaction endpoint. Address both before any production traffic.

---

## Section 5 — Consolidated Implementation Roadmap

### Guiding Principles
1. **Stability before features** — fix what's broken before adding
2. **Security before performance** — no traffic on an insecure foundation
3. **Infrastructure before UX** — pagination, logging, health checks enable everything else
4. **High-value / low-complexity first** — maximize return per sprint
5. **Group by blast radius** — changes that touch the same files go in the same sprint

---

### Phase 3.0 — Production Gate (Week 1)
> **Gate:** Nothing deploys to production until this phase is complete and verified.  
> **Theme:** Fix critical security vulnerabilities, broken features, and data integrity issues.  
> **Team:** 1-2 engineers, ~3-4 days

| ID | Task | Files Touched | Scope |
|---|---|---|---|
| **G-1** | Set `AUTH_SECRET` in production environment. Add startup guard that throws if fallback used with `NODE_ENV=production`. | `lib/auth.ts` | XS |
| **G-2** | Add login rate limiting (10 attempts/minute per IP). Use existing `checkRateLimit()` or Upstash for immediate fix. | `app/api/auth/login/route.ts` | S |
| **G-3** | Fix broken customer interaction: add `POST` handler to `app/api/customers/[id]/route.ts`. Creates `Interaction` record, calls `writeAudit()`. | `app/api/customers/[id]/route.ts` | S |
| **G-4** | Fix order and purchase number race conditions. Add PostgreSQL sequences `order_number_seq` and `purchase_number_seq`. Update both POST routes. | `app/api/orders/route.ts`, `app/api/purchases/route.ts`, migration | M |
| **G-5** | Add `@relation` for `Incentive.userId` in Prisma schema. Create and run migration. Update incentives API to use join. | `prisma/schema.prisma`, `app/api/incentives/route.ts` | M |
| **G-6** | Add health check: `GET /api/health` that queries `SELECT 1` and returns DB status. | `app/api/health/route.ts` | XS |
| **G-7** | Add `writeAudit()` to `POST /api/customers` and `PATCH /api/customers/[id]`. Both need transaction wrapping. | `app/api/customers/route.ts`, `app/api/customers/[id]/route.ts` | S |

**Exit criteria for Phase 3.0:**
- [ ] `AUTH_SECRET` set and startup guard active
- [ ] Login endpoint returns 429 after 10 rapid attempts
- [ ] Adding a customer interaction succeeds and shows in the interaction log
- [ ] Creating two orders simultaneously produces two different order numbers
- [ ] `GET /api/health` returns `{ status: "ok", db: "ok" }`
- [ ] Customer create and update appear in audit log

---

### Phase 3.1 — Reliability Foundation (Week 2)
> **Theme:** Infrastructure hardening — logging, Redis, middleware, scope normalization, dead code removal.  
> **Team:** 1-2 engineers, ~4-5 days

| ID | Task | Files Touched | Scope |
|---|---|---|---|
| **R-1** | Replace in-memory rate limiter with Redis/Upstash. Apply to login (from G-2) and assistant chat. | `lib/rate-limit.ts`, 2 API routes | M |
| **R-2** | Fix middleware: verify JWT, delete expired cookie, redirect to `/login`. | `middleware.ts` | S |
| **R-3** | Normalize store scope: replace raw `user.role` checks in `customers/route.ts`, `leads/route.ts`, `orders/route.ts` with `storeScope(user)`. | 3 API route files | S |
| **R-4** | Remove dead code: delete all `phase2-permissions.ts` imports (7 files), then delete the file. Delete `navigationForRole()` from `lib/navigation.ts`. | 8 files | XS |
| **R-5** | Add structured logging utility. Add `x-request-id` header in middleware. Log request ID + duration + status on all API responses. | `lib/logger.ts`, `middleware.ts`, `lib/api.ts` | M |
| **R-6** | Add TypeScript types to `inventory/page.tsx` (replace all `any`), `purchases/page.tsx`, `reports/page.tsx`. | 3 page files | S |
| **R-7** | Remove hardcoded default password from employee form. Clear `password` field in blank form state. | `app/(app)/employees/page.tsx` | XS |
| **R-8** | Fix inventory page: add `<LoadingState />` during data fetch. Consistent with all other pages. | `app/(app)/inventory/page.tsx` | XS |
| **R-9** | Fix "Delayed Orders" label in reports: split into "Orders at risk" (YELLOW) and "Delayed" (RED). Update both `/api/reports` and `reports/page.tsx`. | `app/api/reports/route.ts`, `app/(app)/reports/page.tsx` | S |
| **R-10** | Set up CI: run `npm run typecheck` and `npm run test` on every PR. Block merge on failure. | `.github/workflows/ci.yml` | S |

**Exit criteria for Phase 3.1:**
- [ ] Rate limiting survives a Next.js process restart
- [ ] Expired session redirects to `/login` immediately
- [ ] All three list routes use `storeScope()` consistently
- [ ] `phase2-permissions.ts` is deleted, zero references remain
- [ ] Every API response has `x-request-id` in headers
- [ ] TypeScript compiles with zero errors on changed files
- [ ] Employee creation form has empty password field with required validation
- [ ] Inventory page shows spinner during load

---

### Phase 3.2 — Pagination & Scale (Week 3)
> **Theme:** Make all list views safe at production scale. This is the single most impactful technical change.  
> **Team:** 1-2 engineers, ~4-5 days

| ID | Task | Files Touched | Scope |
|---|---|---|---|
| **P-1** | Add pagination to `GET /api/orders`. Use offset pagination with `page` + `limit` query params. Return `{ orders, total, page, pages }`. | `app/api/orders/route.ts` | M |
| **P-2** | Add pagination to `GET /api/customers`. Same pattern. | `app/api/customers/route.ts` | M |
| **P-3** | Add pagination to `GET /api/leads`. Same pattern. | `app/api/leads/route.ts` | M |
| **P-4** | Add pagination to `GET /api/inventory`. Same pattern. | `app/api/inventory/route.ts` | M |
| **P-5** | Add pagination to `GET /api/purchases`. Same pattern. | `app/api/purchases/route.ts` | M |
| **P-6** | Update all list page components to handle pagination: render page controls, handle `page` state, re-fetch on page change. | 5 page files | L |
| **P-7** | Add filter + search UI to orders list page (status, delay state, delivery date range). The API already supports `storeScope`; just needs query params added. | `app/(app)/orders/page.tsx`, `app/api/orders/route.ts` | M |
| **P-8** | Add pagination + filter to `GET /api/audit-logs` and the audit log page UI (filter by entity, action, user, date range). | `app/api/audit-logs/route.ts`, `app/(app)/audit-logs/page.tsx` | M |

**Exit criteria for Phase 3.2:**
- [ ] Orders list with 500 test records loads in < 300ms
- [ ] Page controls render and navigate correctly on all list pages
- [ ] Orders list can be filtered by status, delay state, and date
- [ ] Audit log can be filtered by entity type and user

---

### Phase 3.3 — Feature Completeness (Weeks 4-5)
> **Theme:** Close the gaps that most affect daily operations. Focus on completing partial features before adding new ones.  
> **Team:** 2 engineers, ~8-10 days

| ID | Task | Files Touched | Scope | BV/UX |
|---|---|---|---|---|
| **F-1** | Orders export to CSV. `GET /api/export/orders` — return order number, customer, value, delivery date, status, delay state, stylist, stage summary. | `app/api/export/orders/route.ts` | XS | BV-6 |
| **F-2** | Audit log export to CSV. `GET /api/export/audit-logs` with date range and entity filter. | `app/api/export/audit-logs/route.ts` | XS | BV-13 |
| **F-3** | Customer couture profile edit: add edit form section on `/customers/[id]` for preferences, likedPieces, piecesTried. PATCH endpoint already handles these fields. | `app/(app)/customers/[id]/page.tsx` | S | BV-15 |
| **F-4** | Incentive: auto-create `PENDING` incentive when a STYLIST creates an order. 1.5% default, cancels if order is cancelled. | `app/api/orders/route.ts` (POST transaction) | S | BV-5 |
| **F-5** | Incentive export: `GET /api/export/incentives` — grouped by user, with status and total. | `app/api/export/incentives/route.ts` | S | BV-14 |
| **F-6** | Purchases form: support multiple line items (add/remove rows). API already handles `lines[]`. | `app/(app)/purchases/page.tsx` | M | UX-19 |
| **F-7** | Lead detail page at `/leads/[id]`: show full lead info, notes, stylist, event/follow-up dates, edit form, and link to converted customer if exists. `GET /api/leads/[id]` already exists. | `app/(app)/leads/[id]/page.tsx` (new) | M | BV-9 |
| **F-8** | Assistant page (`/assistant`) at `/assistant`: render the full chat interface (same as the floating widget) instead of a placeholder heading. Remove the floating widget for owners since the page exists. | `app/(app)/assistant/page.tsx` | S | UX-18 |
| **F-9** | Session user React Context: pass `user` from `AppShell` via `createContext`. Remove `/api/auth/me` calls from Orders, Leads, Production pages. | `components/app-shell.tsx`, 3 page files | M | TI-11 |
| **F-10** | Dashboard auto-refresh: add 30-second interval toggle. Show live indicator when on. Stop interval on tab hide. | `app/(app)/page.tsx` | S | UX-10 |
| **F-11** | Store management: add CRUD page under `/settings` (owner only). Simple table + create/edit form for Store records. | `app/(app)/settings/page.tsx` or new `/stores/page.tsx`, `app/api/stores/route.ts` | M | BV-11 |
| **F-12** | Orders: add explicit cancel workflow. "Cancel order" button with confirmation dialog on order detail page. | `app/(app)/orders/[id]/page.tsx` | S | UX-13 |

**Exit criteria for Phase 3.3:**
- [ ] `/api/export/orders` returns complete CSV
- [ ] Incentive is created automatically when a stylist places an order
- [ ] Customer profile edit saves liked and tried pieces correctly
- [ ] Purchase form supports adding and removing multiple line items
- [ ] `/leads/[id]` renders full lead details and edit form
- [ ] `/assistant` page renders the full chat experience
- [ ] `GET /api/auth/me` no longer called on Orders, Leads, or Production pages

---

### Phase 3.4 — Business Intelligence (Weeks 6-7)
> **Theme:** Give the owner visibility into business trajectory, not just current state.  
> **Team:** 1-2 engineers, ~6-8 days

| ID | Task | Files Touched | Scope | Notes |
|---|---|---|---|---|
| **BI-1** | Reports: add date range filter. API accepts `from` and `to` params. UI adds date picker pair. | `app/api/reports/route.ts`, `app/(app)/reports/page.tsx` | M | BV-7 |
| **BI-2** | Revenue trend chart: weekly/monthly order value aggregated by creation date. Line chart (Recharts or Chart.js). | `app/api/reports/route.ts`, `app/(app)/reports/page.tsx` | L | BV-4 |
| **BI-3** | Lead → Customer → Order conversion funnel (counts per stage, conversion rate %). | `app/api/reports/route.ts`, `app/(app)/reports/page.tsx` | M | BV-4, BV-16 |
| **BI-4** | Stylist performance table: orders placed, total value, converted leads, average order value, on-time rate. | `app/api/reports/route.ts`, `app/(app)/reports/page.tsx` | M | BV-8 |
| **BI-5** | Lead analytics: conversion rate by source (WALK_IN, SOCIAL_MEDIA, REFERRAL, etc.). Bar chart. | `app/api/reports/route.ts`, `app/(app)/reports/page.tsx` | S | BV-16 |
| **BI-6** | Production delay trend: red/yellow orders per week over the last 12 weeks. Is production improving? | `app/api/reports/route.ts` (new aggregation), `app/(app)/reports/page.tsx` | M | BV-18 |
| **BI-7** | Inventory valuation: total stock value (quantity × costPrice) by category. Updated in real-time. | `app/api/reports/route.ts` or dedicated `GET /api/inventory/valuation` | S | BV-4 |
| **BI-8** | AI Assistant improvement: pass conversation history as messages array to Groq. Enable multi-turn Q&A. | `app/api/assistant/chat/route.ts`, `components/cbos-assistant.tsx` | M | — |

**Exit criteria for Phase 3.4:**
- [ ] Reports page accepts date range and all counts reflect that range
- [ ] Revenue trend line chart renders with real data
- [ ] Conversion funnel shows lead→customer→order rates
- [ ] Stylist performance table is accurate and sortable
- [ ] AI assistant can answer follow-up questions in the same session

---

### Phase 3.5 — Integrations & Scale (Weeks 8-10)
> **Theme:** Real-world integrations, measurement quality, and dynamic configuration.  
> **Team:** 2 engineers, ~12-15 days

| ID | Task | Files Touched | Scope | Notes |
|---|---|---|---|---|
| **I-1** | Real WhatsApp Business API integration. Replace `MockWhatsAppProvider`. Add `POST /api/whatsapp/send` with customer ID, template ID, and variable substitution. | `integrations/whatsapp/`, `app/api/whatsapp/route.ts` | XL | BV-2 |
| **I-2** | Dynamic measurement fields: load field definitions from `SystemSetting`. Create/edit order form renders dynamic fields from config. | `app/api/settings/route.ts`, `app/(app)/orders/page.tsx`, `app/(app)/orders/[id]/page.tsx` | L | BV-12 |
| **I-3** | Link pricing template to order: add `pricingTemplateId` FK to `Order`. On order create, optionally select a template. Snapshot cost breakdown. | `prisma/schema.prisma`, `app/api/orders/route.ts`, `app/(app)/orders/page.tsx` | L | BV-10 |
| **I-4** | Vendor address book: `Vendor` model with name, phone, address, GST. Autocomplete in purchase creation form. | `prisma/schema.prisma`, `app/api/purchases/route.ts`, `app/(app)/purchases/page.tsx` | L | BV-17 |
| **I-5** | Bulk lead import via CSV upload: `POST /api/leads/import` accepting multipart CSV. Return created/skipped/error count. | `app/api/leads/import/route.ts`, `app/(app)/leads/page.tsx` | L | BV-19 |
| **I-6** | Production floor order docket: expand print view on `/orders/[id]` to include all measurements, stage assignments, vendor names, reference images list, and customisations. | `app/(app)/orders/[id]/page.tsx` | S | BV-20 |
| **I-7** | Notification preferences per user: `UserNotificationPreference` model. UI to toggle notification types in a user profile page. | `prisma/schema.prisma`, `app/api/notifications/route.ts` | L | — |
| **I-8** | E2E test suite: Playwright tests for login, lead creation/conversion, order creation, and production stage update. Add to CI. | `tests/e2e/`, `.github/workflows/ci.yml` | XL | TI-18 |

---

## Priority Matrix Summary

The table below synthesizes all four rankings into a single view. Items appearing in 3+ sections are the highest leverage changes.

| Change | BV Rank | UX Rank | TI Rank | PR Rank | Combined Priority |
|---|---|---|---|---|---|
| Fix customer interaction POST | 1 | 1 | — | 3 | **P0 Must-do** |
| AUTH_SECRET + startup guard | — | — | — | 1 | **P0 Must-do** |
| Login rate limiting | — | — | — | 2 | **P0 Must-do** |
| Order/purchase number sequence | — | — | 6 | 5 | **P0 Must-do** |
| Incentive FK integrity | — | — | 9 | 9 | **P0 Must-do** |
| Health check endpoint | — | — | 8 | 6 | **P0 Must-do** |
| Customer audit trail | — | — | 10 | 12 | **P0 Must-do** |
| Pagination on all lists | 2 (indirect) | 2 | 2 | 7 | **P1 Critical** |
| Orders list filter/search | 3 | 3 | — | — | **P1 High** |
| Replace in-memory rate limiter | — | — | 1 | 4 | **P1 High** |
| Fix middleware JWT validation | — | 4 | 7 | 8 | **P1 High** |
| Normalize store scope | — | — | 3 | 10 | **P1 High** |
| Remove dead code (phase2-permissions) | — | — | 4 | — | **P1 High** |
| Structured logging + request IDs | — | — | 12,14 | 11 | **P1 High** |
| Orders export to CSV | 6 | — | — | — | **P1 High** |
| Fix TypeScript `any` | — | — | 5 | — | **P1 High** |
| Remove default password | — | 6 | 14 | — | **P1 High** |
| Fix inventory loading state | — | 5 | — | — | **P1 Medium** |
| Fix delayed orders label | — | 8 | — | — | **P1 Medium** |
| Auto-create incentive on order | 5 | — | — | 18 | **P2 High** |
| Lead detail page | 9 | 7 | — | — | **P2 High** |
| Store management UI | 11 | — | — | — | **P2 High** |
| Revenue analytics + charts | 4 | — | — | — | **P2 Medium** |
| WhatsApp real integration | 2 | — | — | 15 | **P2 Medium** |
| Dynamic measurement fields | 12 | 12 | — | 17 | **P2 Medium** |
| Customer couture profile edit | 15 | 9 | — | — | **P2 Low** |
| Session user via Context | — | 16 | 11 | — | **P2 Low** |
| Multi-line purchase form | — | 15,19 | — | 18 | **P2 Low** |

---

## Recommended First 30 Days

```
Week 1: Phase 3.0 — Production Gate
  Day 1   → G-1 (AUTH_SECRET), G-6 (health check), R-7 (remove default password)
  Day 2   → G-3 (fix interaction POST), G-7 (customer audit trail)
  Day 3   → G-2 (login rate limiting)
  Day 4-5 → G-4 (order/purchase sequences), G-5 (Incentive FK + migration)

Week 2: Phase 3.1 — Reliability Foundation
  Day 1   → R-4 (remove dead code), R-8 (inventory loading), R-9 (delayed label)
  Day 2   → R-3 (normalize store scope), R-2 (middleware JWT)
  Day 3   → R-6 (TypeScript types), R-5 (structured logging)
  Day 4   → R-1 (Redis rate limiter)
  Day 5   → R-10 (CI setup), review + deploy to staging

Week 3: Phase 3.2 — Pagination
  Day 1-2 → P-1 through P-5 (API pagination on all 5 list routes)
  Day 3-4 → P-6 (page UI controls), P-7 (orders filter UI)
  Day 5   → P-8 (audit log filter + pagination)

Week 4: Phase 3.3 — Feature Completeness (batch 1)
  Day 1   → F-1 (orders export), F-2 (audit export)
  Day 2   → F-4 (auto-create incentive), F-5 (incentive export)
  Day 3   → F-3 (customer profile edit), F-12 (order cancel button)
  Day 4-5 → F-6 (multi-line purchase form), F-9 (session context)
```

---

## What Not to Build Yet

The following are **deliberately deferred** to Phase 3.5 or beyond:

| Deferred Item | Reason |
|---|---|
| WhatsApp real API | Requires Meta Business verification (external dependency, multi-week process). Start application now, integrate when approved. |
| Lead kanban view | Nice UX. Not blocking any workflow. Defer until core CRM is stable. |
| Mobile-responsive overhaul | Requires design work. Not blocking production use (staff use desktops). |
| Multi-factor authentication | Adds complexity before the base is stable. Address after auth secret is properly set. |
| E2E test suite (Playwright) | High value, high effort. Defer until core feature set is stable — otherwise tests chase moving targets. |
| Notification sound/push | Browser push requires VAPID keys, service workers. Defer to Phase 3.5. |
| Session invalidation on deactivation | The current 12-hour gap is narrow and `getRequestUser()` checks `active:true`. Not an immediate production risk vs. other items. |

---

## Risk Register for Roadmap Execution

| Risk | Mitigation |
|---|---|
| G-5 (Incentive FK migration) breaks existing incentive data | Run migration in transaction with rollback. Test on staging with production data copy first. |
| G-4 (sequence migration) races with existing order creation | Apply sequence migration during a maintenance window. Sequence starts at `MAX(current count) + 1`. |
| Phase 3.2 pagination changes break the production page | Production page fetches all orders for the customer-selection dropdown. Must keep this query unpaginated or implement server-side autocomplete search. |
| WhatsApp API rejected by Meta | Apply early in Phase 3.3. Approval takes 2-6 weeks. Cannot unblock this via code alone. |
| Redis not available in current infrastructure | Use Upstash Redis (serverless, no infrastructure change needed). $0 tier covers expected load. |
