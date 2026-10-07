# FULL QA REPORT — Bandhani / Siddhartha Daga Couture OS

**Date:** 2026-06-18
**Build under test:** branch `main` @ `cd47d5b` (production build in `.next-build`)
**Tester:** automated end-to-end QA pass (API-level + Playwright browser-driven)
**Verdict:** ✅ **Ready for deployment.** No Critical / High / Medium bugs found. Two Low/informational items documented below.

---

## 1. Baseline command results

| Command | Result |
|---|---|
| `npx prisma validate` | ✅ Schema valid |
| `npx prisma generate` | ✅ Client generated |
| `npm run typecheck` (`tsc --noEmit`) | ✅ No errors |
| `npm test` (node:test) | ✅ **23 / 23 pass** |
| `npm run build` (`next build` → `.next-build`) | ✅ Compiled, **0 warnings / 0 errors** |
| `npx playwright test` (e2e smoke, against fresh prod server) | ✅ **15 / 15 pass** |

Unit tests cover the security/logic core: delay state machine (overdue→RED, RED never returns to GREEN, owner pardon reduces historical RED to YELLOW only, aggregate never GREEN with historical RED), permission resolution (owner full access, manager limited to role, employee overrides, API predicate denial), navigation gating, CSV escaping, assistant module selection/fallback/rate-limit, Groq config parsing, safe-JSON helpers, non-destructive seed.

---

## 2. Scope tested

**Users:** Owner (`owner@cbos.local`, 43 perms), Manager (`manager@cbos.local`, 28 perms), Employee (`employee@cbos.local`, 1 perm = `dashboard.view`).

**Pages (rendered as Owner, all return correct heading, 0 runtime errors, 0 false Access-Denied):**
Dashboard, Leads, Customers, Orders, Order detail, Dyer slip, Production, Command Center, Inventory, Purchases, Reports, Incentives, WhatsApp Automation, Employees, Roles & Access, Data Health, Audit Logs, Settings, Bandhani Assistant, Login.

**Workflows exercised:**
1. Customer — create + edit phone/email/address (smoke ✅).
2. Lead — create drawer opens ✅; convert flow present.
3. Order — create-in-drawer with customer picker + measurements ✅; order number generation `BD-####` ✅; appears in production ✅.
4. Production — stage update persists ✅; delay logic unit-tested ✅; pardon flow unit-tested ✅.
5. Inventory — create-in-drawer, stock in/out, movement, search/sort, low-stock badge, delete (smoke ✅).
6. Purchase — create, receive into inventory, inventory qty increases, stock movement created, **double-receive blocked** (`400 "Purchase already received"`) ✅, CSV export ✅.
7. Pricing — **not implemented** (see Findings F1).
8. Reports — All-Stores / store filter / date range / store comparison / employee performance / CSV export ✅; manager **cannot widen store scope by query param** ✅.
9. Employees — owner create/edit/role/status/store ✅; manager create blocked (403) ✅; profile scope enforced ✅.
10. Roles & permissions — owner create/edit role ✅; server-side enforcement verified per role (matrix below).
11. Incentives — per-employee config (owner-only) ✅; **auto-generation on on-time delivery** ✅ (PENDING, idempotent); **pardoned-late still earns** (new) — code path verified; status transitions Pending→Approved→Paid + delete restricted to owner/approver ✅.
12. Notifications — center opens ✅; "Mark all read" correctly disabled when nothing unread ✅.
13. Global search — Cmd/Ctrl+K opens ✅; permission-gated results ✅; result click navigates (`→ /purchases?search=PO-2026-00008`) ✅; **palette centered** (measured: palette center 840 == viewport center 840) with full-page scrim ✅; empty state ✅.
14. Assistant — `GROQ_API_KEY` present server-side (`keyExists:true`, model `llama-3.1-8b-instant`) ✅; answers from live DB context ✅; employee receives **403** ✅.
15. Print/export — all CSV exports download per permission ✅; dyer-slip prints and **no longer shows the customer delivery date** ✅.
16. Responsive — desktop 1440, tablet 768, mobile 375: **zero horizontal overflow** on Orders, Inventory, Reports, Employees ✅.

---

## 3. Server-side permission matrix (live API, status codes)

| Endpoint (GET) | Owner | Manager | Employee |
|---|---|---|---|
| auth/me, dashboard, notifications, search | 200 | 200 | 200 |
| leads, customers, orders, inventory, purchases, meta | 200 | 200 | **403** |
| reports, reports/analytics, reports/stores, reports/employee-performance | 200 | 200 | **403** |
| production/command-center, inventory/recommendations | 200 | 200 | **403** |
| whatsapp, audit-logs | 200 | 200 | **403** |
| exports (customers/inventory/purchases/reports) | 200 | 200 | **403** |
| employees, roles, stores, data-health, settings, incentives, assistant/config | 200 | **403** | **403** |

**Security invariants verified (all PASS):**
- `POST /api/assistant/chat`: owner 200, manager 200 (has `reports.view`), employee **403**.
- `PATCH /api/employees/[id]/incentive`: owner 200, manager **403**, employee **403** (owner-only).
- `POST /api/employees` as manager → **403**; `POST /api/customers` as employee → **403**.
- Manager `GET /api/reports/analytics?storeId=<foreign>` → stays scoped to own store (param cannot widen scope; `resolveStoreScope` pins non-owners).
- Global search is permission-gated per entity (`hasPermission` ternary); employee receives all-empty groups (no data leak).
- Dashboard counts are `storeScope`-d and detail lists gated by `hasPermission` (no cross-store / unpermitted leak).
- Manager & Employee unauthorized pages render a clean **"Access denied"** screen (no crash, no runtime errors).

