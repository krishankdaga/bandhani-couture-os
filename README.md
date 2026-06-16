# Bandhani / Siddhartha Daga

**Couture OS** is the internal ERP for Bandhani / Siddhartha Daga.

Internal ERP for couture CRM, orders, production, inventory, purchases, pricing, reports, incentives, WhatsApp workflows, employees, and role-based access.

## Required environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`: PostgreSQL connection string.
- `AUTH_SECRET`: long random secret used to sign the JWT session cookie.
- `GROQ_API_KEY`: optional; required for the owner-only Bandhani Assistant.
- `GROQ_MODEL`: optional; defaults to `llama-3.1-8b-instant`.

`GROQ_API_KEY` is read only by the server route and is never sent to the browser.
After changing `.env`, stop and restart `npm run dev`; Next.js does not reload server environment variables reliably in an already-running process.
For local development, `npm run dev` intentionally prefers the `.env` values for `GROQ_API_KEY` and `GROQ_MODEL` over stale exported shell values. Production continues to use the deployment platform environment.

## Local setup

Install Node.js 20+ and PostgreSQL 15+, create the database, then run:

```bash
npm install
npx prisma migrate dev
npx prisma generate
npm run seed
npm run dev
```

For production or CI deployment, apply committed migrations without creating new ones:

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
npm run start
```

The seed is idempotent and does not delete business data. It must be run explicitly; app startup never migrates, resets, or seeds PostgreSQL.

## Demo users

All demo passwords are `Password@123`.

| Company status | Email |
| --- | --- |
| Owner | `owner@cbos.local` |
| Manager | `manager@cbos.local` |
| Employee | `employee@cbos.local` |

Default roles: Owner, Store Manager, Stylist, Production Manager, Inventory Team, Purchase Team, Accounts Team, QC Team, and Employee.

## Access model

- The legacy detailed `Role` remains for workflow compatibility.
- `CompanyStatus` provides Owner, Manager, and Employee status.
- Company roles and permissions are stored in PostgreSQL.
- Owner access is unconditional.
- Managers and employees receive assigned role permissions plus employee-specific overrides.
- Permissions and active status are reloaded from Prisma on each authenticated request, so access changes apply after refresh.
- Employees and Roles & Access are owner-only administrative modules.

## ERP features

- Global search in the header with `Cmd+K` or `Ctrl+K`.
- Permission-aware notifications for production delays, risky orders, low stock, pending receipts, follow-ups, and owner pardon requests.
- CSV exports for customers, inventory, purchases, and reports.
- Owner-only Bandhani Assistant backed by concise live Prisma context and Groq, with per-user rate limiting, audit history, and a local data fallback when Groq is unavailable.
- Print-friendly customer and order summaries.
- Role-sensitive dashboard with follow-ups, production bottlenecks, low stock, pending receipts, audit activity, and quick actions.
- Store-scoped inventory, purchase, report, notification, search, and export access.

## Verification commands

```bash
npx prisma validate
npx prisma generate
npm run typecheck
npm test
npm run build
npx prisma migrate status
```

## Multi-profile test checklist

Normal tabs share cookies. Use separate browser profiles, Firefox containers, or incognito sessions.

1. Login as Owner in a normal browser profile.
2. Login as Manager in incognito or another browser profile.
3. Login as Employee in a third profile.
4. As Owner, change a role permission.
5. Refresh Manager and Employee sessions and confirm sidebar and page access update.
6. Create an employee as Owner.
7. Edit that employee's role, company status, store, and permissions.
8. Confirm Manager cannot access employee management.
9. Confirm Employee cannot see or call the owner-only chatbot.
10. Confirm Owner can open Bandhani Assistant. Without `GROQ_API_KEY`, it should return a live local summary rather than fail the page.
11. Use `Cmd/Ctrl+K` and confirm grouped search results.
12. Confirm the notification badge shows unread alerts, mark one as read, then use **Mark all as read** and refresh to verify persistence.
13. Download all four CSV exports and open them in a spreadsheet.
14. Receive a purchase and confirm inventory quantity and movement history update.
15. Add and edit a customer, including address.
16. Recalculate production delays and confirm red stages never return to green.

## Deployment checklist

Required environment variables on every platform:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Production PostgreSQL connection string with SSL settings required by the provider. |
| `AUTH_SECRET` | Yes | Long random value, ideally 32+ bytes. Changing it signs out all users. |
| `GROQ_API_KEY` | No | Enables AI-written Bandhani Assistant responses. Local live summaries work without it. |
| `GROQ_MODEL` | No | Groq model override; defaults to `llama-3.1-8b-instant`. |

Common production checks:

- Use Node.js 20 or newer and run `npm ci`.
- Run `npx prisma migrate deploy` once per release before the new app handles traffic.
- Never run `prisma migrate reset` against a production database.
- Use `npm run build` as the build command and `npm run start` as the start command.
- Confirm HTTPS, database backups, restore access, and a production owner account before inviting staff.
- Run `npm run typecheck`, `npm test`, and `npm run build` before deployment.

### Vercel

1. Import the repository and set the framework preset to Next.js.
2. Add all required environment variables for Production and Preview as appropriate.
3. Apply migrations from a trusted release machine or CI job with `npx prisma migrate deploy` before promoting the deployment.
4. Keep the build command as `npm run build`. Do not put destructive or development migrations in the Vercel build command.

### Render

1. Create a Web Service and a PostgreSQL database.
2. Set build command to `npm ci && npx prisma generate && npm run build`.
3. Set pre-deploy command to `npx prisma migrate deploy`.
4. Set start command to `npm run start` and add the environment variables above.

### Railway

1. Add PostgreSQL and connect `DATABASE_URL` to the application service.
2. Set build command to `npm ci && npx prisma generate && npm run build`.
3. Set pre-deploy command to `npx prisma migrate deploy`.
4. Set start command to `npm run start` and add `AUTH_SECRET` plus optional Groq variables.

## Store staff final QA

Use a test customer and test order. Do not use a real client until this checklist passes.

1. Open the login page and confirm the Bandhani / Siddhartha Daga name and icon are visible.
2. Sign in with an Owner, Manager, and Employee account in separate private browser windows.
3. Confirm each person sees only the menu items needed for their role and no admin-only empty messages.
4. Search for a customer, order number, and stock item; confirm the results and “last synced” time update.
5. Open notifications, mark one item read, refresh, and confirm it stays read.
6. Add a test lead, convert it to a customer, and verify the customer profile opens.
7. Create a test order and confirm its customer, value, delivery date, measurements, and stages are correct.
8. Print the customer summary and order summary; confirm navigation and action buttons are excluded.
9. Update an employee and a role permission as Owner, then confirm those actions appear in Audit Logs.
10. Ask Bandhani Assistant a business question. Confirm it answers normally or provides a live local summary if Groq is unavailable.
11. Click Sign out, cancel once, then confirm sign out and verify the login page returns.
12. On a phone-sized screen, confirm the sidebar, search, notifications, forms, and tables remain usable.

## Delay rules

- Green: due date is more than two days away.
- Yellow: due within two days, or previously red with an approved owner pardon.
- Red: overdue and incomplete.
- Once red, a stage or order can never return to green.
- Only an Owner can approve or reject a pardon.

Use **Recalculate delays** on Production to persist date-driven status changes. A production deployment can call `POST /api/delays/recalculate` from a protected scheduled job using an authorized session or service strategy.
