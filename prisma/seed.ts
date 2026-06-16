import { CompanyStatus, DelayState, LeadSource, LeadStatus, OrderStatus, Priority, PrismaClient, ProductionStageType, Role, StageStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_PERMISSIONS, LEGACY_ROLE_PERMISSIONS, Permission } from "../lib/permissions";

const prisma = new PrismaClient();
const addDays = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return date; };

async function main() {
  const passwordHash = await bcrypt.hash("Password@123", 12);
  const store = await prisma.store.upsert({ where: { code: "AMD-HQ" }, update: {}, create: { name: "Ahmedabad Flagship", code: "AMD-HQ", location: "Ahmedabad" } });
  const defaultRoles: Array<{ name: string; description: string; permissions: Permission[] }> = [
    { name: "Owner", description: "Full company access", permissions: ALL_PERMISSIONS },
    { name: "Store Manager", description: "Store sales and daily operations", permissions: LEGACY_ROLE_PERMISSIONS.STORE_MANAGER },
    { name: "Stylist", description: "Lead, customer and order workflows", permissions: LEGACY_ROLE_PERMISSIONS.STYLIST },
    { name: "Production Manager", description: "Order production and stage control", permissions: LEGACY_ROLE_PERMISSIONS.PRODUCTION_MANAGER },
    { name: "Inventory Team", description: "Inventory and stock movement", permissions: LEGACY_ROLE_PERMISSIONS.INVENTORY_TEAM },
    { name: "Purchase Team", description: "Purchase creation and receiving", permissions: LEGACY_ROLE_PERMISSIONS.PURCHASE_TEAM },
    { name: "Accounts Team", description: "Pricing, reports and incentives", permissions: LEGACY_ROLE_PERMISSIONS.ACCOUNTS_TEAM },
    { name: "QC Team", description: "Production quality control", permissions: LEGACY_ROLE_PERMISSIONS.QC_TEAM },
    { name: "Employee", description: "Basic dashboard access", permissions: ["dashboard.view"] },
  ];
  const companyRoles = new Map<string, string>();
  for (const definition of defaultRoles) {
    const role = await prisma.companyRole.upsert({
      where: { name: definition.name }, update: { description: definition.description, isSystem: true },
      create: { name: definition.name, description: definition.description, isSystem: true },
    });
    const permissionCount = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (permissionCount === 0) {
      await prisma.rolePermission.createMany({ data: definition.permissions.map((permission) => ({ roleId: role.id, permission })), skipDuplicates: true });
    }
    companyRoles.set(definition.name, role.id);
  }

  const roles: Array<[Role, string, string, CompanyStatus, string]> = [
    [Role.OWNER, "Aditi Shah", "owner@cbos.local", CompanyStatus.OWNER, "Owner"],
    [Role.PARTNER, "Rhea Mehta", "partner@cbos.local", CompanyStatus.MANAGER, "Store Manager"],
    [Role.STORE_MANAGER, "Neha Joshi", "manager@cbos.local", CompanyStatus.MANAGER, "Store Manager"],
    [Role.STYLIST, "Mira Patel", "employee@cbos.local", CompanyStatus.EMPLOYEE, "Employee"],
    [Role.STYLIST, "Mira Patel", "stylist@cbos.local", CompanyStatus.EMPLOYEE, "Stylist"],
    [Role.PRODUCTION_MANAGER, "Devika Rao", "production@cbos.local", CompanyStatus.MANAGER, "Production Manager"],
    [Role.QC_TEAM, "Isha Desai", "qc@cbos.local", CompanyStatus.EMPLOYEE, "QC Team"],
    [Role.INVENTORY_TEAM, "Kavya Jain", "inventory@cbos.local", CompanyStatus.EMPLOYEE, "Inventory Team"],
    [Role.PURCHASE_TEAM, "Tara Singh", "purchase@cbos.local", CompanyStatus.EMPLOYEE, "Purchase Team"],
    [Role.ACCOUNTS_TEAM, "Naina Kapoor", "accounts@cbos.local", CompanyStatus.EMPLOYEE, "Accounts Team"],
  ];
  for (const [role, name, email, companyStatus, companyRoleName] of roles) await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, companyStatus, companyRoleId: companyRoles.get(companyRoleName), storeId: store.id, active: true },
    create: { name, email, passwordHash, role, companyStatus, companyRoleId: companyRoles.get(companyRoleName), storeId: store.id },
  });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@cbos.local" } });
  const stylist = await prisma.user.findUniqueOrThrow({ where: { email: "stylist@cbos.local" } });
  const production = await prisma.user.findUniqueOrThrow({ where: { email: "production@cbos.local" } });
  const qc = await prisma.user.findUniqueOrThrow({ where: { email: "qc@cbos.local" } });

  // Seed is deliberately non-destructive. It may be run manually more than
  // once, but it must never erase business data created through Couture OS.
  const demoLeads = [
    { name: "Ananya Trivedi", phone: "9876501001", source: LeadSource.SOCIAL_MEDIA, storeId: store.id, stylistId: stylist.id, preferences: ["pastels", "mirror work"], budget: 180000, eventDate: addDays(80), followUpDate: new Date(), status: LeadStatus.FOLLOW_UP, notes: "Bridal reception enquiry" },
    { name: "Pooja Shah", phone: "9876501002", source: LeadSource.WALK_IN, storeId: store.id, stylistId: stylist.id, preferences: ["bandhani", "red"], budget: 120000, eventDate: addDays(55), followUpDate: addDays(1), status: LeadStatus.QUALIFIED },
    { name: "Meera Soni", phone: "9876501003", source: LeadSource.WHATSAPP, storeId: store.id, preferences: ["contemporary"], budget: 75000, followUpDate: addDays(-1), status: LeadStatus.NEW },
  ];
  for (const lead of demoLeads) {
    const exists = await prisma.lead.findFirst({ where: { phone: lead.phone } });
    if (!exists) await prisma.lead.create({ data: lead });
  }

  let convertedLead = await prisma.lead.findFirst({ where: { phone: "9876502001" } });
  if (!convertedLead) convertedLead = await prisma.lead.create({ data: { name: "Kiara Malhotra", phone: "9876502001", source: LeadSource.REFERRAL, storeId: store.id, stylistId: stylist.id, preferences: ["jewel tones", "traditional"], budget: 250000, status: LeadStatus.CONVERTED } });
  const customer = await prisma.customer.upsert({
    where: { phone: convertedLead.phone },
    update: {},
    create: { name: convertedLead.name, phone: convertedLead.phone, email: "kiara@example.com", storeId: store.id, leadId: convertedLead.id, preferences: ["jewel tones", "traditional"], likedPieces: ["Emerald bridal lehenga"], piecesTried: ["BL-042", "BL-055"], interactions: { create: { userId: stylist.id, type: "STORE_VISIT", summary: "First fitting and fabric selection completed." } }, communicationHistory: { create: { channel: "WHATSAPP", direction: "OUTBOUND", message: "Fitting appointment confirmed.", sentAt: new Date() } } },
  });
  if (convertedLead.status !== LeadStatus.CONVERTED) await prisma.lead.update({ where: { id: convertedLead.id }, data: { status: LeadStatus.CONVERTED } });

  const stages = Object.values(ProductionStageType);
  let order = await prisma.order.findUnique({ where: { orderNumber: "BD-2026-00001" }, include: { stages: true } });
  if (!order) order = await prisma.order.create({ data: {
      orderNumber: "BD-2026-00001", customerId: customer.id, stylistId: stylist.id, storeId: store.id, orderValue: 225000,
      measurements: { bust: "34", waist: "28", hip: "38", length: "43" }, customisations: ["Full sleeves", "Personalised dupatta border"],
      referenceImages: [], priority: Priority.HIGH, deliveryDate: addDays(18), status: OrderStatus.IN_PRODUCTION, delayState: DelayState.RED, hasEverBeenRed: true,
      stages: { create: stages.map((type, index) => ({
        type, sequence: index + 1, ownerId: type === ProductionStageType.QC || type === ProductionStageType.STYLIST_QC ? qc.id : production.id,
        dueDate: index === 0 ? addDays(-2) : addDays((index + 1) * 3), startDate: index === 0 ? addDays(-7) : null,
        status: index === 0 ? StageStatus.BLOCKED : StageStatus.NOT_STARTED, delayState: index === 0 ? DelayState.RED : index === 1 ? DelayState.YELLOW : DelayState.GREEN,
        hasEverBeenRed: index === 0, remarks: index === 0 ? "Vendor dye lot delayed" : null,
      })) },
    }, include: { stages: true } });
  const seededPardon = await prisma.delayPardon.findFirst({ where: { stageId: order.stages[0].id, reason: "Regional transport strike delayed the dye lot." } });
  if (!seededPardon) await prisma.delayPardon.create({ data: { stageId: order.stages[0].id, reason: "Regional transport strike delayed the dye lot.", requestedById: production.id } });
  const seedAudit = await prisma.auditLog.findFirst({ where: { action: "SEED", entity: "System", entityId: "initial-data" } });
  if (!seedAudit) await prisma.auditLog.create({ data: { userId: owner.id, action: "SEED", entity: "System", entityId: "initial-data", newValue: { store: store.name, users: roles.length } } });
  console.log("Seed complete. Demo logins (password for all: Password@123):");
  console.log("Owner: owner@cbos.local");
  console.log("Manager: manager@cbos.local");
  console.log("Employee: employee@cbos.local");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
