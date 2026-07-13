import assert from "node:assert/strict";
import test from "node:test";
import { navigationForPermissions, navigationForRole } from "@/lib/navigation";

const labels = (role: string) => navigationForRole(role).map((item) => item.label);

test("owner receives the complete CBOS navigation", () => {
  assert.deepEqual(labels("OWNER"), [
    "Dashboard", "Leads", "Customers", "Orders", "Command Center", "Production", "Inventory", "Purchases",
    "Reports", "Incentives", "WhatsApp Automation", "Bandhani Assistant", "Vendors", "Employees", "Roles & Access",
    "Data Health", "Audit Logs", "Settings",
  ]);
});

test("specialist roles receive only relevant navigation", () => {
  assert.deepEqual(labels("QC_TEAM"), ["Dashboard", "Command Center", "Production"]);
  assert.deepEqual(labels("INVENTORY_TEAM"), ["Dashboard", "Inventory"]);
  assert.deepEqual(labels("PURCHASE_TEAM"), ["Dashboard", "Purchases"]);
});

test("database permissions filter navigation modules", () => {
  assert.deepEqual(navigationForPermissions(["dashboard.view", "orders.view"]).map((item) => item.label), ["Dashboard", "Orders"]);
  assert.equal(navigationForPermissions(["orders.create"]).length, 0);
});