---

## 4. Bugs

**No Critical, High, or Medium bugs were found.** Every tested workflow, role, permission path, and core feature behaved correctly. The items below are Low-severity / informational and were intentionally not "fixed" (no defect to fix).

### F1 — Pricing module is referenced in permissions but not implemented
- **Severity:** Low (informational)
- **Role/Page:** all / "Pricing"
- **Steps:** Open the permission checklist (Employees/Roles drawer) → a "Pricing" card with `view/create/edit` appears.
- **Expected:** Either a Pricing page/feature exists, or the permission isn't surfaced.
- **Actual:** Permission strings `pricing.*` exist and show in the checklist, but there is **no `/pricing` page, no nav item, and no `/api/pricing` route**.
- **Root cause:** Forward-looking placeholder permissions; the feature was never built.
- **Fix applied:** None (no defect; not in scope to add a feature during QA). Granting these permissions has no effect and exposes no data.
- **Verification:** Confirmed no route/page/nav references `pricing`.

### F2 — Seed contains a single store
- **Severity:** Low (test-environment limitation)
- **Detail:** Only one store exists in the seed, so cross-store isolation could only be verified at the code/logic level (`resolveStoreScope` pins non-owners; manager store-picker is hidden; foreign `storeId` param does not widen scope — all verified). Multi-store boundary behavior should be re-confirmed once a second store is created.
- **Fix applied:** None needed.

### F3 — A few create forms use sibling `<label>`+`<input>` (not `htmlFor`-associated)
- **Severity:** Low (a11y / test ergonomics)
- **Detail:** Employees/Roles/Inventory/Purchases create drawers reuse a `<label><span>…</span><input/></label>` wrapper (label wraps the control, so click-to-focus works and screen readers associate it), but a couple of standalone fields elsewhere are sibling pairs. Functionally fine; only affects `getByLabel` test selectors. No user-facing defect.
- **Fix applied:** None (pre-existing, documented in prior notes).

---

## 5. Webpack dev-cache warning

```
[webpack.cache.PackFileCacheStrategy] Caching failed for pack: Error: ENOENT:
no such file or directory, stat '.../.next-dev/cache/webpack/server-development/0.pack.gz'
```

**Verdict: HARMLESS dev-only cache noise. Not caused by harmful app config; no code change required.**

**Root cause:** `next.config.ts` intentionally points dev `distDir` at `.next-dev` (to keep dev and build artifacts separate and avoid App Router manifest corruption — see the comment in the config). The warning is emitted by webpack's persistent `PackFileCacheStrategy` when its `.pack.gz` is removed out from under a **running** dev server. This happens when `.next-dev` is deleted mid-session — e.g. `npm run clean` (which removes `.next`, `.next-dev`, `.next-build`), a second `npm run dev` clean step, or a manual `rm -rf .next-dev` while the dev server is up. In normal `npm run dev` it can also appear once as transient noise on the first compile after the start-up wipe.

It does **not** affect runtime correctness or production builds — the production build uses a fresh `.next-build` and produced **0 warnings**.

**Confirmation:** `npm run build` ran cleanly with no PackFileCache warning; the warning is exclusive to the dev server's `.next-dev` cache.

**Cleanup / how to clear it:**
```bash
# Stop the dev server first (Ctrl+C), then:
npm run clean        # removes .next, .next-dev, .next-build  (scripts/clean-next.mjs)
npm run dev          # start-dev.mjs auto-wipes .next-dev on start and relaunches
```
- Simply **restarting `npm run dev`** clears it (the dev script wipes `.next-dev` on start).
- **Do not run `npm run clean` / `rm -rf .next-dev` while the dev server is running** — that is what triggers the warning.

**`.gitignore` check:** already excludes `.next`, `.next-dev`, `.next-build`, and `.next-dev.lock` — none of these are ever committed. ✅

---

## 6. Browser / device coverage

- Engine: Chromium (Playwright).
- Viewports: Desktop 1440×900, Tablet 768×1024, Mobile 375×812 — no layout overflow on the audited pages.
- Runtime-error capture (`pageerror` + HTTP ≥ 500) on every owner page and every manager/employee denial page: **none**.

---

## 7. Remaining limitations

- Single-store seed (F2) — multi-store isolation verified by logic, not by data.
- Pricing module not implemented (F1).
- Assistant uses Groq `llama-3.1-8b-instant`; answers depend on the live `GROQ_API_KEY` (present and working in this environment).
- QA test data created during the run (one test purchase + an inventory SKU + the on-time-incentive order `BD-1005`) — the order and its incentive were **deleted**; smoke-suite tagged records (e.g. `Smoke Customer …`) remain as additive, non-destructive data.

---

## 8. Deployment readiness verdict

✅ **READY FOR DEPLOYMENT.**
All baseline checks green, all 15 e2e smoke tests pass, full permission matrix enforced server-side across three roles, all core workflows function, responsive layouts hold, and the only findings are a non-implemented placeholder module (Pricing) and harmless dev-cache noise with a documented cleanup. No data was wiped; no migrations were altered; permissions remain server-side enforced.
