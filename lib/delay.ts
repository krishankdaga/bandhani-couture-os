import { DelayState, StageStatus } from "@prisma/client";

const DAY = 24 * 60 * 60 * 1000;

type DelayInput = {
  dueDate: Date;
  status: StageStatus;
  hasEverBeenRed: boolean;
  pardonApproved?: boolean;
  now?: Date;
};

/**
 * Delay is sticky by design: once red, an item can only show yellow after an
 * owner-approved pardon. It can never return to green, preserving escalation.
 */
export function calculateStageDelay(input: DelayInput): DelayState {
  const now = input.now ?? new Date();
  if (input.status === StageStatus.COMPLETED) {
    return input.hasEverBeenRed ? DelayState.YELLOW : DelayState.GREEN;
  }
  if (input.hasEverBeenRed) return input.pardonApproved ? DelayState.YELLOW : DelayState.RED;
  if (input.dueDate.getTime() < now.getTime()) return DelayState.RED;
  if (input.dueDate.getTime() - now.getTime() <= 2 * DAY) return DelayState.YELLOW;
  return DelayState.GREEN;
}

export function aggregateOrderDelay(states: DelayState[], hasEverBeenRed: boolean, _pardonApproved = false): DelayState {
  if (states.includes(DelayState.RED)) return DelayState.RED;
  // If no child remains red, it was completed or pardoned. Historical red keeps
  // the order yellow forever, ensuring the escalation is never erased.
  if (hasEverBeenRed) return DelayState.YELLOW;
  if (states.includes(DelayState.YELLOW)) return DelayState.YELLOW;
  return DelayState.GREEN;
}

/** What each delay state actually means — shown to users instead of the colour name. */
export const DELAY_STATE_LABELS: Record<DelayState, string> = {
  [DelayState.GREEN]: "On track",
  [DelayState.YELLOW]: "At risk",
  [DelayState.RED]: "Delayed",
};

export const stageLabels = {
  DYEING_PATTERN_CUTTING: "Dyeing & Pattern Cutting",
  EMBROIDERY: "Embroidery",
  STITCHING: "Stitching",
  QC: "QC",
  STYLIST_QC: "Stylist QC",
  DELIVERY: "Delivery",
} as const;
