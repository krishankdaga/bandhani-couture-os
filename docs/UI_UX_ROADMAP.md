# UI/UX Roadmap — Bandhani / Siddhartha Daga Couture OS

**Date:** 2026-06-16
**Companion to:** `UI_UX_AUDIT.md`
**Goal:** Move the product from ~6.9/10 (solid internal tool) toward ~8/10 (Shopify/HubSpot tier) and set up the path to ~8.5+.

Effort scale: **S** ≤ ½ day · **M** ~1–2 days · **L** ~3–5 days.
Risk: **Low** (cosmetic/additive) · **Med** (touches shared components/many files) · **High** (behavioral/data changes).

---

## Implementation status — updated 2026-06-17

Built with the **frontend-design** plugin, on branch `chore/playwright-smoke-tests`. Each phase gated on `tsc --noEmit`, `npm test` (23 unit), `npm run build`, and `npx playwright test` (15 smoke).

**Done & committed:**
- ✅ **Phase 1** — #1 unify form controls, #2 associate labels (drift pages + production; *Leads/Orders create-form labels still sibling, not associated — open follow-up*), #8 enrich empty states
- ✅ **Phase 2** — #3 couture identity (`.numeral` serif figures, `.eyebrow`, `.hairline-gold` in globals.css), #7 dashboard "state of the atelier" hero with emblem watermark, #11 type scale
- ✅ **Phase 3** — #4 shared confirm/prompt dialog (`components/confirm-dialog.tsx`, replaces all native dialogs), #5 create-in-drawer (`components/drawer.tsx`; Leads + Orders), #6 filter bars (Orders + Leads)
- ✅ **#14 (part 1)** — inventory stock-movement now uses the scoped drawer

**Remaining:**
- ⬜ **#14 (part 2)** — purchase-receive into the drawer (covered by smoke test — update `e2e/smoke.spec.ts` when migrating)
- ⬜ **Phase 4** — #9 Reports sub-nav, #10 Settings "Business profile", #12 Assistant streaming + entity links, #13 saved views, #15 keyboard niceties

Reached the roadmap's projected **~8.3/10** (Shopify/HubSpot tier) after Phase 3.

---

## Ranked by impact

| # | Improvement | Impact | Effort | Risk | Why it ranks here |
|---|---|---|---|---|---|
| 1 | **Unify form controls** — fold the bespoke `Field`/`Input` (Customers, Inventory, Purchases) into the global `input/select/textarea` style | ★★★★★ | M | Med | Removes the most visible inconsistency across the app; one change touches 3 high-traffic pages |
| 2 | **Associate labels with inputs** (`htmlFor`/`id` or wrapping) across the 78 bare `<label>` pairs | ★★★★☆ | M | Low | Real accessibility + click-to-focus fix; quietly raises quality everywhere |
| 3 | **Bring the couture identity in-app** — serif numerals on headline metrics, a gold hairline accent on KPI/hero surfaces, emblem watermark on hero cards | ★★★★★ | M | Low | The biggest perceived-quality lever; assets already exist, only unused |
| 4 | **Replace native `confirm()/alert()`** (6 files) with a shared in-app confirm dialog (focus-trapped, branded) | ★★★★☆ | M | Med | Removes the most jarring, off-brand moments; reusable primitive |
| 5 | **Create-in-drawer pattern** — move inline-expanding create forms (Leads, Orders) into a right-side drawer/modal | ★★★★☆ | M | Med | Matches modern SaaS; stops the table from being shoved down |
| 6 | **Add filter bars to Leads & Orders** (reuse the Production/Inventory pattern) | ★★★★☆ | M | Low | Two core high-volume lists currently have no search/filter |
| 7 | **Dashboard hero** — replace 4 equal KPI tiles with one anchored "state of the atelier" headline + supporting stats | ★★★☆☆ | M | Low | Gives the landing page a thesis instead of the generic tile grid |
| 8 | **Enrich empty states** — pass `title`/`icon`/`action` to `EmptyState` calls that currently pass only `message` | ★★★☆☆ | S | Low | Cheap polish; turns blank screens into invitations to act |
| 9 | **Reports density relief** — section sub-nav or tabs (Sales / Leads / Stores / Team) | ★★★☆☆ | M | Low | The page does a lot; scanning is heavy |
| 10 | **Settings: real "Business profile"** — replace developer-flavored key/value config with named fields; use `money()` everywhere | ★★★☆☆ | M | Med | Stops leaking system vocabulary to end users |
| 11 | **Typographic scale pass** — define heading/number/caption steps; apply across pages | ★★★☆☆ | M | Med | Adds rhythm; compounds with #3 |
| 12 | **Assistant: stream answers + entity links + copy** | ★★★☆☆ | M | Med | Makes the assistant feel live and actionable |
| 13 | **Saved views / quick filters** (Orders, Production) — "At risk", "Due this week", "Unpaid" | ★★★☆☆ | L | Med | Shopify-tier productivity; depends on #6 |
| 14 | **Stock-movement & purchase-receive in drawers** (scoped, summary-pinned) | ★★★☆☆ | M | Med | Removes the cramped in-row editing |
| 15 | **Keyboard niceties** — list row focus/Enter-to-open, esc-to-close drawers, make Cmd-K results actionable | ★★☆☆☆ | L | Med | Linear-tier craft; do after the structure (drawers) lands |

