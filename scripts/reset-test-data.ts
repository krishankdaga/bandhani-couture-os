/**
 * Reset script: keeps 3 employees (owner, manager, stylist), removes all
 * orders/customers/leads, then creates fresh test data.
 *
 * Run: npx tsx scripts/reset-test-data.ts
 */
import { CompanyStatus, DelayState, LeadSource, LeadStatus, OrderStatus, Priority, PrismaClient, ProductionStageType, Role, StageStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const addDays = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d; };

async function main() {
  console.log("⏳  Removing existing orders, customers and leads...");

  // Delete in FK-safe order — this clears pardons, stages, materials, interactions via cascade
  await prisma.orderPayment.deleteMany({});
  await prisma.orderMaterial.deleteMany({});
  await prisma.delayPardon.deleteMany({});
  await prisma.productionStage.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.communication.deleteMany({});
  await prisma.interaction.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.incentive.deleteMany({});
  console.log("✓  Cleared orders, customers and leads.");

  console.log("⏳  Cleaning up employees...");

  // The 3 we keep (by email)
  const KEEP = ["owner@cbos.local", "manager@cbos.local", "stylist@cbos.local"];
  const extraUsers = await prisma.user.findMany({ where: { email: { notIn: KEEP } } });
  const extraIds = extraUsers.map((u) => u.id);

  if (extraIds.length) {
    // Unlink nullable FK references before deleting
    await prisma.productionStage.updateMany({ where: { ownerId: { in: extraIds } }, data: { ownerId: null } });
    await prisma.lead.updateMany({ where: { stylistId: { in: extraIds } }, data: { stylistId: null } });
    await prisma.delayPardon.updateMany({ where: { reviewedById: { in: extraIds } }, data: { reviewedById: null } });
    await prisma.orderMaterial.updateMany({ where: { createdById: { in: extraIds } }, data: { createdById: null } });
    await prisma.orderPayment.updateMany({ where: { recordedById: { in: extraIds } }, data: { recordedById: null } });
    await prisma.user.deleteMany({ where: { id: { in: extraIds } } });
    console.log(`✓  Removed ${extraIds.length} extra employee(s). Keeping: ${KEEP.join(", ")}`);
  } else {
    console.log("✓  Already at 3 employees.");
  }

  // ─── Fetch the 3 keepers ───────────────────────────────────────────────────
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@cbos.local" } });
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@cbos.local" } });
  const stylist = await prisma.user.findUniqueOrThrow({ where: { email: "stylist@cbos.local" } });
  const store = await prisma.store.findFirstOrThrow({ orderBy: { createdAt: "asc" } });

  // Also ensure the Mira Patel stylist is active and set to STYLIST role
  await prisma.user.update({ where: { id: stylist.id }, data: { active: true } });

  console.log("⏳  Creating test customers...");

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: "Priya Sharma",
        phone: "9876543210",
        email: "priya.sharma@example.com",
        address: "12 Navrangpura, Ahmedabad",
        storeId: store.id,
        preferences: ["pastels", "embroidery", "contemporary"],
        likedPieces: ["Ivory Anarkali", "Pastel Bandhani Set"],
        interactions: {
          create: {
            userId: stylist.id,
            type: "STORE_VISIT",
            summary: "Came in for bridal consultation. Very clear on preferences — pastels and heavy embroidery.",
          },
        },
      },
    }),
    prisma.customer.create({
      data: {
        name: "Kavya Reddy",
        phone: "9876543211",
        email: "kavya.reddy@example.com",
        address: "45 Koramangala, Bangalore",
        storeId: store.id,
        preferences: ["jewel tones", "traditional", "bandhani"],
        likedPieces: ["Royal Blue Lehenga"],
        interactions: {
          create: {
            userId: stylist.id,
            type: "WHATSAPP",
            summary: "WhatsApp enquiry for sister's wedding. Booked a store visit.",
          },
        },
      },
    }),
    prisma.customer.create({
      data: {
        name: "Zara Mirza",
        phone: "9876543212",
        email: "zara.mirza@example.com",
        address: "7 Defence Colony, Delhi",
        storeId: store.id,
        preferences: ["fusion", "minimal", "silk"],
        likedPieces: ["Silk Fusion Kurta Set"],
        interactions: {
          create: {
            userId: manager.id,
            type: "STORE_VISIT",
            summary: "Walked in for fusion wear. Interested in minimal silhouettes with rich fabric.",
          },
        },
      },
    }),
  ]);

  console.log(`✓  Created ${customers.length} customers.`);
  console.log("⏳  Creating test orders...");

  const stages = Object.values(ProductionStageType);

  // Order 1 — In production, on time
  const order1Count = await prisma.order.count({ where: { orderNumber: { startsWith: "BD-" } } });
  const o1 = await prisma.order.create({
    data: {
      orderNumber: `BD-${1001 + order1Count}`,
      customerId: customers[0].id,
      stylistId: stylist.id,
      storeId: store.id,
      orderValue: 185000,
      measurements: { bust: "34", waist: "27", hip: "37", length: "44" },
      customisations: ["Full sleeves", "Ivory dupatta with gold border", "Pearl buttons"],
      referenceImages: [],
      priority: Priority.HIGH,
      deliveryDate: addDays(22),
      status: OrderStatus.IN_PRODUCTION,
      delayState: DelayState.GREEN,
      stages: {
        create: stages.map((type, index) => ({
          type, sequence: index + 1,
          dueDate: addDays(Math.ceil(22 * ((index + 1) / stages.length))),
          status: index === 0 ? StageStatus.IN_PROGRESS : StageStatus.NOT_STARTED,
          startDate: index === 0 ? new Date() : null,
          ownerId: stylist.id,
        })),
      },
    },
  });

  // Order 2 — In production, high priority, slightly at risk
  const order2Count = await prisma.order.count({ where: { orderNumber: { startsWith: "BD-" } } });
  const o2 = await prisma.order.create({
    data: {
      orderNumber: `BD-${1001 + order2Count}`,
      customerId: customers[1].id,
      stylistId: stylist.id,
      storeId: store.id,
      orderValue: 240000,
      measurements: { bust: "36", waist: "30", hip: "40", length: "42" },
      customisations: ["Mirror work bodice", "Royal blue silk", "Zari border"],
      referenceImages: [],
      priority: Priority.URGENT,
      deliveryDate: addDays(10),
      status: OrderStatus.IN_PRODUCTION,
      delayState: DelayState.YELLOW,
      stages: {
        create: stages.map((type, index) => ({
          type, sequence: index + 1,
          dueDate: addDays(Math.ceil(10 * ((index + 1) / stages.length))),
          status: index < 2 ? StageStatus.COMPLETED : index === 2 ? StageStatus.IN_PROGRESS : StageStatus.NOT_STARTED,
          startDate: index <= 2 ? addDays(-(3 - index)) : null,
          completionDate: index < 2 ? addDays(-(2 - index)) : null,
          ownerId: manager.id,
        })),
      },
    },
  });

  // Order 3 — Pending confirmation (not yet started)
  const order3Count = await prisma.order.count({ where: { orderNumber: { startsWith: "BD-" } } });
  const o3 = await prisma.order.create({
    data: {
      orderNumber: `BD-${1001 + order3Count}`,
      customerId: customers[2].id,
      stylistId: stylist.id,
      storeId: store.id,
      orderValue: 95000,
      measurements: { bust: "32", waist: "26", hip: "36", length: "40" },
      customisations: ["Minimal embroidery", "Silk blend fabric"],
      referenceImages: [],
      priority: Priority.NORMAL,
      deliveryDate: addDays(35),
      status: OrderStatus.CONFIRMED,
      delayState: DelayState.GREEN,
      stages: {
        create: stages.map((type, index) => ({
          type, sequence: index + 1,
          dueDate: addDays(Math.ceil(35 * ((index + 1) / stages.length))),
          status: StageStatus.NOT_STARTED,
          ownerId: null,
        })),
      },
    },
  });

  // Add a test advance payment on order 1
  await prisma.orderPayment.create({
    data: {
      orderId: o1.id,
      amount: 50000,
      method: "UPI",
      kind: "ADVANCE",
      note: "Advance paid at booking",
      recordedById: manager.id,
    },
  });

  // Add a test advance payment on order 2
  await prisma.orderPayment.create({
    data: {
      orderId: o2.id,
      amount: 100000,
      method: "BANK_TRANSFER",
      kind: "ADVANCE",
      note: "50% advance at order confirmation",
      recordedById: manager.id,
    },
  });

  console.log(`✓  Created 3 orders: ${o1.orderNumber}, ${o2.orderNumber}, ${o3.orderNumber}`);
  console.log("");
  console.log("Done! Active employees:");
  console.log("  Owner:   owner@cbos.local    (Password@123)");
  console.log("  Manager: manager@cbos.local  (Password@123)");
  console.log("  Stylist: stylist@cbos.local  (Password@123)");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
