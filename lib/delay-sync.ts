import { DelayState } from "@prisma/client";
import { aggregateOrderDelay, calculateStageDelay } from "@/lib/delay";
import { prisma } from "@/lib/prisma";

/**
 * The delay state persisted on orders/stages goes stale as time passes — a stage
 * can slip past its due date without anyone editing it. Dashboard and Command
 * Center recompute live, but list/report endpoints read the stored column, so the
 * two would contradict each other. This sync brings the stored state up to date.
 *
 * Throttled so read endpoints can call it on every request without hammering the
 * database; pass { force: true } for the explicit "Check delays" action.
 */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
let lastSyncAt = 0;
let inFlight: Promise<number> | null = null;

export async function syncDelayStates(options?: { force?: boolean }): Promise<number> {
  if (!options?.force && Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return 0;
  if (inFlight) return inFlight;
  inFlight = runSync().finally(() => {
    lastSyncAt = Date.now();
    inFlight = null;
  });
  return inFlight;
}

async function runSync(): Promise<number> {
  const stages = await prisma.productionStage.findMany({
    where: { status: { not: "COMPLETED" }, order: { status: { in: ["CONFIRMED", "IN_PRODUCTION", "READY"] } } },
    include: { pardons: { where: { status: "APPROVED" }, select: { id: true } } },
  });
  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const stage of stages) {
      const state = calculateStageDelay({ dueDate: stage.dueDate, status: stage.status, hasEverBeenRed: stage.hasEverBeenRed, pardonApproved: stage.pardons.length > 0 });
      if (state !== stage.delayState) {
        await tx.productionStage.update({ where: { id: stage.id }, data: { delayState: state, hasEverBeenRed: stage.hasEverBeenRed || state === DelayState.RED } });
        changed++;
      }
    }
    const orders = await tx.order.findMany({ where: { status: { in: ["CONFIRMED", "IN_PRODUCTION", "READY"] } }, include: { stages: { select: { delayState: true, hasEverBeenRed: true } }, pardons: { where: { status: "APPROVED" }, select: { id: true } } } });
    for (const order of orders) {
      const everRed = order.hasEverBeenRed || order.stages.some((stage) => stage.hasEverBeenRed || stage.delayState === DelayState.RED);
      const state = aggregateOrderDelay(order.stages.map((stage) => stage.delayState), everRed, order.pardons.length > 0);
      if (state !== order.delayState || everRed !== order.hasEverBeenRed) {
        await tx.order.update({ where: { id: order.id }, data: { delayState: state, hasEverBeenRed: everRed } });
        changed++;
      }
    }
  });
  return changed;
}
