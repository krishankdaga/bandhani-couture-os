# UI/UX Audit — Bandhani / Siddhartha Daga Couture OS

**Date:** 2026-06-16
**Scope:** Read-only review of every major page. No code changed.
**Benchmarks:** Linear, Notion, Shopify Admin, HubSpot.

---

## How to read this

Each page is scored **/10** on a SaaS-admin curve where:

- **9–10** = Linear/Notion-tier craft (typographic rhythm, density control, keyboard-first, distinctive identity).
- **7–8** = Shopify/HubSpot-tier (consistent, guided, dependable, data-dense, but not remarkable).
- **5–6** = competent internal tool — works well, looks generic, rough edges.
- **<5** = unfinished or confusing.

**Headline:** This is a **genuinely solid, consistent internal tool (~6.9/10 overall)** with unusually good beginner guidance — better hand-holding than Linear, on par with HubSpot. It is held back from the next tier by four cross-cutting issues: **(1) two competing form-control styles, (2) the couture brand identity is absent inside the app, (3) native `confirm()/alert()` dialogs, and (4) a flat typographic hierarchy.** Fixing those four would move the whole product from ~6.9 to ~8.

---

## Design system — the foundation (strong)

`app/globals.css` + `tailwind.config.ts` define a real, mature system, not ad-hoc styling:

**Strengths**
- Coherent tokens: `ink/sand/wine(charcoal)/gold/accent(turquoise)/accent-deep`, three-tier `shadow-card/-lg/-pop`, named animations.
- Reusable primitives: `.card`, `.btn-*`, `.badge`, `.chip`, `.table-wrap`, `.skeleton`, themed `<table>`.
- Accessibility floor: global `:focus-visible` rings, `role=status/alert` on async states, `prefers-reduced-motion` honored, print styles.
- Shared async-state components (`LoadingState`, `EmptyState`, `ErrorState`, `InlineMessage`) used consistently.

**Weaknesses**
- **Two form-control languages.** Global `input/select/textarea` (rounded-lg, `border-stone-300`, shadow-sm, uppercase tiny labels) vs the bespoke `Field`/`Input` components on **Customers, Inventory, Purchases** (rounded-xl, no shadow, `border-stone-200`, different label weight). Same product, two input looks.
- **Labels aren't associated.** 78 bare `<label>X</label><input>` pairs vs only 2 using `htmlFor`. Screen readers and click-to-focus don't link label→field on most forms.
- **Display serif is unused in-app.** `Libre Baskerville` (`.display-title`) appears only on the login/wordmark; every workspace page is all-sans. The couture personality stops at the front door.
- **Flat type scale.** Most content sits at 13–14px sans with few size/weight steps; sections rely on cards for separation rather than typographic rhythm.

---

## Page-by-page

### 1. Dashboard — **7/10**
Strong information architecture: KPI grid → "Needs Attention" (severity-dotted, prioritized) → Quick Actions (permission-filtered) → Recent Activity + Production Snapshot. Role-aware eyebrow. This is the most "product-like" page.
- **Major issues:** No hero/thesis moment — it opens as four equal KPI tiles (the generic SaaS default the design brief warns against). No trend/sparkline; "Today" lacks a sense of momentum. KPI tiles are visually identical to every other card.
- **Quick wins:** Add a single lead metric with a sparkline or week-over-week delta; give the KPI row one accent (gold hairline / serif numerals) so it reads as the page's anchor.
- **Redesign:** Make the top band a real "state of the atelier" hero — one large headline figure (e.g. orders at risk) in the display serif, with supporting stats, instead of 4 equal tiles.

### 2. Leads — **6/10**
Functional table with status badges, permission gating, good empty/loading/error states.
- **Major issues:** The "+ New lead" form **expands inline at the top and shoves the table down** (no modal/drawer). `confirm()` for convert. Bare labels (a11y). Empty `<th></th>` action column. Unlike Production/Inventory, **no search/filter bar** despite leads being a high-volume list.
- **Quick wins:** Move create into a right-side drawer or modal; add a search box; label the action column ("Actions" or visually-hidden).
- **Redesign:** Adopt the Production/Inventory filter-bar pattern for consistency; convert "Convert" into a confirm popover, not a native dialog.

