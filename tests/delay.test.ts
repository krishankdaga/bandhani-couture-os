import assert from "node:assert/strict";
import test from "node:test";
import { DelayState, StageStatus } from "@prisma/client";
import { aggregateOrderDelay, calculateStageDelay } from "@/lib/delay";

const now = new Date("2026-06-15T00:00:00.000Z");

test("overdue incomplete stages become red", () => {
  assert.equal(calculateStageDelay({ dueDate: new Date("2026-06-14T00:00:00.000Z"), status: StageStatus.IN_PROGRESS, hasEverBeenRed: false, now }), DelayState.RED);
});

test("a red stage cannot return to green", () => {
  assert.equal(calculateStageDelay({ dueDate: new Date("2026-07-15T00:00:00.000Z"), status: StageStatus.IN_PROGRESS, hasEverBeenRed: true, now }), DelayState.RED);
});

test("owner pardon reduces historical red to yellow only", () => {
  assert.equal(calculateStageDelay({ dueDate: new Date("2026-07-15T00:00:00.000Z"), status: StageStatus.IN_PROGRESS, hasEverBeenRed: true, pardonApproved: true, now }), DelayState.YELLOW);
});

test("orders with historical red never aggregate to green", () => {
  assert.equal(aggregateOrderDelay([DelayState.GREEN, DelayState.YELLOW], true), DelayState.YELLOW);
});
