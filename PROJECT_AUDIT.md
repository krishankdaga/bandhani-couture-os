# PROJECT AUDIT — Bandhani / Siddhartha Daga Couture OS

> Generated: 2026-06-16
> Scope: Full static analysis of all source files. No code was modified.

---

## 1. Architecture Overview

### Runtime
| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 15.3.1 |
| Language | TypeScript | 5.8.3 |
| Runtime | Node.js (server components + API routes) | — |

### Data & Auth
| Concern | Technology | Notes |
|---|---|---|
| Database | PostgreSQL | via Prisma 6 |
| ORM | Prisma Client | 6.7.0 |
| Auth | JWT (jose) + bcryptjs | 12-hour sessions, HS256 |
| Session | HTTP-only cookie `cbos_session` | SameSite=Lax, Secure in prod |

### Frontend
| Concern | Technology | Notes |
|---|---|---|
| Styling | Tailwind CSS | 3.4.17 |
| Icons | Lucide React | 0.468.0 |
| Validation | Zod | 3.24.2 |
| Data fetching | Client-side `fetch` via `lib/client.ts` | No SWR, React Query, or tRPC |
| AI | Groq API (llama-3.1-8b-instant) | With structured fallback |
| WhatsApp | Mock provider only | No real WhatsApp Business API |

### Rendering Model
- **Server-rendered**: `app/(app)/layout.tsx` — fetches the user session server-side before painting the shell
- **Client-rendered**: All 16 content pages fetch their own data via `useEffect`/`fetch` after mount
- **API routes**: All under `app/api/`, each independently authenticates via `requireUser()`

---

## 2. Folder Structure

```
bandhani-project/
├── app/
│   ├── (app)/                    # Authenticated pages (wrapped by AppShell)
│   │   ├── layout.tsx            # Server component: auth gate → AppShell
│   │   ├── page.tsx              # Dashboard
│   │   ├── leads/page.tsx
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx     # Customer detail + interaction history
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx     # Order detail
│   │   ├── production/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── purchases/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── incentives/page.tsx
│   │   ├── whatsapp/page.tsx
│   │   ├── assistant/page.tsx    # Owner-only AI page
│   │   ├── employees/page.tsx    # Owner-only
│   │   ├── roles/page.tsx        # Owner-only
│   │   ├── audit-logs/page.tsx
│   │   └── settings/page.tsx
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── api/                      # 43 API route handlers
│   ├── globals.css
│   └── layout.tsx                # Root HTML shell
├── components/                   # Shared UI components (13 files)
├── lib/                          # Business logic utilities (13 files)
├── integrations/
│   └── whatsapp/                 # Mock WhatsApp provider
├── prisma/
│   ├── schema.prisma             # 22 models
│   └── seed.ts
├── tests/                        # 7 unit test files
└── scripts/                      # Dev helper scripts
```

---

## 3. Database Schema Overview

### Models (22 total)

| Model | Purpose | Key Relations |
|---|---|---|
| `Store` | Multi-store tenant | Users, Leads, Customers, Orders |
| `User` | All employees/logins | CompanyRole, Store, Overrides |
| `CompanyRole` | Custom named roles | RolePermission[], Users[] |
| `RolePermission` | Permission strings on a role | CompanyRole |
| `UserPermissionOverride` | Per-user grant/deny | User |
| `UserNotificationRead` | Notification read state | User |
| `Lead` | Sales enquiries (CRM top of funnel) | Store, User(stylist), Customer |
| `Customer` | Converted/direct customers | Store, Lead(optional), Orders |
| `Interaction` | Customer touchpoint log | Customer, User |
| `Communication` | WhatsApp/email message history | Customer |
| `Order` | Couture orders | Customer, User(stylist), Store, Stages |
| `ProductionStage` | 6 fixed production phases per order | Order, User(owner), Pardons |
| `DelayPardon` | Delay excuse requests (owner reviews) | Order/Stage, Users |
| `AuditLog` | Immutable audit trail | User (nullable) |
| `InventoryItem` | Stock items (fabric, accessories, etc.) | StockMovement[] |
| `StockMovement` | Stock in/out/adjustment ledger | InventoryItem |
| `Purchase` | Vendor purchase orders | PurchaseLine[] |
| `PurchaseLine` | Line items within a purchase | Purchase |
| `PricingTemplate` | Cost+margin calculation templates | — |
| `Incentive` | Stylist commission records | — (userId not a FK) |
| `WhatsAppTemplate` | Message templates (4 types) | — |
| `SystemSetting` | Key-value config store | — |