### 3. Customers — **6.5/10**
KPI tiles, search, side-by-side form, address handling.
- **Major issues:** Uses the **bespoke `Field` component (rounded-xl, different label)** — visibly different inputs from Leads/Orders/Production. The "+" affordance and form density feel utilitarian.
- **Quick wins:** Switch `Field` to the global control style for instant consistency; associate labels.
- **Redesign:** Customer rows could become richer cards (avatar, last order, lifetime value) closer to a CRM contact list (HubSpot).

### 4. Orders — **7/10**
The most polished table: priority dots, per-row links, responsive hidden columns, delay "Health" with animated arrow, owner-vs-manager delete/request-delete.
- **Major issues:** **No search/filter** on a core high-volume list. Large inline create form (4-col) pushes content. `confirm()` for delete. Each cell is its own `<Link>` (works, but repetitive).
- **Quick wins:** Add a filter bar (status, delay, store, stylist); move create to a drawer; one row-level link.
- **Redesign:** Saved views / quick filters (Shopify Admin style) for "At risk", "Due this week", "Unpaid".

### 5. Production — **8/10** (best page)
Genuine product thinking: a real **numbered step indicator** (1 Customer → 2 Order → 3 Stage — appropriate because it *is* a sequence), filter bar, stage list with state icons, a progress bar, a stage editor that disables for view-only users with a clear explanation, and the delay-pardon workflow.
- **Major issues:** Dense on smaller screens; the stage editor form uses bare labels. The two-step select (customer then order) is more clicks than a combined picker.
- **Quick wins:** Associate labels; persist the selected order in the URL so it's shareable/refresh-safe.
- **Redesign:** Minimal — this page is the quality bar the others should meet.

### 6. Inventory — **6.5/10**
Capable: filter bar (search, category, movement, sort, low-only), sticky create form, inline stock-in/out per row.
- **Major issues:** **Bespoke `Input` component** (style drift again). The inline movement form appears *inside* the row and the trigger is a plain "Stock In / Out" button — discoverable but cramped. Dense numeric forms with tiny labels.
- **Quick wins:** Unify inputs; make low-stock rows visually flagged (left accent border) rather than only a badge.
- **Redesign:** Stock movement as a focused side-drawer with the item summary pinned, instead of an expanding in-row form.

### 7. Purchases — **6.5/10**
Mirrors Inventory: filter bar, create form, an in-row "Receive Stock" → SKU/category mapping → receive flow.
- **Major issues:** Same `Input` style drift. The receive flow reveals SKU/category fields **inside the line list** — easy to lose track of which purchase you're acting on. Two buttons both labeled "Receive Stock" (start vs submit).
- **Quick wins:** Rename the submit to "Confirm receipt"; scope the receive UI to a clearly-bordered panel.
- **Redesign:** Receive in a drawer showing all lines + target SKUs together with running totals.

### 8. Reports — **7.5/10**
Recently upgraded: segmented date presets, store filter (owner-scoped), All-Stores comparison table, Employee Performance with role/search filters, and a filtered Export dropdown.
- **Major issues:** Dense — many stacked cards. Charts are basic CSS bars (fine, not premium). The page does a lot; first-time scanning is heavy.
- **Quick wins:** Add section anchors / a sticky sub-nav; give the headline KPIs the same serif-numeral treatment proposed for Dashboard.
- **Redesign:** Tabs or a left rail (Sales / Leads / Stores / Team) to reduce vertical density, à la Shopify Analytics.

### 9. Employees — **6.5/10**
Master–detail: searchable list + a single owner-controlled form (identity, status, role, store, legacy role, per-employee permission checklist), plus the new "View profile" link.
- **Major issues:** The form is a long single column of many selects; high cognitive load for new owners. Bare labels.
- **Quick wins:** Group the form into titled sections (Identity / Access / Status); associate labels.
- **Redesign:** Two-step "create employee" (identity → access) to lower the wall of fields.

### 10. Roles & Access — **7/10**
Clean master–detail with a system-role badge, user/permission counts, and the grouped `PermissionChecklist`.
- **Major issues:** The permission checklist can be a large grid; no "select module" presets beyond per-group toggles.
- **Quick wins:** Add role templates ("Start from Store Manager"); show a diff/summary of what changed before save.
- **Redesign:** Minor.

