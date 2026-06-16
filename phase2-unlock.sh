#!/usr/bin/env bash
set -e

node <<'NODE'
const fs = require("fs");
const path = require("path");

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function patchSchema() {
  const file = "prisma/schema.prisma";
  let s = fs.readFileSync(file, "utf8");

  if (!s.includes("enum InventoryCategory")) {
    s += `

enum InventoryCategory {
  FABRIC
  FINISHED_GOOD
  ACCESSORY
  PACKAGING
  OTHER
}

enum StockMovementType {
  IN
  OUT
  ADJUSTMENT
}

enum PurchaseStatus {
  REQUESTED
  ORDERED
  RECEIVED
  CANCELLED
}

enum IncentiveStatus {
  PENDING
  APPROVED
  PAID
}

enum WhatsAppTemplateType {
  STYLIST_FOLLOW_UP
  PRODUCTION_REMINDER
  DELAY_ALERT
  DAILY_OWNER_SUMMARY
}

model InventoryItem {
  id          String            @id @default(cuid())
  sku         String            @unique
  name        String
  category    InventoryCategory
  storeId     String?
  quantity    Decimal           @default(0) @db.Decimal(12, 2)
  unit        String            @default("pcs")
  reorderAt   Decimal?          @db.Decimal(12, 2)
  costPrice   Decimal?          @db.Decimal(12, 2)
  sellingPrice Decimal?         @db.Decimal(12, 2)
  notes       String?
  movements   StockMovement[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([category])
  @@index([storeId])
}

model StockMovement {
  id              String            @id @default(cuid())
  inventoryItemId String
  inventoryItem   InventoryItem     @relation(fields: [inventoryItemId], references: [id], onDelete: Cascade)
  type            StockMovementType
  quantity        Decimal           @db.Decimal(12, 2)
  reason          String
  reference       String?
  createdById     String?
  createdAt       DateTime          @default(now())

  @@index([type])
  @@index([createdAt])
}

model Purchase {
  id          String         @id @default(cuid())
  purchaseNo  String         @unique
  vendorName  String
  storeId     String?
  status      PurchaseStatus @default(REQUESTED)
  totalAmount Decimal        @default(0) @db.Decimal(12, 2)
  expectedDate DateTime?
  receivedDate DateTime?
  notes       String?
  lines       PurchaseLine[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([status])
  @@index([createdAt])
}

model PurchaseLine {
  id          String   @id @default(cuid())
  purchaseId  String
  purchase    Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  itemName    String
  quantity    Decimal  @db.Decimal(12, 2)
  unit        String   @default("pcs")
  rate        Decimal  @db.Decimal(12, 2)
  amount      Decimal  @db.Decimal(12, 2)
}

model PricingTemplate {
  id              String   @id @default(cuid())
  name            String
  baseCost        Decimal  @db.Decimal(12, 2)
  fabricCost      Decimal  @default(0) @db.Decimal(12, 2)
  embroideryCost  Decimal  @default(0) @db.Decimal(12, 2)
  stitchingCost   Decimal  @default(0) @db.Decimal(12, 2)
  overheadPercent Decimal  @default(20) @db.Decimal(5, 2)
  marginPercent   Decimal  @default(35) @db.Decimal(5, 2)
  finalPrice      Decimal  @db.Decimal(12, 2)
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Incentive {
  id          String          @id @default(cuid())
  userId      String
  orderId     String?
  orderValue  Decimal         @db.Decimal(12, 2)
  percentage  Decimal         @default(1.5) @db.Decimal(5, 2)
  amount      Decimal         @db.Decimal(12, 2)
  status      IncentiveStatus @default(PENDING)
  notes       String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([userId])
  @@index([status])
}

model WhatsAppTemplate {
  id        String               @id @default(cuid())
  name      String
  type      WhatsAppTemplateType
  message   String
  active    Boolean              @default(true)
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt
}

model SystemSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
  }

  fs.writeFileSync(file, s);
}

patchSchema();

write("lib/phase2-permissions.ts", `
import { Role } from "@prisma/client";

export const INVENTORY_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER, Role.INVENTORY_TEAM, Role.PRODUCTION_MANAGER];
export const PURCHASE_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER, Role.PURCHASE_TEAM, Role.ACCOUNTS_TEAM];
export const PRICING_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER, Role.ACCOUNTS_TEAM];
export const REPORT_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER, Role.ACCOUNTS_TEAM];
export const INCENTIVE_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.ACCOUNTS_TEAM];
export const WHATSAPP_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER, Role.STYLIST];
export const SETTINGS_ROLES: Role[] = [Role.OWNER, Role.PARTNER];
`);

let nav = fs.readFileSync("lib/navigation.ts", "utf8");
nav = nav.replaceAll(", phase2: true", "");
fs.writeFileSync("lib/navigation.ts", nav);

write("app/api/inventory/route.ts", `
import { InventoryCategory, StockMovementType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { INVENTORY_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  category: z.nativeEnum(InventoryCategory),
  storeId: z.string().optional().nullable(),
  quantity: z.coerce.number().default(0),
  unit: z.string().default("pcs"),
  reorderAt: z.coerce.number().optional().nullable(),
  costPrice: z.coerce.number().optional().nullable(),
  sellingPrice: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, INVENTORY_ROLES);
  if (isApiError(user)) return user;

  const items = await prisma.inventoryItem.findMany({
    orderBy: { updatedAt: "desc" },
    include: { movements: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, INVENTORY_ROLES);
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());

    const item = await prisma.inventoryItem.create({
      data: {
        ...data,
        movements: data.quantity
          ? {
              create: {
                type: StockMovementType.IN,
                quantity: data.quantity,
                reason: "Opening stock",
                createdById: user.id,
              },
            }
          : undefined,
      },
      include: { movements: true },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
`);

write("app/api/inventory/[id]/movement/route.ts", `
import { StockMovementType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { INVENTORY_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  type: z.nativeEnum(StockMovementType),
  quantity: z.coerce.number().positive(),
  reason: z.string().min(2),
  reference: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, INVENTORY_ROLES);
  if (isApiError(user)) return user;

  try {
    const { id } = await params;
    const data = schema.parse(await request.json());

    const item = await prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
      const delta = data.type === "OUT" ? -data.quantity : data.quantity;

      await tx.stockMovement.create({
        data: {
          inventoryItemId: id,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
          reference: data.reference,
          createdById: user.id,
        },
      });

      return tx.inventoryItem.update({
        where: { id },
        data: { quantity: Number(current.quantity) + delta },
        include: { movements: { orderBy: { createdAt: "desc" }, take: 5 } },
      });
    });

    return NextResponse.json({ item });
  } catch (error) {
    return validationError(error);
  }
}
`);

write("app/api/purchases/route.ts", `
import { PurchaseStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { PURCHASE_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

const lineSchema = z.object({
  itemName: z.string().min(2),
  quantity: z.coerce.number().positive(),
  unit: z.string().default("pcs"),
  rate: z.coerce.number().nonnegative(),
});

const schema = z.object({
  vendorName: z.string().min(2),
  storeId: z.string().optional().nullable(),
  status: z.nativeEnum(PurchaseStatus).default(PurchaseStatus.REQUESTED),
  expectedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, PURCHASE_ROLES);
  if (isApiError(user)) return user;

  const purchases = await prisma.purchase.findMany({
    orderBy: { createdAt: "desc" },
    include: { lines: true },
  });

  return NextResponse.json({ purchases });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, PURCHASE_ROLES);
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    const totalAmount = data.lines.reduce((sum, line) => sum + line.quantity * line.rate, 0);
    const count = await prisma.purchase.count();
    const purchaseNo = \`PO-\${new Date().getFullYear()}-\${String(count + 1).padStart(5, "0")}\`;

    const purchase = await prisma.purchase.create({
      data: {
        purchaseNo,
        vendorName: data.vendorName,
        storeId: data.storeId,
        status: data.status,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        notes: data.notes,
        totalAmount,
        lines: {
          create: data.lines.map((line) => ({
            ...line,
            amount: line.quantity * line.rate,
          })),
        },
      },
      include: { lines: true },
    });

    return NextResponse.json({ purchase }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
`);

write("app/api/pricing/route.ts", `
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { PRICING_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  baseCost: z.coerce.number().nonnegative(),
  fabricCost: z.coerce.number().default(0),
  embroideryCost: z.coerce.number().default(0),
  stitchingCost: z.coerce.number().default(0),
  overheadPercent: z.coerce.number().default(20),
  marginPercent: z.coerce.number().default(35),
  notes: z.string().optional().nullable(),
});

function finalPrice(data: z.infer<typeof schema>) {
  const subtotal = data.baseCost + data.fabricCost + data.embroideryCost + data.stitchingCost;
  const withOverhead = subtotal * (1 + data.overheadPercent / 100);
  return Math.round(withOverhead * (1 + data.marginPercent / 100));
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request, PRICING_ROLES);
  if (isApiError(user)) return user;

  const templates = await prisma.pricingTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, PRICING_ROLES);
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    const template = await prisma.pricingTemplate.create({
      data: { ...data, finalPrice: finalPrice(data) },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
`);

write("app/api/incentives/route.ts", `
import { IncentiveStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { INCENTIVE_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  userId: z.string().min(1),
  orderId: z.string().optional().nullable(),
  orderValue: z.coerce.number().positive(),
  percentage: z.coerce.number().default(1.5),
  status: z.nativeEnum(IncentiveStatus).default(IncentiveStatus.PENDING),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, INCENTIVE_ROLES);
  if (isApiError(user)) return user;

  const incentives = await prisma.incentive.findMany({ orderBy: { createdAt: "desc" } });
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ incentives, users });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, INCENTIVE_ROLES);
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    const incentive = await prisma.incentive.create({
      data: {
        ...data,
        amount: Math.round(data.orderValue * data.percentage / 100),
      },
    });

    return NextResponse.json({ incentive }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
`);

write("app/api/whatsapp/route.ts", `
import { WhatsAppTemplateType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { WHATSAPP_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(WhatsAppTemplateType),
  message: z.string().min(5),
  active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, WHATSAPP_ROLES);
  if (isApiError(user)) return user;

  const templates = await prisma.whatsAppTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, WHATSAPP_ROLES);
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    const template = await prisma.whatsAppTemplate.create({ data });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
`);

write("app/api/settings/route.ts", `
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { SETTINGS_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  key: z.string().min(2),
  value: z.any(),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, SETTINGS_ROLES);
  if (isApiError(user)) return user;

  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, SETTINGS_ROLES);
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    const setting = await prisma.systemSetting.upsert({
      where: { key: data.key },
      create: data,
      update: { value: data.value },
    });

    return NextResponse.json({ setting });
  } catch (error) {
    return validationError(error);
  }
}
`);

write("app/api/reports/route.ts", `
import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { REPORT_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, REPORT_ROLES);
  if (isApiError(user)) return user;

  const [
    leads,
    customers,
    orders,
    delayedOrders,
    inventoryItems,
    lowStock,
    purchases,
    incentives,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.customer.count(),
    prisma.order.count(),
    prisma.order.count({ where: { delayState: { in: ["YELLOW", "RED"] } } }),
    prisma.inventoryItem.count(),
    prisma.inventoryItem.count({
      where: {
        reorderAt: { not: null },
      },
    }),
    prisma.purchase.count(),
    prisma.incentive.aggregate({ _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    summary: {
      leads,
      customers,
      orders,
      delayedOrders,
      inventoryItems,
      lowStock,
      purchases,
      incentivePayable: incentives._sum.amount || 0,
    },
  });
}
`);

write("components/phase2-card.tsx", `
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api, money } from "@/lib/client";

export function Phase2Card({
  title,
  description,
  endpoint,
  fields,
  listKey,
}: {
  title: string;
  description: string;
  endpoint: string;
  listKey: string;
  fields: { name: string; label: string; type?: string; placeholder?: string; options?: string[]; defaultValue?: string }[];
}) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data: any = await api(endpoint);
      setItems(data[listKey] || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial: Record<string, any> = {};
    fields.forEach((f) => {
      if (f.defaultValue !== undefined) initial[f.name] = f.defaultValue;
    });
    setForm(initial);
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await api(endpoint, {
        method: "POST",
        body: JSON.stringify(form),
      });

      const reset: Record<string, any> = {};
      fields.forEach((f) => {
        if (f.defaultValue !== undefined) reset[f.name] = f.defaultValue;
      });
      setForm(reset);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Phase 2 unlocked" title={title} description={description} />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Add New</h2>

          {fields.map((field) => (
            <label key={field.name} className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{field.label}</span>

              {field.options ? (
                <select
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-wine"
                  value={form[field.name] || field.defaultValue || field.options[0]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                >
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-wine"
                  value={form[field.name] || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: field.type === "number" ? Number(e.target.value) : e.target.value }))}
                />
              )}
            </label>
          ))}

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            disabled={saving}
            className="w-full rounded-xl bg-wine px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </form>

        <div className="card overflow-hidden">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-lg font-semibold">Records</h2>
            <p className="text-sm text-stone-500">{loading ? "Loading..." : items.length + " records"}</p>
          </div>

          <div className="divide-y divide-stone-100">
            {items.map((item) => (
              <div key={item.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{item.name || item.vendorName || item.purchaseNo || item.key || item.sku || "Record"}</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {item.sku || item.category || item.status || item.type || item.key || ""}
                    </p>
                  </div>

                  {"finalPrice" in item && <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">{money(item.finalPrice)}</span>}
                  {"totalAmount" in item && <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">{money(item.totalAmount)}</span>}
                  {"amount" in item && <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">{money(item.amount)}</span>}
                  {"quantity" in item && <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{String(item.quantity)} {item.unit}</span>}
                </div>

                {item.notes && <p className="mt-3 text-sm text-stone-600">{item.notes}</p>}
                {item.message && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-sand p-3 text-sm text-stone-700">{item.message}</p>}
              </div>
            ))}

            {!loading && items.length === 0 && (
              <div className="p-8 text-center text-sm text-stone-500">No records yet.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
`);

write("app/(app)/inventory/page.tsx", `
import { Phase2Card } from "@/components/phase2-card";

export default function Page() {
  return (
    <Phase2Card
      title="Inventory"
      description="Track fabrics, accessories, packaging and finished stock."
      endpoint="/api/inventory"
      listKey="items"
      fields={[
        { name: "sku", label: "SKU", placeholder: "FAB-001" },
        { name: "name", label: "Item Name", placeholder: "Bandhani silk fabric" },
        { name: "category", label: "Category", options: ["FABRIC", "FINISHED_GOOD", "ACCESSORY", "PACKAGING", "OTHER"], defaultValue: "FABRIC" },
        { name: "quantity", label: "Opening Quantity", type: "number", defaultValue: "0" },
        { name: "unit", label: "Unit", placeholder: "m / pcs", defaultValue: "pcs" },
        { name: "reorderAt", label: "Reorder Level", type: "number" },
        { name: "costPrice", label: "Cost Price", type: "number" },
        { name: "sellingPrice", label: "Selling Price", type: "number" },
        { name: "notes", label: "Notes" },
      ]}
    />
  );
}
`);

write("app/(app)/pricing/page.tsx", `
import { Phase2Card } from "@/components/phase2-card";

export default function Page() {
  return (
    <Phase2Card
      title="Pricing Calculator"
      description="Calculate couture pricing using fabric, embroidery, stitching, overhead and margin."
      endpoint="/api/pricing"
      listKey="templates"
      fields={[
        { name: "name", label: "Piece Name", placeholder: "Custom lehenga" },
        { name: "baseCost", label: "Base Cost", type: "number", defaultValue: "0" },
        { name: "fabricCost", label: "Fabric Cost", type: "number", defaultValue: "0" },
        { name: "embroideryCost", label: "Embroidery Cost", type: "number", defaultValue: "0" },
        { name: "stitchingCost", label: "Stitching Cost", type: "number", defaultValue: "0" },
        { name: "overheadPercent", label: "Overhead %", type: "number", defaultValue: "20" },
        { name: "marginPercent", label: "Margin %", type: "number", defaultValue: "35" },
        { name: "notes", label: "Notes" },
      ]}
    />
  );
}
`);

write("app/(app)/purchases/page.tsx", `
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api, money, shortDate } from "@/lib/client";

export default function Page() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [form, setForm] = useState({
    vendorName: "",
    itemName: "",
    quantity: 1,
    unit: "pcs",
    rate: 0,
    expectedDate: "",
    notes: "",
  });

  async function load() {
    const data: any = await api("/api/purchases");
    setPurchases(data.purchases || []);
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/purchases", {
      method: "POST",
      body: JSON.stringify({
        vendorName: form.vendorName,
        expectedDate: form.expectedDate || null,
        notes: form.notes,
        lines: [{ itemName: form.itemName, quantity: form.quantity, unit: form.unit, rate: form.rate }],
      }),
    });
    setForm({ vendorName: "", itemName: "", quantity: 1, unit: "pcs", rate: 0, expectedDate: "", notes: "" });
    await load();
  }

  return (
    <>
      <PageHeader eyebrow="Phase 2 unlocked" title="Purchases" description="Create purchase entries and track vendor sourcing." />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">New Purchase</h2>

          {[
            ["vendorName", "Vendor Name", "text"],
            ["itemName", "Item Name", "text"],
            ["quantity", "Quantity", "number"],
            ["unit", "Unit", "text"],
            ["rate", "Rate", "number"],
            ["expectedDate", "Expected Date", "date"],
            ["notes", "Notes", "text"],
          ].map(([key, label, type]) => (
            <label key={key} className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</span>
              <input
                type={type}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-wine"
                value={(form as any)[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
              />
            </label>
          ))}

          <button className="w-full rounded-xl bg-wine px-4 py-2 text-sm font-semibold text-white">Save Purchase</button>
        </form>

        <div className="card divide-y divide-stone-100 overflow-hidden">
          {purchases.map((purchase) => (
            <div key={purchase.id} className="p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{purchase.purchaseNo} · {purchase.vendorName}</h3>
                  <p className="text-sm text-stone-500">{purchase.status}{purchase.expectedDate ? " · Due " + shortDate(purchase.expectedDate) : ""}</p>
                </div>
                <span className="font-bold text-green-700">{money(purchase.totalAmount)}</span>
              </div>
              <p className="mt-2 text-sm text-stone-600">{purchase.lines?.map((l: any) => l.itemName + " x " + l.quantity).join(", ")}</p>
            </div>
          ))}
          {purchases.length === 0 && <div className="p-8 text-center text-sm text-stone-500">No purchases yet.</div>}
        </div>
      </div>
    </>
  );
}
`);

write("app/(app)/incentives/page.tsx", `
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api, money } from "@/lib/client";

export default function Page() {
  const [data, setData] = useState<any>({ incentives: [], users: [] });
  const [form, setForm] = useState({ userId: "", orderValue: 0, percentage: 1.5, notes: "" });

  async function load() {
    const result: any = await api("/api/incentives");
    setData(result);
    if (!form.userId && result.users?.[0]) setForm((prev) => ({ ...prev, userId: result.users[0].id }));
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/incentives", { method: "POST", body: JSON.stringify(form) });
    setForm((prev) => ({ ...prev, orderValue: 0, percentage: 1.5, notes: "" }));
    await load();
  }

  return (
    <>
      <PageHeader eyebrow="Phase 2 unlocked" title="Incentives" description="Calculate stylist/team incentives from order value." />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="card space-y-4 p-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">User</span>
            <select className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              {data.users?.map((u: any) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Order Value</span>
            <input type="number" className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" value={form.orderValue} onChange={(e) => setForm({ ...form, orderValue: Number(e.target.value) })} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Percentage</span>
            <input type="number" className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: Number(e.target.value) })} />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Notes</span>
            <input className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>

          <button className="w-full rounded-xl bg-wine px-4 py-2 text-sm font-semibold text-white">Save Incentive</button>
        </form>

        <div className="card divide-y divide-stone-100 overflow-hidden">
          {data.incentives?.map((i: any) => (
            <div key={i.id} className="flex justify-between p-5">
              <div>
                <h3 className="font-semibold">{i.status}</h3>
                <p className="text-sm text-stone-500">Order value {money(i.orderValue)} · {i.percentage}%</p>
              </div>
              <span className="font-bold text-green-700">{money(i.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
`);

write("app/(app)/whatsapp/page.tsx", `
import { Phase2Card } from "@/components/phase2-card";

export default function Page() {
  return (
    <Phase2Card
      title="WhatsApp Automation"
      description="Prepare reminder templates for stylists, production teams and owners."
      endpoint="/api/whatsapp"
      listKey="templates"
      fields={[
        { name: "name", label: "Template Name", placeholder: "Morning stylist follow-up" },
        { name: "type", label: "Template Type", options: ["STYLIST_FOLLOW_UP", "PRODUCTION_REMINDER", "DELAY_ALERT", "DAILY_OWNER_SUMMARY"], defaultValue: "STYLIST_FOLLOW_UP" },
        { name: "message", label: "Message", placeholder: "Good morning, please follow up with..." },
      ]}
    />
  );
}
`);

write("app/(app)/settings/page.tsx", `
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";

export default function Page() {
  const [settings, setSettings] = useState<any[]>([]);
  const [key, setKey] = useState("business_name");
  const [value, setValue] = useState("Bandhani & Siddhartha Daga");

  async function load() {
    const data: any = await api("/api/settings");
    setSettings(data.settings || []);
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/settings", { method: "POST", body: JSON.stringify({ key, value }) });
    await load();
  }

  return (
    <>
      <PageHeader eyebrow="Phase 2 unlocked" title="Settings" description="Store business-level configuration for CBOS." />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="card space-y-4 p-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Key</span>
            <input className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Value</span>
            <input className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <button className="w-full rounded-xl bg-wine px-4 py-2 text-sm font-semibold text-white">Save Setting</button>
        </form>

        <div className="card divide-y divide-stone-100 overflow-hidden">
          {settings.map((s) => (
            <div key={s.id} className="p-5">
              <h3 className="font-semibold">{s.key}</h3>
              <p className="mt-1 text-sm text-stone-600">{typeof s.value === "string" ? s.value : JSON.stringify(s.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
`);

write("app/(app)/reports/page.tsx", `
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api, money } from "@/lib/client";

export default function Page() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    api<any>("/api/reports").then((data) => setSummary(data.summary));
  }, []);

  const cards = summary ? [
    ["Leads", summary.leads],
    ["Customers", summary.customers],
    ["Orders", summary.orders],
    ["Delayed Orders", summary.delayedOrders],
    ["Inventory Items", summary.inventoryItems],
    ["Low Stock Watch", summary.lowStock],
    ["Purchases", summary.purchases],
    ["Incentive Payable", money(summary.incentivePayable)],
  ] : [];

  return (
    <>
      <PageHeader eyebrow="Phase 2 unlocked" title="Reports" description="Owner-level business snapshot across CRM, orders, production, stock and finance." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </>
  );
}
`);

console.log("Phase 2 files written.");
NODE

npx prisma migrate dev --name phase2_modules
npx prisma generate
npm run typecheck