### Key Enums
- `Role` (9 values): OWNER, PARTNER, STORE_MANAGER, STYLIST, PRODUCTION_MANAGER, QC_TEAM, INVENTORY_TEAM, PURCHASE_TEAM, ACCOUNTS_TEAM
- `CompanyStatus` (3 values): OWNER, MANAGER, EMPLOYEE
- `OrderStatus` (6 values): DRAFT, CONFIRMED, IN_PRODUCTION, READY, DELIVERED, CANCELLED
- `ProductionStageType` (6 values): DYEING_PATTERN_CUTTING, EMBROIDERY, STITCHING, QC, STYLIST_QC, DELIVERY
- `DelayState` (3 values): GREEN, YELLOW, RED
- `StageStatus` (4 values): NOT_STARTED, IN_PROGRESS, BLOCKED, COMPLETED
- `LeadStatus` (6 values): NEW, CONTACTED, FOLLOW_UP, QUALIFIED, CONVERTED, LOST
- `PardonStatus` (3 values): REQUESTED, APPROVED, REJECTED
- `PurchaseStatus` (4 values): REQUESTED, ORDERED, RECEIVED, CANCELLED
- `IncentiveStatus` (3 values): PENDING, APPROVED, PAID

### Notable Schema Issues
1. **`Incentive.userId` is a plain `String`, not a FK** — no `@relation` to `User`. If a user is deleted, orphaned incentive records remain with no referential integrity. The incentive cannot join to user data without a separate query.
2. **`PricingTemplate` has no relations** — completely standalone, not linked to Orders or InventoryItems.
3. **`WhatsAppTemplate` has no relation to Order/Customer** — templates exist in DB but the send mechanism is only a mock.
4. **`Communication` and `Interaction` overlap conceptually** — both track customer contact history. Interactions are staff-entered notes; Communications are system-generated messages. The distinction could become confusing.
5. **`Customer.preferences`, `likedPieces`, `piecesTried` are unstructured `Json?`** — no schema enforcement.

---

## 4. Authentication System

### Flow
```
Browser → POST /api/auth/login
  → bcrypt.compare(password, user.passwordHash)
  → SignJWT({ userId, role, companyStatus, ... }, 12h, HS256)
  → Set-Cookie: cbos_session (httpOnly, SameSite=Lax, Secure in prod)
  → redirect to /
```

### Session Verification (per API request)
```
API route → requireUser(request)
  → getRequestUser(request)
    → verifyToken(cookie value)  ← JWT signature + expiry check
    → prisma.user.findFirst({ active: true })  ← DB liveness check
    → resolvePermissions(...)  ← Fresh permissions from DB every request
  → return SessionUser | 401 | 403
```

### Important: Permissions Are Resolved Fresh on Every Request
The JWT only stores identity (id, name, email, role, companyStatus). Permissions are resolved fresh from the database on every authenticated request via `getRequestUser()`. This means permission changes take effect immediately without requiring re-login.

### Auth Cookie Properties
- Name: `cbos_session`
- Expiry: 12 hours
- Flags: httpOnly=true, SameSite=lax, Secure=(production only), Path=/

---

## 5. Permission System

### Three-Layer Model
```
CompanyStatus (OWNER / MANAGER / EMPLOYEE)
    ↓ OWNER bypasses all permission checks
CompanyRole (custom named role with permission strings)
    ↓ sets the base permission set
UserPermissionOverride (per-user grant/deny)
    ↓ overrides individual permissions on top of role
= Final resolved permission set
```

