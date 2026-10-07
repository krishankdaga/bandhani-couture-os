# PROJECT FEATURE MATRIX — Bandhani / Siddhartha Daga Couture OS

> Generated: 2026-06-16
> Status definitions:
> - **Complete** — Fully implemented end-to-end (UI + API + DB)
> - **Partial** — Implemented but missing important sub-features, broken flows, or significant gaps
> - **Missing** — Not implemented; DB model or permission string may exist but no working UI+API

---

## Module 1: Authentication & Session

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| Email + password login | **Complete** | `/login` | `POST /api/auth/login` | `User` |
| HTTP-only JWT session cookie (12h) | **Complete** | `lib/auth.ts` | — | — |
| Logout / cookie clear | **Complete** | AppShell profile menu | `POST /api/auth/logout` | — |
| Session validation on every API request | **Complete** | — | `lib/auth.ts → getRequestUser()` | `User` |
| "Forgot password" self-service | **Missing** | Login page shows contact-admin message | — | — |
| Multi-factor authentication | **Missing** | — | — | — |
| Session refresh / sliding expiry | **Missing** | — | — | — |
| Rate limiting on login (brute-force protection) | **Missing** | — | — | — |

---

## Module 2: Role & Permission Management

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| Create custom company roles | **Complete** | `/roles` | `POST /api/roles` | `CompanyRole`, `RolePermission` |
| Edit role permissions | **Complete** | `/roles` | `PATCH /api/roles/[id]` | `CompanyRole`, `RolePermission` |
| View all roles + user counts | **Complete** | `/roles` | `GET /api/roles` | `CompanyRole`, `RolePermission` |
| System roles (seeded, protected) | **Complete** | `/roles` (marked with shield icon) | — | `CompanyRole.isSystem` |
| Delete roles | **Partial** | `/roles` (no delete button in UI) | `DELETE /api/roles/[id]` exists | `CompanyRole` |
| Per-user permission overrides | **Complete** | `/employees` (PermissionChecklist) | `POST/PATCH /api/employees` | `UserPermissionOverride` |
| Assign role to user | **Complete** | `/employees` | `POST/PATCH /api/employees` | `User.companyRoleId` |
| View effective permissions for a user | **Complete** | `/employees` (computed client-side) | — | — |
| Role-based navigation filtering | **Complete** | `Sidebar`, `AppShell` | — | — |
| Owner-bypass (always full access) | **Complete** | All API routes | `hasPermission()` in `lib/permissions.ts` | `User.companyStatus` |

---

## Module 3: Employee Management

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| List all employees | **Complete** | `/employees` | `GET /api/employees` | `User` |
| Create new employee | **Complete** | `/employees` | `POST /api/employees` | `User` |
| Edit employee (name, email, role, store, status) | **Complete** | `/employees` | `PATCH /api/employees/[id]` | `User` |
| Reset employee password | **Complete** | `/employees` | `POST /api/employees/[id]/reset-password` | `User` |
| Deactivate / reactivate employee | **Complete** | `/employees` (active toggle) | `PATCH /api/employees/[id]` | `User.active` |
| Assign employee to store | **Complete** | `/employees` | — | `User.storeId` |
| Delete employee | **Missing** | — | — | — |
| Employee self-service profile edit | **Missing** | — | — | — |
| Employee performance view | **Missing** | — | — | — |

---

## Module 4: Store Management

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| Store used in scoping (leads, customers, orders) | **Complete** | — | `lib/scope.ts` | `Store` |
| Store list available in meta API | **Complete** | — | `GET /api/meta` | `Store` |
| Create / edit stores | **Missing** | No store management page | — | `Store` |
| Multi-store reporting (cross-store for owners) | **Partial** | Reports page shows totals (owner sees all) | `GET /api/reports` | — |
| Store-level settings | **Missing** | — | — | — |

---

