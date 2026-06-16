import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke / browser-test config. Targets an already-running dev server on :3000
 * (start it with `npm run dev`). Runs serially with a single worker because the
 * core-workflow tests mutate shared database state.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.APP_URL || "http://localhost:3000",
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