### Permission Strings (48 total across 15 modules)
| Module | Permissions |
|---|---|
| Dashboard | `dashboard.view` |
| Leads | `leads.view`, `leads.create`, `leads.edit`, `leads.convert` |
| Customers | `customers.view`, `customers.create`, `customers.edit` |
| Orders | `orders.view`, `orders.create`, `orders.edit` |
| Production | `production.view`, `production.edit` |
| Inventory | `inventory.view`, `inventory.create`, `inventory.edit`, `inventory.delete`, `inventory.movement` |
| Purchases | `purchases.view`, `purchases.create`, `purchases.receive` |
| Pricing | `pricing.view`, `pricing.create`, `pricing.edit` |
| Reports | `reports.view`, `reports.export` |
| Incentives | `incentives.view`, `incentives.create`, `incentives.approve`, `incentives.pay` |
| WhatsApp | `whatsapp.view`, `whatsapp.edit`, `whatsapp.send` |
| Employees | `employees.view`, `employees.create`, `employees.edit`, `employees.deactivate` |
| Roles & Access | `roles.view`, `roles.create`, `roles.edit` |
| Settings | `settings.view`, `settings.edit` |
| Audit Logs | `audit.view` |

### Legacy Role → Default Permissions Mapping
Pre-set permission bundles in `LEGACY_ROLE_PERMISSIONS` are used as a fallback when a user has no `companyRole` assigned.

### Key Authorization Helpers (lib/api.ts)
- `requireUser(request, permission?)` — 401 if not authed, 403 if missing permission
- `requireOwner(request)` — 403 unless `companyStatus === OWNER`
- `requireAnyPermission(request, permissions[])` — 403 unless user has at least one
- `hasPermission(user, permission)` — synchronous check (OWNER always returns true)

---

## 6. Role System

### System Roles (seeded, isSystem=true)
Owner, Store Manager, Stylist, Production Manager, Inventory Team, Purchase Team, Accounts Team, QC Team, Employee

### Owner-Only Pages
The following pages are restricted to `companyStatus === OWNER` regardless of permissions:
- `/employees`
- `/roles`
- `/assistant`

This is enforced in `AppShell` client-side and in the API routes (`requireOwner()`).

### Navigation Filtering
`navigationForPermissions(permissions, isOwner)` filters `navigationItems` to only include routes where the user has the required permission AND (if `ownerOnly`) the user is an owner.

---

## 7. Sidebar / Navigation Logic

Defined in `lib/navigation.ts`:
- 16 navigation items, each with `{ label, href, icon, permission, ownerOnly? }`
- Sidebar renders only items matching the user's resolved permissions
- Non-owner users also have `employees.*` and `roles.*` permissions filtered from the sidebar even if somehow granted (enforced in `AppShell`)
- Active state: exact match on `/` or `startsWith()` on other paths
- Mobile: slide-in drawer with overlay backdrop
- Desktop: sticky left sidebar, `w-64`

---

## 8. Dashboard Architecture

**API**: `GET /api/dashboard` — single endpoint, 7 parallel Prisma queries

### Data Fetched (permission-conditional)
| Data | Permission Required |
|---|---|
| Active leads today | `dashboard.view` (always) |
| Follow-ups today | `dashboard.view` (always) |
| All active orders + stages | `dashboard.view` (always) |
| Recent audit (8 entries) | `audit.view` |
| Follow-up leads list | `leads.view` |
| Low-stock inventory | `inventory.view` |
| Pending purchases | `purchases.view` |

### Delay Calculation (Client-Independent)
Orders and stages have their `delayState` recalculated live in `GET /api/dashboard` using `calculateStageDelay()` and `aggregateOrderDelay()` — the stored DB values may be stale. The dashboard always shows the freshest state.

### Dashboard Sections
1. KPI strip: Follow-ups today, Active orders, Delayed orders, Deliveries this week
2. "Needs Attention" aggregated panel (follow-ups, low stock, pending purchases, at-risk orders)
3. Quick Actions (permission-filtered buttons)
4. Recent Activity (audit log, if permitted)
5. Production Snapshot (bottleneck summary by stage type)

---

## 9. Search Implementation

**API**: `GET /api/search?q=`

- Minimum 2 characters required
- 5 entity types: Customers, Leads, Orders, Inventory, Purchases
- 5 parallel Prisma queries, max 6 results per type
- Results are permission-scoped and store-scoped
- Supports enum value matching (e.g. searching "RED" matches delay states)
- **Client**: Debounced 250ms, AbortController to cancel in-flight requests
- **Shortcut**: `⌘K` / `Ctrl+K` opens search overlay

