import assert from "node:assert/strict";
import test from "node:test";
import { assistantFallback, selectModules } from "@/lib/assistant";
import { getGroqConfig, safeGroqConfig } from "@/lib/groq-config";
import { checkRateLimit } from "@/lib/rate-limit";

test("assistant maps questions to the relevant modules", () => {
  assert.deepEqual(selectModules("Which purchases are pending receipt?"), ["purchases"]);
  assert.deepEqual(selectModules("Show low stock fabrics"), ["inventory"]);
  assert.ok(selectModules("Compare store performance").includes("stores"));
  assert.ok(selectModules("Show production bottlenecks").includes("production"));
  assert.ok(selectModules("What incentives are unpaid?").includes("incentives"));
});

test("broad and unmatched questions pull the operational overview set", () => {
  const overview = selectModules("Summarise business status today");
  for (const key of ["orders", "production", "inventory", "purchases", "leads", "notifications"]) {
    assert.ok(overview.includes(key as never), `expected overview to include ${key}`);
  }
  // An unmatched question still returns the overview rather than nothing.
  assert.ok(selectModules("xyzzy").length > 0);
});

test("assistant fallback summarizes the structured module context", () => {
  const answer = assistantFallback({
    generatedAt: "2026-06-15T12:00:00.000Z",
    modules: { orders: { delayedCount: 2, atRiskCount: 1, dueThisWeek: [] }, inventory: { lowStockCount: 0 } },
  });
  assert.match(answer, /2 delayed/);
  assert.match(answer, /0 items low/);
  assert.match(answer, /temporarily unavailable/);
});

test("assistant rate limiter blocks requests over the window limit", () => {
  const key = `test-${Date.now()}-${Math.random()}`;
  assert.equal(checkRateLimit(key, 2, 60_000).allowed, true);
  assert.equal(checkRateLimit(key, 2, 60_000).allowed, true);
  assert.equal(checkRateLimit(key, 2, 60_000).allowed, false);
});

test("Groq config trims quotes and reports only safe diagnostics", () => {
  const env = { GROQ_API_KEY: '  "example-key"  ', GROQ_MODEL: "  llama-test  " } as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(getGroqConfig(env), { apiKey: "example-key", model: "llama-test", exists: true, keyLength: 11 });
  assert.deepEqual(safeGroqConfig(env), { keyExists: true, keyLength: 11, model: "llama-test" });
});
