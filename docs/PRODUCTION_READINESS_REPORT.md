# Production Readiness Report — Bandhani / Siddhartha Daga Couture OS

_Phase 4: Production & Operations Overhaul — Business Workflow Integration_
_Generated: 2026-06-16_

---

## 1. Architecture Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript 5.8 (strict) |
| ORM / DB | Prisma 6 + PostgreSQL |
| Auth | JWT (jose, HS256, 12h) in HTTP-only cookie `cbos_session`; permissions resolved fresh from DB per request |
| Access control | 3 layers — `CompanyStatus` (OWNER bypass) → `CompanyRole` → `UserPermissionOverride`; 48 permission strings across 15 modules |
| Styling | Tailwind + shared primitives in `globals.css` / `components/ui.tsx`; brand palette + Poppins/Libre Baskerville |
| Multi-store | `storeScope()` / `optionalStoreScope()` isolate data for non-owners |
| Audit | `writeAudit()` inside Prisma transactions on every write |

### The connected workflow (this phase's objective)

```
Customers → Leads → Orders → Production → Inventory → Purchases → Reports
                       │          │            │           │
                       └── OrderMaterial (bill of materials) ──┘
                              reserves stock, then consumes it,
                              surfacing shortages → purchase recs
```

**Stock accounting model** (`lib/inventory.ts`):
- `onHand` = physical quantity (moved only by `StockMovement`)
- `reserved` = Σ(`requiredQty` − `consumedQty`) across allocations on **active** orders
- `available` = `onHand` − `reserved` (negative ⇒ shortage)
- `shortage` = max(0, `reserved` − `onHand`)
- Allocating **reserves** without reducing physical stock; consuming converts a reserved portion into a physical `OUT` movement (`onHand` −= qty, `consumedQty` += qty), keeping `available` consistent.

---

## 2. Features Delivered This Phase

| # | Feature | Status |
|---|---|---|
| 1 | **Material allocation** — reserve inventory to orders, see available, prevent over-allocation (with explicit shortage override), adjust/remove | ✅ Done |
| 2 | **Inventory reservation** — available / reserved / consumed shown on inventory; computed live | ✅ Done |
| 3 | **Production consumption** — mark materials consumed → inventory decreases, `StockMovement` + audit log created; allocated/consumed/remaining per order | ✅ Done |
| 4 | **Shortage detection** — automatic; shortage qty, affected orders, surfaced on order detail, command center, dashboard & notifications | ✅ Done |
| 5 | **Purchase recommendations** — `/api/inventory/recommendations`: item, on-hand, reserved, recommended qty, reason, affected orders, est. cost | ✅ Done |
| 6 | **Production Command Center** — active/delayed/at-risk/blocked orders, due-this-week, stage bottlenecks, team capacity, shortage alerts | ✅ Done |
| 8 | **Customer 360** — lifetime value, total/active orders, AOV, outstanding, preferred stylist, favourite customisations, clickable order history | ✅ Done |
| 9 | **Lead conversion analytics** — conversion rate, by-source performance, by-stylist (in Reports) | ✅ Done |
| 10 | **Employee performance** — leads / conversions / sales value (stylists) + stages completed / delays (production), date-ranged | ✅ Done |
| 11 | **Advanced reporting** — date-range sales trend, lead conversion, employee performance, inventory valuation; CSV export preserved | ✅ Done |
| 12 | **Data Health Center** (owner) — 8 integrity/hygiene checks with samples + action links | ✅ Done |
| 14 | **Notification intelligence** — added allocation-based shortage alerts alongside existing low-stock/delay/follow-up/purchase/pardon notifications; read/unread/mark-all preserved | ✅ Enhanced |

### Partially addressed / carried to Phase 5

| # | Feature | Notes |
|---|---|---|
| 7 | Order timeline | Stage progression + audit trail exist; a dedicated visual Created→…→Delivered timeline component is **not** yet built. |
| 13 | Audit & traceability | New actions (`MATERIAL_ALLOCATED/ADJUSTED/CONSUMED/DEALLOCATED`) are written and visible in the existing Audit Logs viewer; no new dedicated viewer added. |
| 15 | Incentive workflow | Schema supports Pending/Approved/Paid; full edit/delete/approval-history UI not built this phase. |
| 16 | Full bug hunt | New code paths reviewed; a full-codebase sweep was not performed. |

---

## 3. Files Changed

**Schema & migrations**
- `prisma/schema.prisma` — added `OrderMaterial` model + relations on `Order`, `InventoryItem`, `User`
- `prisma/migrations/20260616110244_add_order_materials/` — applied

**New domain logic**
- `lib/inventory.ts` — stock standing, shortage & recommendation math
- `lib/api.ts` — added reusable `BusinessError` class

**New APIs**
- `app/api/orders/[id]/materials/route.ts` (GET list + pickable stock, POST allocate/adjust)
- `app/api/orders/[id]/materials/[materialId]/route.ts` (DELETE)
- `app/api/orders/[id]/materials/[materialId]/consume/route.ts` (POST consume)
- `app/api/inventory/recommendations/route.ts`
- `app/api/production/command-center/route.ts`
- `app/api/data-health/route.ts`
- `app/api/reports/analytics/route.ts`

**Modified APIs**
- `app/api/inventory/route.ts` — GET enriched with reserved/available/consumed/shortage/recommendation
- `app/api/dashboard/route.ts` — shortage computation + metric + alerts
- `app/api/notifications/route.ts` — shortage notifications
- `app/api/customers/[id]/route.ts` — 360 summary aggregates