---

## 10. Notification Implementation

**API**: `GET /api/notifications`

### Notification Sources (6 parallel queries, permission-gated)
| Type | Data Source | Severity |
|---|---|---|
| Delayed production stages | `ProductionStage` (RED, not COMPLETED) | critical |
| Delayed/at-risk orders | `Order` (RED or YELLOW, active) | critical/warning |
| Low-stock items | `InventoryItem` (qty ≤ reorderAt) | critical(0)/warning |
| Overdue purchase receipts | `Purchase` (REQUESTED/ORDERED) | critical/warning |
| Lead follow-ups due | `Lead` (followUpDate ≤ tomorrow) | warning/info |
| Delay pardons pending | `DelayPardon` (REQUESTED) — owner only | warning |

### Read State
- Persisted in `UserNotificationRead` (userId + notificationKey unique)
- Notification keys are deterministic (e.g., `stage-{id}`, `order-{id}`, `stock-{id}`)
- Re-read if underlying data changes (e.g., order resolves, key remains in DB)

### Polling
- Polls every 60 seconds via `setInterval`
- Max 40 notifications returned (silently truncated)
- No server-sent events or WebSockets

---

## 11. AI Assistant Implementation

**API**: `POST /api/assistant/chat`
**Access**: Owner-only (enforced via `requireOwner()`)

### Architecture
```
Owner submits question
  → Rate limit check (12 req/60s, in-memory per user)
  → assistantTopics(question) → keyword → topic set
  → buildContext(topics) → parallel Prisma queries
  → getGroqConfig() → check GROQ_API_KEY env var
  → If configured: fetch Groq API (llama-3.1-8b-instant, max_tokens=700, temp=0.1)
  → If not configured or request fails: assistantFallback(context) → text summary
  → writeAudit(outcome)
  → return { answer, fallback?, generatedAt }
```

### Context Topics (keyword-matched)
- `orders`: active orders with stages (not DELIVERED/CANCELLED), top 30
- `inventory`: low-stock items only, top 50
- `purchases`: pending purchases (REQUESTED/ORDERED), top 30
- `customers`: top 10 by order value with totals
- `leads`: today's follow-ups + stylist conversion stats

### Fallback
If GROQ_API_KEY not configured OR request fails/times out (15s timeout), a structured text summary of live DB data is returned. Marked as `fallback: true` in response.

### UI
- Floating `Bot` button (bottom-right), owner-only (rendered in AppShell conditionally)
- 5 preset prompts
- `/assistant` page exists but is just a placeholder — actual chat is the floating widget

---

## 12. Inventory Architecture

### API Endpoints
| Method | Path | Permission | Action |
|---|---|---|---|
| GET | `/api/inventory` | `inventory.view` | List all items (with 5 recent movements) |
| POST | `/api/inventory` | `inventory.create` | Create item + optional opening stock movement |
| PATCH | `/api/inventory/[id]` | `inventory.edit` | Update item (no qty change — use movement) |
| DELETE | `/api/inventory/[id]` | `inventory.delete` | Delete item + cascade movements |
| POST | `/api/inventory/[id]/movement` | `inventory.movement` | Record stock in/out/adjustment |

### Store Scoping
Uses `optionalStoreScope()` — inventory items without a `storeId` are visible to all stores (global stock). Items with a `storeId` are only visible to that store's users (except owners).

### Export
`GET /api/export/inventory` (CSV) — requires `reports.export`

---

## 13. Purchase Architecture

### API Endpoints
| Method | Path | Permission | Action |
|---|---|---|---|
| GET | `/api/purchases` | `purchases.view` | List all purchases with lines |
| POST | `/api/purchases` | `purchases.create` | Create PO with line items |
| PATCH | `/api/purchases/[id]` | `purchases.create` | Update PO metadata |
| POST | `/api/purchases/[id]/receive` | `purchases.receive` | Mark as RECEIVED + set receivedDate |

### Purchase Number Generation
`PO-YYYY-NNNNN` — uses `prisma.purchase.count()` inside transaction. Has a race condition potential under concurrent creation (see Technical Debt).

---

## 14. Customer Architecture