## Module 5: Lead Management (CRM - Top of Funnel)

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| List leads (with search + status filter) | **Complete** | `/leads` | `GET /api/leads` | `Lead` |
| Create new lead | **Complete** | `/leads` | `POST /api/leads` | `Lead` |
| Edit lead (status, follow-up, notes, stylist) | **Complete** | `/leads` | `PATCH /api/leads/[id]` | `Lead` |
| Convert lead to customer | **Complete** | `/leads` (Convert button) | `POST /api/leads/[id]/convert` | `Lead`, `Customer` |
| Assign lead to stylist | **Complete** | `/leads` (form field) | — | `Lead.stylistId` |
| Lead source tracking | **Complete** | `/leads` | — | `Lead.source` (LeadSource enum) |
| Follow-up date + reminders (via notifications) | **Complete** | `/leads`, Dashboard | `GET /api/notifications` | `Lead.followUpDate` |
| Lead detail / history page | **Missing** | No `/leads/[id]` page | `GET /api/leads/[id]` exists | `Lead` |
| Lead analytics (conversion rate, source breakdown) | **Missing** | — | — | — |
| Bulk lead import | **Missing** | — | — | — |
| Export leads to CSV | **Complete** | Export button links | `GET /api/export/customers` | `Lead` |

---

## Module 6: Customer Management (CRM - Retained)

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| List customers (with search) | **Complete** | `/customers` | `GET /api/customers` | `Customer` |
| Create customer directly | **Complete** | `/customers` | `POST /api/customers` | `Customer` |
| Customer detail profile | **Complete** | `/customers/[id]` | `GET /api/customers/[id]` | `Customer` |
| Edit customer details | **Complete** | `/customers/[id]` (implied via PATCH) | `PATCH /api/customers/[id]` | `Customer` |
| View customer order history | **Complete** | `/customers/[id]` | — | `Order` |
| Add interaction note | **BROKEN** | `/customers/[id]` (form exists, POST 405) | **Missing POST handler** | `Interaction` |
| View interaction log | **Complete** | `/customers/[id]` | — | `Interaction` |
| View communication history (WhatsApp/email) | **Complete** | `/customers/[id]` | — | `Communication` |
| Couture profile (preferences, liked/tried pieces) | **Complete** (view only) | `/customers/[id]` | — | `Customer.likedPieces`, `piecesTried` |
| Edit couture profile (liked/tried pieces) | **Missing** | No edit UI for likedPieces/piecesTried | — | — |
| Print customer summary | **Complete** | `/customers/[id]` (print button) | — | — |
| Export customers to CSV | **Complete** | — | `GET /api/export/customers` | `Customer` |
| Customer segmentation / filtering | **Missing** | — | — | — |

---

## Module 7: Order Management

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| List all orders (table view) | **Complete** | `/orders` | `GET /api/orders` | `Order` |
| Create new order | **Complete** | `/orders` | `POST /api/orders` | `Order`, `ProductionStage` |
| Auto-create production stages on order | **Complete** | — | `POST /api/orders` | `ProductionStage` |
| Order detail view | **Complete** | `/orders/[id]` | `GET /api/orders/[id]` | `Order`, `ProductionStage` |
| Edit order (priority, delivery date, status) | **Complete** | `/orders/[id]` | `PATCH /api/orders/[id]` | `Order` |
| Order priority (NORMAL/HIGH/URGENT) | **Complete** | `/orders` | — | `Order.priority` |
| Order health / delay state display | **Complete** | `/orders` | — | `Order.delayState` |
| Reference image URLs on order | **Complete** | `/orders` (create form) | — | `Order.referenceImages[]` |
| Customisations field | **Complete** | `/orders` (create form) | — | `Order.customisations` |
| Measurements (bust, waist, hip, length only) | **Partial** | `/orders` (4 hardcoded fields) | — | `Order.measurements` (Json) |
| Auto-generated order number (BD-YYYY-NNNNN) | **Complete** | — | `POST /api/orders` | `Order.orderNumber` |
| Cancel order | **Partial** | Can be done via edit, no dedicated button | `PATCH /api/orders/[id]` | `Order.status` |
| Order-level delay pardon | **Partial** | UI in Production page only | `POST /api/pardons` | `DelayPardon` |
| Filter/search orders | **Partial** | No filter UI on orders list page | `GET /api/orders?search=` | — |
| Export orders to CSV | **Missing** | No orders export endpoint | — | — |

---

