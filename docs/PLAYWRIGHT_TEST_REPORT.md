# Playwright Smoke Test Report

**Date:** 2026-06-16
**App under test:** Bandhani / Siddhartha Daga Couture OS (Next.js dev server on `http://localhost:3000`)
**Runner:** `@playwright/test` (Chromium headless), specs in `e2e/`, config `playwright.config.ts`
**Result:** 15/15 tests passing. No critical or high-severity application bugs found.

---

## Setup

- **Playwright installed:** Yes — `@playwright/test` added as a dev dependency and Chromium downloaded.
- **Database:** The dev DB initially held only 3 of the 10 seed accounts (`owner@`, `manager@`,
  `stylist@`) — `employee@cbos.local` was missing. Ran the **non-destructive** seed
  (`npm run seed`, all upserts) to restore the full demo account set. See Finding #1.
- Fixtures (`e2e/fixtures.json`) hold the owner/manager/employee/stylist user IDs for the
  access-control assertions; regenerate with the snippet in the appendix if the DB is reseeded.

---

## Flows tested

### Owner
- Login (`owner@cbos.local`) → dashboard loads ✅
- Sidebar modules visible (Dashboard, Reports, Inventory, Purchases, Employees, Bandhani Assistant) ✅
- Global search opens with Ctrl/Cmd+K ✅
- Notifications panel opens ✅
- Reports page loads ✅
- Store + date-range report filters present and usable ✅
- Employee performance report renders with rows ✅
- Employee profile opens from the performance table ✅
- Bandhani Assistant opens from the sidebar ✅
- Assistant answers “Summarise business status today” (live `POST /api/assistant/chat` → 200, non-empty answer) ✅
- CSV export downloads (Reports → Export CSV → Summary report) ✅

### Manager (`manager@cbos.local`, store-scoped, no `employees.view`)
- Restricted sidebar — Reports visible; Employees / Roles & Access hidden ✅
- Reports are store-scoped — owner-only store picker is absent ✅
- Own profile opens (self-view) ✅
- Unpermitted colleague profile → **Access Denied** (not a broken page) ✅

### Employee (`employee@cbos.local`, `dashboard.view` only)
- Restricted sidebar — only Dashboard; no Reports/Inventory/Assistant ✅
- Floating Assistant button hidden ✅
- Unauthorized pages (`/reports`, `/inventory`, `/assistant`, `/employees`) → **Access Denied** ✅
- Own profile viewable (self-view) ✅

### Core workflows (owner)
- Add customer ✅
- Edit customer address ✅
- Add inventory item ✅
- Stock in/out (movement recorded) ✅
- Create purchase ✅
- Receive purchase into inventory (status → Received) ✅
- Production page loads ✅
- Incentives page loads ✅
- Exports work ✅

No `pageerror`s or HTTP 5xx responses were observed on the pages instrumented with the error collector.

---

## Findings / Bugs

### Finding #1 — Demo accounts missing from dev DB (environment, not an app bug)
- **Page / area:** Authentication / seed data
- **User role:** N/A (test setup)
- **Steps to reproduce:** Fresh checkout where the DB had been partially reset; attempt to log in as `employee@cbos.local`.
- **Expected:** All documented demo accounts exist (`owner@`, `manager@`, `employee@`, …).
- **Actual:** Only 3 users existed; `employee@cbos.local` and others were absent.
- **Severity:** Low (environment/data state — the seed is intentionally non-destructive and idempotent).
- **Suggested fix:** Run `npm run seed` before testing. No code change required.

### Finding #2 — Test-harness selector bug (fixed in this change, not an app bug)
- **Page / area:** `e2e/smoke.spec.ts` — “create purchase + receive into inventory”
- **User role:** Owner
- **Steps to reproduce:** Original spec used `getByRole("button", { name: "Receive Stock" }).first()/.last()` and `getByText(/Received/)`, which matched buttons across unrelated purchase cards and the hidden `<option>RECEIVED</option>` in the status filter.
- **Expected:** Receive the just-created purchase and assert its card shows “Received”.
- **Actual:** Clicked the wrong cards; assertion matched a hidden filter option → timeout.
- **Severity:** Low (test-only).
- **Fix applied:** Scoped the receive interaction and assertion to the specific purchase card
  (`page.locator("div.p-5").filter({ hasText: vendor })`). Re-run: passing. Verified the receive
  API/UI path itself works correctly (defaults satisfy `POST /api/purchases/[id]/receive`).

### Finding #3 — Stale build artifact broke `npm run build` (environment, not an app bug)
- **Page / area:** Build tooling (`scripts/clean-next.mjs` / `.next-build`)
- **User role:** N/A
- **Steps to reproduce:** Run `npm run build` with a duplicated `.next-build/types 2/` directory present
  (a filesystem-sync duplication artifact, same family as a stray `.next-dev 2.lock`).
- **Expected:** Clean + build succeed.
- **Actual:** `ENOTEMPTY: directory not empty, rmdir '.next-build/types 2/app/api'`.
- **Severity:** Low (environment artifact; resolved by `rm -rf .next-build`). Build then succeeded.
- **Suggested fix:** No code change required. If these “ 2” duplicate artifacts recur, disable the
  folder’s cloud-sync duplication or add a pre-build `rm -rf` of stray copies.

### Application bugs (critical/high)
**None found.** All owner/manager/employee access rules, reports filters, employee profiles,
performance reports, assistant, and core CRUD/stock/purchase workflows behaved as expected.

---

## Appendix — regenerate fixtures

```
npx tsx -e "import {prisma} from './lib/prisma'; import {writeFileSync} from 'node:fs'; (async()=>{const u=await prisma.user.findMany({where:{email:{in:['owner@cbos.local','manager@cbos.local','employee@cbos.local','stylist@cbos.local']}},select:{id:true,email:true,storeId:true}}); const by=Object.fromEntries(u.map(x=>[x.email,x])); writeFileSync('e2e/fixtures.json', JSON.stringify({owner:by['owner@cbos.local'],manager:by['manager@cbos.local'],employee:by['employee@cbos.local'],stylist:by['stylist@cbos.local']},null,2)); process.exit(0);})()"
```

Run the suite with: `npx playwright test` (dev server must be running via `npm run dev`).