### Lifecycle
```
Lead (enquiry) → Lead.convert → Customer (linked via leadId)
                              OR
                 Direct Customer creation (no lead)
```

### Customer Detail Page Features
- Couture profile (preferences, liked pieces, pieces tried)
- Interaction log (staff-entered notes: STORE_VISIT, CALL, WHATSAPP, EMAIL, NOTE)
- Communication history (system-generated WhatsApp/email records)
- Order history with status

### CRITICAL BUG: Missing Interaction Endpoint
`app/(app)/customers/[id]/page.tsx` calls `POST /api/customers/${id}` to add an interaction, but `app/api/customers/[id]/route.ts` only exports `GET` and `PATCH`. There is no `POST` handler. Adding interactions is completely broken and will return a 405 Method Not Allowed.

---

## 15. Production Architecture

### Stage Lifecycle
```
Order created → 6 ProductionStages created automatically
  → Stages: DYEING_PATTERN_CUTTING → EMBROIDERY → STITCHING → QC → STYLIST_QC → DELIVERY
  → First stage: IN_PROGRESS; rest: NOT_STARTED
  → Due dates: evenly distributed between creation and delivery date
  → When all stages COMPLETED → Order status → READY
```

### Delay State Machine (Sticky Design)
```
GREEN → YELLOW (within 2 days of dueDate, stage not completed)
GREEN/YELLOW → RED (past dueDate, stage not completed)
RED → RED (permanent) unless owner approves a DelayPardon
RED + APPROVED_PARDON → YELLOW (never returns to GREEN)
COMPLETED + hasEverBeenRed → YELLOW (historical red preserved)
COMPLETED + never RED → GREEN
```

### Order Delay Aggregation
- Order delay = worst of its stages
- `hasEverBeenRed` is stored permanently and causes order to remain YELLOW even after all stages complete

### Delay Pardon Workflow
1. Production team requests pardon with reason (min 10 chars)
2. Owner sees pardon in Notifications and Production page
3. Owner approves → stage transitions from RED to YELLOW

### Manual Recalculation
`POST /api/delays/recalculate` — recalculates all non-completed stage delay states against current time. Used when delays may have drifted.

---

## 16. Reporting / Export Architecture

### Reports Page (summary only)
`GET /api/reports` — 8 parallel counts/aggregates:
- Lead count, Customer count, Order count, Delayed order count
- Inventory item count, Low-stock count, Purchase count
- Total incentive payable (sum of all Incentive amounts)

### Export Endpoints (CSV)
| Endpoint | Data | Permission |
|---|---|---|
| `/api/export/customers` | Customer list with orders/interactions count | `reports.export` |
| `/api/export/inventory` | Full inventory with movements | `reports.export` |
| `/api/export/purchases` | Purchase orders with lines | `reports.export` |
| `/api/export/reports` | Summary metrics (same as reports page) | `reports.export` |

### No Analytics / Charting
There is no chart library. The reports page is just count cards. Trend analysis, revenue over time, conversion rates — all absent.

---

## 17. API Route Inventory (43 routes)