## Module 8: Production Management

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| View all active orders for production | **Complete** | `/production` | `GET /api/orders` | `Order` |
| 3-step workflow (Customer → Order → Stage) | **Complete** | `/production` | — | — |
| Stage status update (NOT_STARTED/IN_PROGRESS/BLOCKED/COMPLETED) | **Complete** | `/production` | `PATCH /api/stages/[id]` | `ProductionStage` |
| Stage owner assignment | **Complete** | `/production` | — | `ProductionStage.ownerId` |
| Stage vendor assignment | **Complete** | `/production` | — | `ProductionStage.vendorName` |
| Stage due date override | **Complete** | `/production` | — | `ProductionStage.dueDate` |
| Stage remarks / notes | **Complete** | `/production` | — | `ProductionStage.remarks` |
| Delay state visualization (GREEN/YELLOW/RED) | **Complete** | `/production` | — | `ProductionStage.delayState` |
| Delay pardon request (by production team) | **Complete** | `/production` | `POST /api/pardons` | `DelayPardon` |
| Delay pardon approval / rejection (by owner) | **Complete** | `/production` | `PATCH /api/pardons/[id]` | `DelayPardon` |
| Manual delay recalculation | **Complete** | `/production` (Check delays button) | `POST /api/delays/recalculate` | `ProductionStage`, `Order` |
| Filter by delay state, status, due date | **Complete** | `/production` | — | — |
| Progress bar (stages completed) | **Complete** | `/production` | — | — |
| Order auto-advances to READY when complete | **Complete** | — | `PATCH /api/stages/[id]` | `Order.status` |
| Stage completion date auto-set | **Complete** | — | `PATCH /api/stages/[id]` | `ProductionStage.completionDate` |
| Sticky RED delay state | **Complete** | — | `lib/delay.ts` | `hasEverBeenRed` |

---

## Module 9: Inventory Management

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| List inventory items | **Complete** | `/inventory` | `GET /api/inventory` | `InventoryItem` |
| Create inventory item | **Complete** | `/inventory` | `POST /api/inventory` | `InventoryItem` |
| Edit inventory item | **Complete** | `/inventory` | `PATCH /api/inventory/[id]` | `InventoryItem` |
| Delete inventory item | **Complete** | `/inventory` | `DELETE /api/inventory/[id]` | `InventoryItem` |
| Record stock movement (IN/OUT/ADJUSTMENT) | **Complete** | `/inventory` | `POST /api/inventory/[id]/movement` | `StockMovement` |
| View recent movements per item | **Complete** | `/inventory` | — | `StockMovement` |
| Low stock alerts (reorder level) | **Complete** | Notifications, Dashboard | `GET /api/notifications` | `InventoryItem.reorderAt` |
| Category filtering (FABRIC/FINISHED_GOOD/ACCESSORY/etc.) | **Complete** | `/inventory` | — | `InventoryItem.category` |
| Sort by quantity / value / name / newest | **Complete** | `/inventory` | — | — |
| Cost price + selling price tracking | **Complete** | `/inventory` | — | `InventoryItem.costPrice/sellingPrice` |
| Export inventory to CSV | **Complete** | `/inventory` (Export button) | `GET /api/export/inventory` | `InventoryItem` |
| Stock value summary | **Partial** | Sort by "Stock value" exists, no total | — | — |
| Inventory linked to orders (deduct on use) | **Missing** | — | — | — |
| Inventory movement history (full log) | **Partial** | Shows last 5 movements per item | — | `StockMovement` |
| Batch stock import | **Missing** | — | — | — |

---

## Module 10: Purchase Management

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| List purchase orders | **Complete** | `/purchases` | `GET /api/purchases` | `Purchase` |
| Create purchase order with line items | **Complete** | `/purchases` | `POST /api/purchases` | `Purchase`, `PurchaseLine` |
| Edit purchase order | **Complete** | `/purchases` | `PATCH /api/purchases/[id]` | `Purchase` |
| Mark purchase as received | **Complete** | `/purchases` | `POST /api/purchases/[id]/receive` | `Purchase` |
| Purchase status tracking (REQUESTED/ORDERED/RECEIVED/CANCELLED) | **Complete** | `/purchases` | — | `Purchase.status` |
| Auto-generated PO number (PO-YYYY-NNNNN) | **Complete** | — | `POST /api/purchases` | `Purchase.purchaseNo` |
| Expected delivery date | **Complete** | `/purchases` | — | `Purchase.expectedDate` |
| Overdue purchase alerts | **Complete** | Notifications | `GET /api/notifications` | `Purchase.expectedDate` |
| Export purchases to CSV | **Complete** | — | `GET /api/export/purchases` | `Purchase`, `PurchaseLine` |
| Link purchase to inventory (auto-update stock) | **Missing** | Receive marks purchase, but doesn't update InventoryItem quantities | — | — |
| Vendor management (address book) | **Missing** | Vendor name is free text | — | — |

---