**New pages**
- `app/(app)/production/command-center/page.tsx`
- `app/(app)/data-health/page.tsx`

**Modified pages**
- `app/(app)/orders/[id]/page.tsx` — Materials & allocation section
- `app/(app)/inventory/page.tsx` — reserved/available/consumed + shortage badge
- `app/(app)/customers/[id]/page.tsx` — 360 KPI strip + insights
- `app/(app)/reports/page.tsx` — full analytics rewrite with date range

**Navigation & tests**
- `lib/navigation.ts` — Command Center + Data Health entries
- `tests/navigation.test.ts` — updated expectations

---

## 4. Migrations Created

| Migration | Contents |
|---|---|
| `20260616110244_add_order_materials` | `OrderMaterial` table (`requiredQty`, `consumedQty`, note, `createdById`), unique `(orderId, inventoryItemId)`, indexes on `inventoryItemId` and `orderId`, FKs to Order (cascade), InventoryItem (restrict), User |

Restrict on `InventoryItem` prevents deleting an item that orders depend on — a deliberate integrity guard.

---

## 5. Tests

- Existing suite: **22/22 passing** (`tsx --test`).
- `tests/navigation.test.ts` updated for the two new nav entries.
- No new unit tests were added for `lib/inventory.ts` this phase — **recommended as the first Phase 5 task** (pure functions, high leverage: reserved/available/shortage/recommendation math).

---

## 6. Verification (all green)

```
npx prisma validate   ✓ schema valid
npx prisma generate    ✓ client generated
npx tsc --noEmit       ✓ no type errors
npm test               ✓ 22/22
npm run build          ✓ 60 routes compiled
```

---

## 7. Known Limitations

1. **`AUTH_SECRET` fallback** — `lib/auth.ts` falls back to a dev secret if the env var is missing. **Must set a strong `AUTH_SECRET` in production**; recommend a hard startup guard (Phase 5).
2. **Material picker is not store-scoped** — the order materials picker lists all non-finished-good inventory regardless of store. Acceptable for a single-org couture house; tighten if multi-store inventory isolation becomes strict.
3. **Consumption uses a browser `prompt()`** — functional but unpolished; replace with an inline form (Phase 5).
4. **No pagination** on list APIs (orders, inventory, customers) — fine at couture data volumes, revisit at scale.
5. **No login rate limiting** — `lib/rate-limit.ts` exists but is not wired to the login route.
6. **Reports analytics recompute on each request** — no caching; acceptable now, cache if datasets grow.
7. **WhatsApp** remains a mock provider (no live API).

---

## 8. Deployment Steps

1. **Provision** PostgreSQL; set `DATABASE_URL`.
2. **Secrets**: set a strong `AUTH_SECRET` (32+ random bytes). Set `NODE_ENV=production` (enables secure cookies).
3. **Install**: `npm ci`.
4. **Migrate**: `npx prisma migrate deploy` (applies all migrations including `add_order_materials`).
5. **Generate**: `npx prisma generate`.
6. **Seed** (first deploy only): `npm run seed`.
7. **Build**: `npm run build`.
8. **Start**: `npm start` behind a TLS-terminating reverse proxy.
9. **Smoke test**: hit `/api/health` (unauthenticated DB liveness), log in, create an order, allocate a material, consume it, confirm inventory + audit update.

---

## 9. Backup Strategy

- **Database**: automated daily `pg_dump` (or managed provider snapshots) with ≥30-day retention; weekly full + daily incrementals. Test restores quarterly.
- **Point-in-time recovery**: enable WAL archiving / PITR on the managed Postgres.
- **Pre-migration**: snapshot immediately before `migrate deploy` on every release.
- **Audit log** is the system of record for changes — retain indefinitely; never truncate.
- **Uploaded images** (avatars) are stored as data URLs in the DB, so they are covered by DB backups.

---

## 10. Monitoring Recommendations

- **Liveness/readiness**: poll `/api/health` (returns DB latency); alert on non-200 or latency spikes.
- **Errors**: ship server logs to a collector; alert on 5xx rate. `validationError` already separates expected (4xx) from unexpected (logged) errors.
- **Business signals** (already computed — surface to ops): material shortages, delayed orders, overdue follow-ups, delivered-but-unpaid orders (see Data Health Center).
- **DB**: connection-pool saturation, slow-query log, table growth (AuditLog, StockMovement).
- **Auth**: failed-login rate (after rate limiting is added).

---

## 11. Recommended Phase 5 Roadmap

1. **Hardening** — `AUTH_SECRET` startup guard; wire login rate limiting; add `lib/inventory.ts` unit tests.
2. **Order timeline (Feature 7)** — visual Created → Allocated → Production → QC → Trial → Completed → Delivered, sourced from audit + stage data, with user/date/notes.
3. **Incentive workflow (Feature 15)** — edit/delete, approval & payment history, Pending→Approved→Paid transitions with audit.
4. **Dedicated audit viewer (Feature 13)** — filters by entity/action/user/date over the now-richer audit stream.
5. **Notification depth** — incentive-approval notifications; per-category mute; digest.
6. **UX polish** — replace consume `prompt()` with inline form; store-scope the material picker; pagination on large lists.
7. **Live WhatsApp** integration to replace the mock provider.
8. **Scale** — query caching for analytics; archival strategy for StockMovement/AuditLog.