| Path | Methods | Primary Permission |
|---|---|---|
| `/api/auth/login` | POST | public |
| `/api/auth/logout` | POST | any authed |
| `/api/auth/me` | GET | any authed |
| `/api/dashboard` | GET | `dashboard.view` |
| `/api/search` | GET | any authed |
| `/api/meta` | GET | any of leads/customers/orders/production view |
| `/api/notifications` | GET | any authed |
| `/api/notifications/read` | POST | any authed |
| `/api/notifications/read-all` | POST | any authed |
| `/api/leads` | GET, POST | `leads.view` / `leads.create` |
| `/api/leads/[id]` | GET, PATCH | `leads.view` / `leads.edit` |
| `/api/leads/[id]/convert` | POST | `leads.convert` |
| `/api/customers` | GET, POST | `customers.view` / `customers.create` |
| `/api/customers/[id]` | GET, PATCH | `customers.view` / `customers.edit` |
| `/api/orders` | GET, POST | `orders.view` + `production.view` / `orders.create` |
| `/api/orders/[id]` | GET, PATCH | `orders.view` / `orders.edit` |
| `/api/stages/[id]` | PATCH | `production.edit` |
| `/api/pardons` | POST | `production.edit` |
| `/api/pardons/[id]` | PATCH | owner only |
| `/api/delays/recalculate` | POST | `production.edit` |
| `/api/inventory` | GET, POST | `inventory.view` / `inventory.create` |
| `/api/inventory/[id]` | PATCH, DELETE | `inventory.edit` / `inventory.delete` |
| `/api/inventory/[id]/movement` | POST | `inventory.movement` |
| `/api/purchases` | GET, POST | `purchases.view` / `purchases.create` |
| `/api/purchases/[id]` | GET, PATCH | `purchases.view` / `purchases.create` |
| `/api/purchases/[id]/receive` | POST | `purchases.receive` |
| `/api/pricing` | GET, POST, PATCH | `pricing.view` / `pricing.create` / `pricing.edit` |
| `/api/reports` | GET | `reports.view` |
| `/api/export/customers` | GET | `reports.export` |
| `/api/export/inventory` | GET | `reports.export` |
| `/api/export/purchases` | GET | `reports.export` |
| `/api/export/reports` | GET | `reports.export` |
| `/api/incentives` | GET, POST | `incentives.view` / `incentives.create` |
| `/api/incentives/[id]` | PATCH | `incentives.approve` / `incentives.pay` |
| `/api/whatsapp` | GET, POST | `whatsapp.view` / `whatsapp.edit` |
| `/api/employees` | GET, POST | owner only |
| `/api/employees/[id]` | PATCH | owner only |
| `/api/employees/[id]/reset-password` | POST | owner only |
| `/api/roles` | GET, POST | owner only |
| `/api/roles/[id]` | PATCH, DELETE | owner only |
| `/api/audit-logs` | GET | `audit.view` |
| `/api/settings` | GET, POST | `settings.view` / `settings.edit` |
| `/api/assistant/chat` | POST | owner only |
| `/api/assistant/config` | GET | owner only |

---

## 18. Component Dependency Map

### Shared Components (reused across 3+ pages)
| Component | Used In |
|---|---|
| `PageHeader` | All 16 content pages |
| `StatusBadge` | Dashboard, Orders, Leads, Production, Incentives, Customers, Employees |
| `EmptyState` / `ErrorState` / `LoadingState` / `InlineMessage` | All data pages |
| `AppShell` | All authenticated pages (via layout.tsx) |
| `Sidebar` | AppShell |
| `GlobalSearch` | AppShell header |
| `NotificationCenter` | AppShell header |
| `CbosAssistant` | AppShell (owner-only floating widget) |
| `ToastViewport` | AppShell |
| `PermissionChecklist` | Employees page, Roles page |

### Single-Use Components
| Component | Used In |
|---|---|
| `AccessDenied` | AppShell (permission gate) |
| `phase2-card.tsx` | Unknown — check if used |

---

## 19. Dead Code / Unused Files

| File / Export | Status | Notes |
|---|---|---|
| `lib/phase2-permissions.ts` — all exports | **Imported but unused** | `INVENTORY_ROLES`, `PURCHASE_ROLES`, `PRICING_ROLES`, `REPORT_ROLES`, `INCENTIVE_ROLES`, `WHATSAPP_ROLES`, `SETTINGS_ROLES` are imported in 7 API files but not referenced in any function body. Real access control uses `requireUser(request, "permission.string")`. |
| `lib/navigation.ts` — `navigationForRole()` | **Dead function** | Incomplete mapping (only 4 of 9 roles). Not called from any component or page. `navigationForPermissions()` is used instead. |
| `integrations/whatsapp/mock-provider.ts` | **Used as production implementation** | The mock IS the implementation. WhatsApp sending does not work. |
| `components/phase2-card.tsx` | **Likely dead** | Not referenced in any scanned file — needs verification. |
| `app/(app)/assistant/page.tsx` | **Mostly empty** | Just a placeholder heading — the actual assistant is the `CbosAssistant` floating widget in AppShell. |
| `MANAGEMENT_ROLES`, `LEAD_WRITE_ROLES`, `ORDER_WRITE_ROLES`, `PRODUCTION_WRITE_ROLES` in `lib/permissions.ts` | **Legacy constants, kept for compatibility** | Comments say "kept for compatibility" but grep shows these are not used in API routes (the API routes use permission strings directly). |