## Module 11: Pricing Templates

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| List pricing templates | **Complete** | `/pricing` | `GET /api/pricing` | `PricingTemplate` |
| Create pricing template | **Complete** | `/pricing` | `POST /api/pricing` | `PricingTemplate` |
| Edit pricing template | **Complete** | `/pricing` | `PATCH /api/pricing` | `PricingTemplate` |
| Cost breakdown (base, fabric, embroidery, stitching) | **Complete** | `/pricing` | — | `PricingTemplate` fields |
| Overhead % + margin % calculation | **Complete** | `/pricing` | — | `PricingTemplate` |
| Link template to an order | **Missing** | Pricing templates are advisory only — not connected to Order.orderValue | — | — |
| Quote generation / PDF export | **Missing** | — | — | — |

---

## Module 12: Incentives (Stylist Commissions)

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| List incentives | **Complete** | `/incentives` | `GET /api/incentives` | `Incentive` |
| Create incentive record | **Complete** | `/incentives` | `POST /api/incentives` | `Incentive` |
| Approve incentive | **Complete** | `/incentives` | `PATCH /api/incentives/[id]` | `Incentive` |
| Mark incentive as paid | **Complete** | `/incentives` | `PATCH /api/incentives/[id]` | `Incentive` |
| Link incentive to order | **Partial** | `orderId` field exists, but not enforced as FK — Incentive.orderId is String? | `Incentive` | — |
| Incentive total in reports | **Complete** | `/reports` | `GET /api/reports` (aggregate) | `Incentive` |
| Auto-create incentive on order creation | **Missing** | Manual process only | — | — |
| Incentive calculation by percentage | **Complete** | `amount = orderValue * percentage / 100` | `POST /api/incentives` | — |
| Export incentives | **Missing** | — | — | — |
| Incentive history per employee | **Missing** | — | — | — |

---

## Module 13: WhatsApp Automation

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| View WhatsApp message templates | **Complete** | `/whatsapp` | `GET /api/whatsapp` | `WhatsAppTemplate` |
| Create / edit templates | **Complete** | `/whatsapp` | `POST /api/whatsapp`, `PATCH` via whatsapp/[id] | `WhatsAppTemplate` |
| Template types (4: STYLIST_FOLLOW_UP, PRODUCTION_REMINDER, DELAY_ALERT, DAILY_OWNER_SUMMARY) | **Complete** | — | — | `WhatsAppTemplateType` enum |
| Send WhatsApp messages to customers | **Missing** | Templates exist, no send mechanism | — | — |
| Real WhatsApp Business API integration | **Missing** | Mock provider only | `integrations/whatsapp/index.ts` | — |
| Automated triggers (follow-up reminders, delay alerts) | **Missing** | No scheduler/cron exists | — | — |
| Opt-in / opt-out management | **Missing** | — | — | — |
| Template variable substitution | **Missing** | Templates are static strings | — | — |

---

