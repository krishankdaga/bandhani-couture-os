import assert from "node:assert/strict";
import test from "node:test";
import { CompanyStatus, Role } from "@prisma/client";
import { ALL_PERMISSIONS, hasPermission, resolvePermissions } from "@/lib/permissions";

test("owner always has full access", () => {
  const permissions = resolvePermissions({ companyStatus: CompanyStatus.OWNER, legacyRole: Role.OWNER });
  assert.deepEqual(permissions, ALL_PERMISSIONS);
  assert.equal(hasPermission({ companyStatus: CompanyStatus.OWNER, permissions: [] }, "settings.edit"), true);
});

test("manager access is limited to assigned role permissions", () => {
  const permissions = resolvePermissions({ companyStatus: CompanyStatus.MANAGER, legacyRole: Role.STORE_MANAGER, rolePermissions: ["dashboard.view", "orders.view"] });
  assert.equal(hasPermission({ companyStatus: CompanyStatus.MANAGER, permissions }, "orders.view"), true);
  assert.equal(hasPermission({ companyStatus: CompanyStatus.MANAGER, permissions }, "employees.view"), false);
});

test("employee overrides can grant and deny individual actions", () => {
  const permissions = resolvePermissions({
    companyStatus: CompanyStatus.EMPLOYEE, legacyRole: Role.STYLIST, rolePermissions: ["dashboard.view", "leads.view"],
    overrides: [{ permission: "leads.view", granted: false }, { permission: "inventory.view", granted: true }],
  });
  assert.deepEqual(permissions, ["dashboard.view", "inventory.view"]);
});

test("API permission predicate denies an unassigned action", () => {
  assert.equal(hasPermission({ companyStatus: CompanyStatus.EMPLOYEE, permissions: ["dashboard.view"] }, "orders.create"), false);
});