---

## 20. Technical Debt

### Critical
1. **Missing `POST /api/customers/[id]` handler** — Adding interactions is completely broken (405 Method Not Allowed). The customer detail page sends `POST /api/customers/${id}` but the route file only exports GET and PATCH.

2. **`Incentive.userId` is not a foreign key** — Declared as `String` with no `@relation`. No referential integrity. Cannot join to `User` table via Prisma relations.

3. **In-memory rate limiter** (`lib/rate-limit.ts`) — Uses a module-level `Map<string, Bucket>`. Resets on every server restart. Doesn't work if Next.js has multiple workers or multiple instances. In production under load this provides essentially no protection.

### High
4. **Inconsistent store scope checks** — `customers/route.ts`, `leads/route.ts`, `orders/route.ts` use raw `user.role` string checks (`!["OWNER", "PARTNER"].includes(user.role)`) instead of `storeScope()`. This is inconsistent with the permission model and could drift as roles evolve. `lib/scope.ts` exists precisely to centralize this logic.

5. **Missing audit trail on Customer create/update** — `POST /api/customers` and `PATCH /api/customers/[id]` do not call `writeAudit()`. All other create/update routes do.

6. **Login response sets `permissions: []` in JWT** — `app/api/auth/login/route.ts` builds `sessionUser` with `permissions: []`. The cookie stores empty permissions. On every subsequent request, `getRequestUser()` resolves permissions fresh from DB, so this is functionally harmless — but the stored JWT misrepresents the user's permissions and could confuse future developers or tooling.

7. **Order/Purchase number race condition** — `count() + 1` inside a transaction. Two concurrent creates will get the same count and generate duplicate `orderNumber`/`purchaseNo`. The `@unique` constraint will cause one to fail with a P2002 error. Should use a sequence or an atomic counter.

8. **No pagination on any list** — Orders, Customers, Leads, Inventory, Purchases all return the full table. At scale (1000+ records), this will cause slow queries and large JSON payloads.

### Medium
9. **`phase2-permissions.ts` dead exports** — Imported in 7 API files, never used. Misleads readers into thinking role-array checks are active when they're not.

10. **Extensive use of `any` types** — `inventory/page.tsx` and `reports/page.tsx` use `useState<any[]>()` and `useState<any>()`. Defeats TypeScript's value in these modules.

11. **Dense one-liner code style** — Many page components (dashboard, global-search, notification-center, customer detail) are compressed to single lines, making them very difficult to read, review, or debug.

12. **Hardcoded default password in employees form** — `const blank = { ..., password: "Password@123", ... }`. This default appears pre-filled in the UI when creating a new employee, which is both insecure and confusing.

13. **`PricingTemplate` not linked to Orders** — Pricing module exists and stores templates, but no mechanism connects a template to an actual order's value calculation. Pricing appears to be advisory only.

14. **Measurement fields hardcoded** — Order form only captures bust, waist, hip, length. Full couture requires many more measurements. The `measurements` DB field is `Json` (allowing arbitrary fields) but the UI restricts to exactly these 4.

15. **`delayedOrders` count in reports is wrong conceptually** — The report counts orders with `delayState IN (YELLOW, RED)`. But YELLOW includes orders that are merely "at risk" (within 2 days of due date), not actually delayed. The label is misleading.

### Low
16. **`navigationForRole()` is dead code** — Defined in `lib/navigation.ts` but never called. Incomplete (only maps 4 of 9 roles).

17. **No loading skeleton on inventory page** — Inventory page shows nothing while loading (no `LoadingState`). Other pages use `<LoadingState />` consistently.

18. **WhatsApp templates created but never sent** — `whatsapp.view`/`whatsapp.edit` permissions exist, templates stored in DB, but `POST /api/whatsapp` only creates templates. No send endpoint exists. `integrations/whatsapp/index.ts` exports a mock provider.

19. **`assistant/page.tsx` is a noop** — The `/assistant` route exists and is listed in navigation (ownerOnly), but the page content is just a heading. The actual assistant is the floating bottom-right widget.

---

## 21. Security Review

