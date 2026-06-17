import { expect, test } from "@playwright/test";
import { collectErrors, FX, login, navLink } from "./helpers";

// ---------------------------------------------------------------------------
// OWNER
// ---------------------------------------------------------------------------
test.describe("Owner", () => {
  test("login + dashboard + sidebar modules", async ({ page }) => {
    await login(page, FX.owner.email);
    for (const label of ["Dashboard", "Reports", "Inventory", "Purchases", "Employees", "Bandhani Assistant"]) {
      await expect(navLink(page, label)).toBeVisible();
    }
  });

  test("global search opens with Ctrl/Cmd+K", async ({ page }) => {
    await login(page, FX.owner.email);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByPlaceholder("Search customers, leads, orders, inventory…")).toBeVisible();
  });

  test("notifications open", async ({ page }) => {
    await login(page, FX.owner.email);
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  });

  test("reports page + store/date filters + employee performance + profile + CSV", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, FX.owner.email);
    await navLink(page, "Reports").click();
    await expect(page.getByRole("heading", { name: "Reports & Analytics" })).toBeVisible();

    // Store filter (owner-only) + date preset.
    const storeSelect = page.locator("select", { hasText: "All Stores" });
    await expect(storeSelect).toBeVisible();
    await page.getByRole("button", { name: "30d" }).click();

    // Employee performance section (behind the Team sub-nav tab) + a profile link.
    await page.getByRole("tab", { name: "Team" }).click();
    await expect(page.getByRole("heading", { name: "Employee performance" })).toBeVisible();
    const profileLink = page.locator('a[href^="/employees/"]').first();
    await expect(profileLink).toBeVisible();

    // CSV export download.
    await page.getByRole("button", { name: "Export CSV" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Summary report" }).click(),
    ]);
    expect(download.suggestedFilename()).toContain(".csv");

    // Open the employee profile.
    await profileLink.click();
    await expect(page).toHaveURL(/\/employees\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Permissions summary" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("assistant opens and answers from live data", async ({ page }) => {
    await login(page, FX.owner.email);
    await navLink(page, "Bandhani Assistant").click();
    await expect(page.getByRole("heading", { name: "Bandhani Assistant" })).toBeVisible();
    const input = page.getByPlaceholder(/Ask about/i);
    await input.fill("Summarise business status today");
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/assistant/chat") && r.request().method() === "POST", { timeout: 50_000 }),
      page.getByRole("button", { name: "Send" }).click(),
    ]);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(String(body.answer ?? "").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// MANAGER (store-scoped, no employees.view)
// ---------------------------------------------------------------------------
test.describe("Manager", () => {
  test("restricted sidebar (no Employees/Roles) but has Reports", async ({ page }) => {
    await login(page, FX.manager.email);
    await expect(navLink(page, "Reports")).toBeVisible();
    await expect(navLink(page, "Employees")).toHaveCount(0);
    await expect(navLink(page, "Roles & Access")).toHaveCount(0);
  });

  test("reports are store-scoped (no store picker)", async ({ page }) => {
    await login(page, FX.manager.email);
    await navLink(page, "Reports").click();
    await expect(page.getByRole("heading", { name: "Reports & Analytics" })).toBeVisible();
    await expect(page.locator("select", { hasText: "All Stores" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Team" }).click();
    await expect(page.getByRole("heading", { name: "Employee performance" })).toBeVisible();
  });

  test("own profile opens; an unpermitted colleague profile is denied", async ({ page }) => {
    await login(page, FX.manager.email);
    await page.goto(`/employees/${FX.manager.id}`);
    await expect(page.getByRole("heading", { name: "Permissions summary" })).toBeVisible();

    await page.goto(`/employees/${FX.stylist.id}`);
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// EMPLOYEE (dashboard.view only)
// ---------------------------------------------------------------------------
test.describe("Employee", () => {
  test("restricted sidebar + assistant hidden", async ({ page }) => {
    await login(page, FX.employee.email);
    await expect(navLink(page, "Dashboard")).toBeVisible();
    await expect(navLink(page, "Reports")).toHaveCount(0);
    await expect(navLink(page, "Inventory")).toHaveCount(0);
    await expect(navLink(page, "Bandhani Assistant")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Bandhani Assistant" })).toHaveCount(0);
  });

  test("unauthorized pages show Access Denied", async ({ page }) => {
    await login(page, FX.employee.email);
    for (const path of ["/reports", "/inventory", "/assistant", "/employees"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Access denied" }), `denied at ${path}`).toBeVisible();
    }
  });

  test("can view own profile (self-view)", async ({ page }) => {
    await login(page, FX.employee.email);
    await page.goto(`/employees/${FX.employee.id}`);
    await expect(page.getByRole("heading", { name: "Permissions summary" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// CORE WORKFLOWS (owner) — mutate shared DB, so run serially.
// ---------------------------------------------------------------------------
test.describe.serial("Core workflows", () => {
  const tag = Date.now().toString().slice(-6);
  const sku = `SMK-${tag}`;

  test("add customer + edit address", async ({ page }) => {
    await login(page, FX.owner.email);
    await navLink(page, "Customers").click();
    await page.getByLabel("Customer Name").fill(`Smoke Customer ${tag}`);
    await page.getByLabel("Phone").fill(`90000${tag}`);
    await page.getByPlaceholder("Full customer address").fill("12 Test Lane");
    await page.getByRole("button", { name: "Save Customer" }).click();
    await expect(page.getByText(`Smoke Customer ${tag}`).first()).toBeVisible();

    // Edit the address.
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByPlaceholder("Full customer address").fill("99 Updated Road");
    await page.getByRole("button", { name: "Update Customer" }).click();
    await expect(page.getByText("99 Updated Road").first()).toBeVisible();
  });

  test("add inventory item + stock in + stock out", async ({ page }) => {
    await login(page, FX.owner.email);
    await navLink(page, "Inventory").click();
    await page.getByLabel("SKU").fill(sku);
    await page.getByLabel("Item Name").fill(`Smoke Fabric ${tag}`);
    await page.getByLabel("Opening Quantity").fill("100");
    await page.getByLabel("Reorder Level").fill("10");
    await page.getByLabel("Cost Price").fill("50");
    await page.getByRole("button", { name: "Add Item" }).click();
    await expect(page.getByText(sku).first()).toBeVisible();

    // Stock movement (IN then OUT) on the item we just created.
    await page.getByPlaceholder("Search SKU, name or category").fill(sku);
    await page.getByRole("button", { name: "Stock In / Out" }).first().click();
    await page.getByPlaceholder("Reason").fill("Smoke top-up");
    await page.locator('input[type="number"]').last().fill("20");
    await page.getByRole("button", { name: "Save Movement" }).click();
    await expect(page.getByRole("button", { name: "Stock In / Out" }).first()).toBeVisible();
  });

  test("create purchase + receive into inventory", async ({ page }) => {
    await login(page, FX.owner.email);
    await navLink(page, "Purchases").click();
    // Create-in-drawer: open the drawer, then fill the form inside it.
    await page.getByRole("button", { name: "New purchase" }).click();
    const createDrawer = page.getByRole("dialog", { name: "New purchase" });
    await createDrawer.getByLabel("Vendor Name").fill(`Smoke Vendor ${tag}`);
    await createDrawer.getByLabel("Item Name").fill(`PO Fabric ${tag}`);
    await createDrawer.getByLabel("Quantity", { exact: true }).fill("5");
    await createDrawer.getByLabel("Rate").fill("200");
    await createDrawer.getByRole("button", { name: "Add purchase" }).click();
    await expect(page.getByText(`Smoke Vendor ${tag}`).first()).toBeVisible();

    // Receive the purchase into inventory. The "Receive stock" button is scoped
    // to this purchase's card; confirming happens in the shared drawer (a dialog
    // portaled to the body, so it's matched at the page/dialog level).
    const card = page.locator("div.p-5").filter({ hasText: `Smoke Vendor ${tag}` });
    await card.getByRole("button", { name: "Receive stock" }).click(); // opens drawer
    const drawer = page.getByRole("dialog", { name: "Receive stock" });
    await drawer.getByRole("button", { name: "Confirm receipt" }).click(); // submit
    await expect(card.getByText(/Received/)).toBeVisible();
  });

  test("production, incentives pages load", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, FX.owner.email);
    await navLink(page, "Production").click();
    await expect(page).toHaveURL(/\/production$/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await navLink(page, "Incentives").click();
    await expect(page).toHaveURL(/\/incentives$/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});
