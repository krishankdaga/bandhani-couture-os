import assert from "node:assert/strict";
import test from "node:test";
import { safeJsonArray, safeJsonParse, safeResponseJson } from "@/lib/json";

test("safeJsonParse accepts already parsed objects", () => {
  const value = { color: "red" };
  assert.equal(safeJsonParse(value, {}), value);
});

test("safeJsonParse falls back for empty or malformed JSON", () => {
  assert.deepEqual(safeJsonParse("", []), []);
  assert.deepEqual(safeJsonParse("<html>error</html>", {}), {});
});

test("safeJsonArray normalizes null, strings and mixed arrays", () => {
  assert.deepEqual(safeJsonArray(null), []);
  assert.deepEqual(safeJsonArray('["red","gold"]'), ["red", "gold"]);
  assert.deepEqual(safeJsonArray(["red", 42, null]), ["red"]);
});

test("safeResponseJson does not throw on a non-JSON API response", async () => {
  const response = new Response("Internal Server Error", { status: 500 });
  assert.deepEqual(await safeResponseJson(response, { error: "fallback" }), { error: "fallback" });
});