### Auth & Sessions
| Issue | Severity | Details |
|---|---|---|
| Weak AUTH_SECRET fallback | High | `process.env.AUTH_SECRET \|\| "development-only-secret-change-me"` — if `AUTH_SECRET` is not set in production, JWT tokens are signed with a known string. Anyone knowing the source code can forge tokens. |
| Middleware only checks cookie presence | Medium | `middleware.ts` checks `request.cookies.has("cbos_session")` — any cookie value passes. Real JWT validation happens per-route in `getRequestUser()`. An invalid/expired token passes the middleware redirect but is caught by each API route. Page routes render but show `AccessDenied` via AppShell. Net effect: expired sessions show AccessDenied instead of redirecting to /login. |
| No CSRF protection | Low | Cookie-based auth without CSRF tokens. `SameSite=Lax` provides some protection for standard cross-site form submissions. For `fetch` with JSON body, same-origin policy applies. Low risk but not formally mitigated. |

### Data Access
| Issue | Severity | Details |
|---|---|---|
| `Incentive.userId` no FK | Medium | Incentive records reference user IDs as raw strings. No referential integrity — records persist after user deletion, potentially exposing ghost data. |
| Role/scope inconsistency | Medium | Some routes check `user.role` directly (`leads`, `customers`, `orders`) while others use `storeScope(user)` utility. If `companyStatus` and `role` diverge (possible for PARTNER with STORE_MANAGER companyStatus), scoping behavior differs between routes. |

### Rate Limiting
| Issue | Severity | Details |
|---|---|---|
| In-memory rate limiter | High | Only the AI assistant is rate-limited. No rate limiting on auth/login (brute force possible), no rate limiting on any other API. The assistant rate limiter resets on restart and doesn't scale. |
| No login brute-force protection | High | `POST /api/auth/login` has no rate limiting. Unlimited password guessing attempts. |

### Secrets
| Issue | Severity | Details |
|---|---|---|
| GROQ_API_KEY in process.env | Low | Standard practice. Ensure this is not logged or exposed via `/api/assistant/config` GET (which returns `safeGroqConfig` — key existence and length only, not the key itself). Acceptable. |

---

## 22. Deployment Readiness Review

### Environment Variables Required
```
DATABASE_URL        # PostgreSQL connection string (required)
AUTH_SECRET         # JWT signing secret (critical — must be set in production)
GROQ_API_KEY        # Optional — assistant falls back gracefully if absent
GROQ_MODEL          # Optional — defaults to llama-3.1-8b-instant
NODE_ENV            # Set to "production" for Secure cookie flag
```

### Not Production-Ready
- `AUTH_SECRET` fallback to hardcoded string is a P0 before production deploy
- No rate limiting on login endpoint
- In-memory rate limiter for assistant won't survive restarts
- Missing customer interaction endpoint (broken feature in production)
- Incentive FK integrity issue

### Ready
- JWT session management is correct
- Permission resolution is fresh-from-DB (no stale permission issues)
- Prisma transactions used for all multi-step operations
- Audit logging on most create/update operations
- Graceful AI fallback when Groq is unavailable
- Store scoping enforced at the API level for most routes
- `active` flag properly gates user login

### Observability
- Audit log in DB covers most operations
- `console.error()` for DB errors — no structured logging, no external monitoring
- No health-check endpoint
- No `/api/status` or similar

---

## 23. Testing

### Coverage
| File | What It Tests |
|---|---|
| `tests/permissions.test.ts` | `resolvePermissions`, `hasPermission` — 4 cases |
| `tests/navigation.test.ts` | Navigation filtering by permission |
| `tests/assistant.test.ts` | `assistantTopics`, `assistantFallback` |
| `tests/csv.test.ts` | CSV generation utility |
| `tests/delay.test.ts` | `calculateStageDelay`, `aggregateOrderDelay` |
| `tests/json.test.ts` | `safeJsonParse`, `safeResponseJson` |
| `tests/persistence-config.test.ts` | `getGroqConfig` parsing |

### Gaps
- Zero integration tests (no actual HTTP/DB tests)
- No tests for API routes
- No tests for React components
- No E2E tests
- Critical auth flow (`createSessionToken`, `getRequestUser`) untested
- Broken customer interaction feature untested (and therefore undetected)
