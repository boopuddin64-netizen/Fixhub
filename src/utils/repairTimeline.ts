/**
 * Single source of truth for the customer-facing repair progress tracker (used by RepairTimeline and
 * ActiveRepairTracker, previously two copies of the same arrays). Driven by the job's statusHistory so each step can show
 * when it happened, and aware of the terminal DISPUTED / CANCELLED / REFUNDED states.
 */
import type { RepairLifecycleStatus } from '../types/index';

export type TimelineStepState = 'done' | 'current' | 'upcoming';
export interface TimelineStep { key: string; label: string; state: TimelineStepState; at?: string }
export type TimelineTerminal = 'DISPUTED' | 'CANCELLED' | 'REFUNDED' | null;

/** The order of the visible steps and the lifecycle statuses that mean "this step has been reached". */
export const TIMELINE_STEPS: { key: string; label: string; reachedBy: string[] }[] = [
  { key: 'booked', label: 'Booked', reachedBy: ['BOOKED', 'DEVICE_DROPPED_OFF', 'DEVICE_RECEIVED', 'DIAGNOSING', 'REPAIR_IN_PROGRESS', 'ADDITIONAL_DIAGNOSIS', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'] },
  { key: 'dropoff', label: 'Drop Off', reachedBy: ['DEVICE_DROPPED_OFF', 'DEVICE_RECEIVED', 'DIAGNOSING', 'REPAIR_IN_PROGRESS', 'ADDITIONAL_DIAGNOSIS', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'] },
  { key: 'checkin', label: 'Checked In', reachedBy: ['DEVICE_RECEIVED', 'DIAGNOSING', 'REPAIR_IN_PROGRESS', 'ADDITIONAL_DIAGNOSIS', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'] },
  { key: 'repair', label: 'Diagnosis & Repair', reachedBy: ['REPAIR_IN_PROGRESS', 'ADDITIONAL_DIAGNOSIS', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'] },
  { key: 'ready', label: 'Ready for Pickup', reachedBy: ['READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'] },
  { key: 'pickedup', label: 'Picked Up', reachedBy: ['PICKED_UP', 'COMPLETED'] },
  { key: 'warranty', label: 'Warranty', reachedBy: ['COMPLETED'] },
];

interface HistoryEntry { status: string; timestamp: string }

export function computeTimeline(status: RepairLifecycleStatus | string, history: HistoryEntry[] = []): {
  steps: TimelineStep[];
  terminal: TimelineTerminal;
  completed: number;
  total: number;
  percent: number;
  summary: string;
} {
  const terminal: TimelineTerminal = status === 'DISPUTED' || status === 'CANCELLED' || status === 'REFUNDED' ? status : null;
  // When did each step's earliest "reaching" status first appear in the history?
  const firstSeen = (statuses: string[]) => {
    const times = (history || []).filter((h) => statuses.includes(h.status)).map((h) => h.timestamp).filter(Boolean).sort();
    return times[0];
  };

  // For terminal states the tracker shows how far the job got: derive it from the history, not from the terminal status.
  const reachedStatuses = terminal ? (history || []).map((h) => h.status) : [status];
  const reached = (step: (typeof TIMELINE_STEPS)[number]) => reachedStatuses.some((s) => step.reachedBy.includes(s));

  let lastDone = -1;
  TIMELINE_STEPS.forEach((s, i) => { if (reached(s)) lastDone = i; });

  const steps: TimelineStep[] = TIMELINE_STEPS.map((s, i) => {
    const done = reached(s);
    const isCurrent = !terminal && i === lastDone + 1 && lastDone < TIMELINE_STEPS.length - 1;
    // "Warranty" is the final step: once COMPLETED it is done, and there is no separate current step
    return { key: s.key, label: s.label, state: done ? 'done' : isCurrent ? 'current' : 'upcoming', at: done ? firstSeen(s.reachedBy) : undefined };
  });

  const completed = steps.filter((s) => s.state === 'done').length;
  const total = steps.length;
  const percent = Math.round((completed / total) * 100);
  const summary = terminal
    ? { DISPUTED: 'Dispute under review', CANCELLED: 'Repair cancelled', REFUNDED: 'Payment refunded' }[terminal]
    : completed === total ? 'Repair complete'
    : `${completed} of ${total} steps done`;
  return { steps, terminal, completed, total, percent, summary };
}

/** Jobs that are finished for the customer's "Repairs" list (REFUNDED used to be shown as "active"). */
export function isHistoryStatus(status: string): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED' || status === 'REFUNDED';
}
