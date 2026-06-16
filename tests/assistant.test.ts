import assert from "node:assert/strict";
import test from "node:test";
import { assistantFallback, assistantTopics } from "@/lib/assistant";
import { getGroqConfig, safeGroqConfig } from "@/lib/groq-config";
import { checkRateLimit } from "@/lib/rate-limit";

test("assistant selects relevant database topics", () => {
  assert.deepEqual(assistantTopics("Which purchases are pending receipt?"), ["purchases"]);
  assert.deepEqual(assistantTopics("Show low stock fabrics"), ["inventory"]);
  assert.equal(assistantTopics("Summarise business status today").length, 5);
});

test("assistant fallback summarizes available live context", () => {
  const answer = assistantFallback({ generatedAt: "2026-06-15T12:00:00.000Z", orders: [{ id: 1 }], inventory: [] });
  assert.match(answer, /1 active orders/);
  assert.match(answer, /0 low-stock items/);
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
