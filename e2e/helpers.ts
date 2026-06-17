import { expect, type Page } from "@playwright/test";
import fixtures from "./fixtures.json";

export const FX = fixtures as {
  owner: { id: string; email: string; storeId: string };
  manager: { id: string; email: string; storeId: string };
  employee: { id: string; email: string; storeId: string };
  stylist: { id: string; email: string; storeId: string };
};

export const PASSWORD = "Password@123";

/** Log in through the real login form and land on the dashboard. */
export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL((url) => new URL(url).pathname === "/", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
}

/** A locator for a link inside the main sidebar navigation. */
export function navLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true });
}

/** Collect uncaught page errors and 5xx responses for assertions. */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return errors;
}
