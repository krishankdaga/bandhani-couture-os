import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("development startup never seeds or resets PostgreSQL", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const startDev = await readFile("scripts/start-dev.mjs", "utf8");
  const startup = `${packageJson.scripts.dev}\n${startDev}`;

  assert.doesNotMatch(startup, /db:seed|prisma\/seed|deleteMany|migrate reset/i);
});

test("manual seed is non-destructive", async () => {
  const seed = await readFile("prisma/seed.ts", "utf8");
  assert.doesNotMatch(seed, /deleteMany|migrate reset/i);
  assert.match(seed, /upsert|findFirst/);
});
