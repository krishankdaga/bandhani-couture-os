/**
 * Seeds realistic couture inventory items and purchases.
 * Removes the existing test purchase, then adds 8 inventory items and 3 purchases.
 *
 * Run: npx tsx scripts/seed-inventory.ts
 */
import { InventoryCategory, PrismaClient, PurchaseStatus, StockMovementType } from "@prisma/client";

const prisma = new PrismaClient();
const addDays = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d; };

async function main() {
  const store = await prisma.store.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@cbos.local" } });

  // ─── Clear existing inventory and purchases ────────────────────────────────
  console.log("⏳  Removing existing inventory and purchases...");
  await prisma.purchaseLine.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.orderMaterial.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  console.log("✓  Cleared.");

  // ─── Inventory items ───────────────────────────────────────────────────────
  console.log("⏳  Creating inventory items...");

  const items = [
    { sku: "FAB-001", name: "Pure Silk (Kanjivaram)", category: InventoryCategory.FABRIC, unit: "metres", quantity: 80, reorderAt: 20, costPrice: 3200, notes: "Heavy Kanjivaram silk — bridal lehengas and sarees" },
    { sku: "FAB-002", name: "Bandhani Georgette", category: InventoryCategory.FABRIC, unit: "metres", quantity: 120, reorderAt: 30, costPrice: 850, notes: "Lightweight bandhani print — dupattas and kurtas" },
    { sku: "FAB-003", name: "Embroidery Net (Ivory)", category: InventoryCategory.FABRIC, unit: "metres", quantity: 60, reorderAt: 15, costPrice: 1100, notes: "Ivory net base for blouses and overlays" },
    { sku: "FAB-004", name: "Raw Silk Lining", category: InventoryCategory.FABRIC, unit: "metres", quantity: 200, reorderAt: 50, costPrice: 480, notes: "Inner lining for all heavy garments" },
    { sku: "ACC-001", name: "Zari Thread (Gold)", category: InventoryCategory.ACCESSORY, unit: "rolls", quantity: 45, reorderAt: 10, costPrice: 320, notes: "Pure zari for hand embroidery borders" },
    { sku: "ACC-002", name: "Mirror Embellishments (Small)", category: InventoryCategory.ACCESSORY, unit: "pcs", quantity: 2500, reorderAt: 500, costPrice: 2, notes: "8mm mirrors for bandhani and folk detailing" },
    { sku: "ACC-003", name: "Pearl Buttons", category: InventoryCategory.ACCESSORY, unit: "pcs", quantity: 800, reorderAt: 200, costPrice: 8, notes: "White shell buttons — blouses and kurtas" },
    { sku: "PKG-001", name: "Garment Bags (Branded)", category: InventoryCategory.PACKAGING, unit: "pcs", quantity: 150, reorderAt: 30, costPrice: 45, notes: "Dust-proof garment bags with Bandhani branding" },
  ];

  const created = [];
  for (const item of items) {
    const inv = await prisma.inventoryItem.create({
      data: {
        ...item,
        storeId: store.id,
        movements: {
          create: { type: StockMovementType.IN, quantity: item.quantity, reason: "Opening stock", createdById: owner.id },
        },
      },
    });
    created.push(inv);
    console.log(`  ✓  ${inv.sku}  ${inv.name}  (${inv.quantity} ${inv.unit})`);
  }

  // ─── Purchases ─────────────────────────────────────────────────────────────
  console.log("⏳  Creating purchases...");

  // PO-001 — Ordered, expected in 5 days
  const po1 = await prisma.purchase.create({
    data: {
      purchaseNo: "PO-1001",
      vendorName: "Riya Fabrics, Surat",
      storeId: store.id,
      status: PurchaseStatus.ORDERED,
      totalAmount: 96000,
      expectedDate: addDays(5),
      notes: "Restock for upcoming bridal season — 2 lehenga orders already need silk",
      lines: {
        create: [
          { itemName: "Pure Silk (Kanjivaram)", quantity: 20, unit: "metres", rate: 3200, amount: 64000 },
          { itemName: "Embroidery Net (Ivory)", quantity: 16, unit: "metres", rate: 1100, amount: 17600 },
          { itemName: "Raw Silk Lining", quantity: 30, unit: "metres", rate: 480, amount: 14400 },
        ],
      },
    },
  });
  console.log(`  ✓  ${po1.purchaseNo}  ${po1.vendorName}  (${po1.status})`);

  // PO-002 — Requested, pending approval
  const po2 = await prisma.purchase.create({
    data: {
      purchaseNo: "PO-1002",
      vendorName: "Jaipur Zari Works",
      storeId: store.id,
      status: PurchaseStatus.REQUESTED,
      totalAmount: 28800,
      expectedDate: addDays(12),
      notes: "Zari stock is running low — need before Embroidery stage starts on BD-1002",
      lines: {
        create: [
          { itemName: "Zari Thread (Gold)", quantity: 30, unit: "rolls", rate: 320, amount: 9600 },
          { itemName: "Mirror Embellishments (Small)", quantity: 2000, unit: "pcs", rate: 2, amount: 4000 },
          { itemName: "Pearl Buttons", quantity: 400, unit: "pcs", rate: 8, amount: 3200 },
          { itemName: "Garment Bags (Branded)", quantity: 50, unit: "pcs", rate: 45, amount: 2250 },
        ],
      },
    },
  });
  console.log(`  ✓  ${po2.purchaseNo}  ${po2.vendorName}  (${po2.status})`);

  // PO-003 — Received (historical)
  const po3 = await prisma.purchase.create({
    data: {
      purchaseNo: "PO-1000",
      vendorName: "Ahmedabad Fabric Mart",
      storeId: store.id,
      status: PurchaseStatus.RECEIVED,
      totalAmount: 102000,
      expectedDate: addDays(-10),
      receivedDate: addDays(-8),
      notes: "Opening stock purchase at store launch",
      lines: {
        create: [
          { itemName: "Bandhani Georgette", quantity: 120, unit: "metres", rate: 850, amount: 102000 },
        ],
      },
    },
  });
  console.log(`  ✓  ${po3.purchaseNo}  ${po3.vendorName}  (${po3.status})`);

  console.log("");
  console.log(`Done! ${created.length} inventory items and 3 purchases created.`);
  console.log("  PO-1000  Received (historical)");
  console.log("  PO-1001  Ordered — arriving in 5 days");
  console.log("  PO-1002  Requested — awaiting approval");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