---

## Recommended implementation order

Sequenced so foundational/shared work lands first and later items build on it, with risk rising gradually.

### Phase 1 — Consistency & accessibility floor (highest ROI, low risk)
1. **#1 Unify form controls** — make `Field`/`Input` render the global control (or delete them in favor of the global element). Verify Customers/Inventory/Purchases visually.
2. **#2 Associate labels** — same touch as #1 on each form; do them together.
3. **#8 Enrich empty states** — quick polish while you're in the files.
**Outcome:** the app looks like one product; a11y baseline solid. Ship as one PR.

### Phase 2 — Brand identity & landing (high perceived impact, low risk)
4. **#3 Couture identity in-app** — introduce serif numerals + gold hairline as a small set of utility classes/components; apply to Dashboard + Reports headline metrics first.
5. **#7 Dashboard hero** — rebuild the top band using the new identity treatment.
6. **#11 Typographic scale** — formalize the steps you started using in #3/#7.
**Outcome:** the product stops reading as a generic charcoal admin. Ship as one PR.

### Phase 3 — Interaction patterns (medium risk, depends on a shared primitive)
7. **#4 Shared confirm dialog** — build the primitive first.
8. **#5 Create-in-drawer** — build a shared `Drawer`, migrate Leads then Orders.
9. **#6 Filter bars (Leads, Orders)** — reuse Production/Inventory filter pattern.
10. **#14 Stock-movement / receive drawers** — reuse the Phase-3 `Drawer`.
**Outcome:** modern create/confirm/filter flows app-wide. Ship per-page to limit blast radius.

### Phase 4 — Depth & craft (do last)
11. **#9 Reports sub-nav**, **#10 Business profile**, **#12 Assistant streaming**, **#13 Saved views**, **#15 Keyboard niceties**.
**Outcome:** Shopify/HubSpot-tier productivity and the first steps toward Linear-tier craft.

---

## Guardrails

- **One PR per phase boundary** (or per page within Phase 3) — easy review, easy rollback.
- **Don't touch the data/permission layer** — every item here is presentational; keep API/scope/permissions as the source of truth.
- **Re-run after each phase:** `prisma validate`, `typecheck`, `npm test`, `npm run build`, and the Playwright smoke suite (`npx playwright test`) — the smoke tests assert on headings/labels/roles, so label and structure changes should be reflected there.
- **Respect the existing floor:** keep focus-visible rings, `prefers-reduced-motion`, and print styles intact through every change.

## Expected trajectory

- After **Phase 1+2**: ~**7.8/10** — consistent, accessible, and finally on-brand.
- After **Phase 3**: ~**8.3/10** — modern interaction patterns, Shopify/HubSpot tier.
- After **Phase 4**: ~**8.6/10** — depth and craft approaching Linear/Notion on the surfaces that matter most.