## Module 14: AI Business Assistant

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| Ask business questions in natural language | **Complete** | Floating widget in AppShell | `POST /api/assistant/chat` | — |
| Context-aware queries (orders, inventory, leads, etc.) | **Complete** | — | `buildContext()` in route | Order, InventoryItem, Purchase, Customer, Lead |
| Groq AI integration (llama-3.1-8b-instant) | **Complete** | — | Groq REST API | — |
| Graceful fallback when Groq unavailable | **Complete** | Shows structured DB snapshot | `assistantFallback()` | — |
| Rate limiting (12 req/min per owner) | **Partial** | In-memory rate limit (doesn't survive restart) | `lib/rate-limit.ts` | — |
| Query audit logging | **Complete** | — | `writeAudit()` in route | `AuditLog` |
| Owner-only access enforcement | **Complete** | AppShell (conditionally renders), requireOwner() in API | — | — |
| Conversation history / multi-turn | **Missing** | Each question is stateless (no message history) | — | — |
| Configurable via settings page | **Partial** | `GET /api/assistant/config` exists, but no UI to set GROQ_API_KEY | `SystemSetting` | — |

---

## Module 15: Reports & Analytics

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| Summary metrics dashboard (8 cards) | **Complete** | `/reports` | `GET /api/reports` | Lead, Customer, Order, InventoryItem, Purchase, Incentive |
| Export reports summary CSV | **Complete** | `/reports` | `GET /api/export/reports` | — |
| Export customers CSV | **Complete** | — | `GET /api/export/customers` | `Customer`, `Order`, `Interaction` |
| Export inventory CSV | **Complete** | — | `GET /api/export/inventory` | `InventoryItem`, `StockMovement` |
| Export purchases CSV | **Complete** | — | `GET /api/export/purchases` | `Purchase`, `PurchaseLine` |
| Revenue over time / trend charts | **Missing** | — | — | — |
| Conversion funnel (leads → customers → orders) | **Missing** | — | — | — |
| Stylist performance report | **Missing** | — | — | — |
| Order delay analysis report | **Missing** | — | — | — |
| Inventory turnover report | **Missing** | — | — | — |
| Custom date range filtering | **Missing** | Reports page has no date filter | — | — |

---

## Module 16: Notifications

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| Notification bell with unread count | **Complete** | AppShell header | `GET /api/notifications` | `UserNotificationRead` |
| Critical/warning/info severity levels | **Complete** | `NotificationCenter` | — | — |
| Mark single notification as read | **Complete** | `NotificationCenter` | `POST /api/notifications/read` | `UserNotificationRead` |
| Mark all as read | **Complete** | `NotificationCenter` | `POST /api/notifications/read-all` | `UserNotificationRead` |
| Filter by all / unread / critical | **Complete** | `NotificationCenter` | — | — |
| Auto-refresh every 60 seconds | **Complete** | `NotificationCenter` | — | — |
| Push notifications (browser) | **Missing** | Polling only | — | — |
| Email notifications | **Missing** | — | — | — |
| Notification preferences per user | **Missing** | — | — | — |

---

## Module 17: Audit Logs

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| View audit log (recent 50 entries) | **Complete** | `/audit-logs` | `GET /api/audit-logs` | `AuditLog` |
| Filter by entity / action | **Partial** | UI exists, pagination/filter UI needs review | — | `AuditLog` |
| Audit on Order create/update | **Complete** | — | — | `AuditLog` |
| Audit on Lead create/update/convert | **Complete** | — | — | `AuditLog` |
| Audit on InventoryItem create/update/delete | **Complete** | — | — | `AuditLog` |
| Audit on Purchase create | **Complete** | — | — | `AuditLog` |
| Audit on Employee create/update | **Complete** | — | — | `AuditLog` |
| Audit on Role create/update | **Complete** | — | — | `AuditLog` |
| Audit on ProductionStage update | **Complete** | — | — | `AuditLog` |
| Audit on Customer create | **Missing** | No writeAudit in `POST /api/customers` | — | — |
| Audit on Customer update | **Missing** | No writeAudit in `PATCH /api/customers/[id]` | — | — |
| Audit log export | **Missing** | — | — | — |
| Audit log retention policy | **Missing** | Records accumulate forever | — | — |

---

## Module 18: Settings

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| View system settings (key-value) | **Complete** | `/settings` | `GET /api/settings` | `SystemSetting` |
| Create / update settings | **Complete** | `/settings` | `POST /api/settings` (upsert) | `SystemSetting` |
| GROQ model configuration | **Partial** | Settings can store it, but no typed UI for GROQ_API_KEY | — | — |
| Store creation / management | **Missing** | No store management UI | — | `Store` |
| System backup / restore | **Missing** | — | — | — |

---

## Module 19: Global Search

| Feature | Status | Pages | APIs | DB Models |
|---|---|---|---|---|
| ⌘K / Ctrl+K search shortcut | **Complete** | All authenticated pages | — | — |
| Search customers by name/phone/email | **Complete** | Search overlay | `GET /api/search` | `Customer` |
| Search leads by name/phone/status/source | **Complete** | Search overlay | `GET /api/search` | `Lead` |
| Search orders by number/customer/status | **Complete** | Search overlay | `GET /api/search` | `Order` |
| Search inventory by SKU/name/category | **Complete** | Search overlay | `GET /api/search` | `InventoryItem` |
| Search purchases by PO number/vendor | **Complete** | Search overlay | `GET /api/search` | `Purchase` |
| Permission-scoped results | **Complete** | — | `hasPermission()` checks per entity | — |
| Store-scoped results | **Complete** | — | `storeScope()` | — |
| Search employees / roles | **Missing** | — | — | — |
| Search audit logs | **Missing** | — | — | — |

---

## Summary Counts

| Status | Count |
|---|---|
| **Complete** | 87 |
| **Partial** | 21 |
| **Missing** | 42 |
| **BROKEN** | 1 (Customer interaction POST) |

**Total features catalogued: 151**