### 11. Settings — **7/10**
Rich: expandable store cards with inline edit, a performance grid, staff avatars, and business key/value config with helpful `Hint` callouts.
- **Major issues:** Key/value business config is developer-flavored (`business_name`, `gst_number`) — leaks system vocabulary to end users. Mixed currency formatting done inline (`₹` + `toLocaleString`) rather than the shared `money()` helper.
- **Quick wins:** Replace freeform key/value with a small set of named fields (Business name, GST number, Address); use `money()` everywhere.
- **Redesign:** A proper "Business profile" form instead of generic key/value pairs.

### 12. Bandhani Assistant — **7.5/10**
Recently upgraded: grouped quick prompts, persisted recent questions, clean chat bubbles with markdown rendering, loading + empty states, fallback messaging.
- **Major issues:** No streaming (answer appears all at once after a wait); no message actions (copy, regenerate); history is per-session only.
- **Quick wins:** Token-streaming or a more informative loading line; a "copy answer" affordance.
- **Redesign:** Make answers actionable — link entities in responses ("ORD-1023") straight to their pages.

---

## Cross-cutting findings

| Area | Assessment | Evidence |
|---|---|---|
| **Visual hierarchy** | Cards do the separating; typography does little. Pages read as stacks of equal-weight cards. | All pages |
| **Spacing** | Consistent and generous (`p-5/p-6`, `gap-4/5`). A real strength. | globals + pages |
| **Typography** | Flat; display serif unused in-app; few size/weight steps. | `globals.css`, all pages all-sans |
| **Forms** | **Two control styles**; labels not associated (78 bare vs 2 `htmlFor`). | customers/inventory/purchases vs rest |
| **Tables/cards** | Mostly themed `<table>`; Orders hand-rolls its own — slight drift. Good `table-wrap` overflow on mobile. | orders/page.tsx |
| **Navigation** | Grouped sidebar, permission-filtered, mobile drawer, breadcrumb, Cmd/Ctrl+K search, notifications. Strong. | app-shell, sidebar, navigation.ts |
| **Mobile** | Reasonable: tables scroll, forms stack at `md/xl`. Not specifically tuned, but not broken. | responsive grids |
| **Beginner-friendliness** | **Excellent** — helper text, hints, step indicators, view-only explanations. Beats Linear; ~HubSpot. | production, settings, reports |
| **Empty states** | Good component, but most calls pass only `message` (no icon/title/action) → plain. | EmptyState usage |
| **Loading states** | Good — skeleton rows + spinners, role=status. | async-state.tsx |
| **Accessibility** | Focus rings, ARIA on icon buttons, reduced-motion ✓. **Gap:** label↔input association; native dialogs aren't focus-trapped. | globals, 6 files w/ confirm() |
| **Modern SaaS polish** | Consistent and clean, but no signature identity, native `confirm()`, inline-expanding forms instead of drawers/modals. | leads/orders + 6 confirm() files |

---

## How it compares to the benchmarks

| Product | Score | Why |
|---|---|---|
| **Linear** | ~9.5 | Density, speed, keyboard-first, unmistakable identity. |
| **Notion** | ~9 | Typographic calm, flexibility, restraint. |
| **Shopify Admin** | ~8.5 | Guided, consistent, data-dense, dependable. |
| **HubSpot** | ~8 | Strong guidance, slightly heavy. |
| **Couture OS (today)** | **~6.9** | Consistent + exceptionally well-guided internal tool. Loses points on form inconsistency, absent brand identity, native dialogs, flat type. |

**The gap to Shopify/HubSpot is mostly polish and consistency, not architecture.** Couture OS already beats them on inline guidance. The gap to Linear/Notion is identity and craft — and the brand assets (charcoal/gold/turquoise, Libre Baskerville, the bandhani motif) to close it already exist; they're just unused inside the workspace.

---

## The single highest-leverage insight

You bought a couture identity (serif display, gold, the bandhani emblem) and then left it at the login screen. **Bringing that identity inside the app — serif numerals on headline metrics, a gold hairline accent, the emblem as a quiet watermark on hero surfaces — plus unifying the two form styles, would do more for perceived quality than any single feature.** The roadmap sequences this.
