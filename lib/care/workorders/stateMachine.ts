// =====================================================================
// Work-order state machine — explicit legal transitions (Phase 1 brief).
// =====================================================================
// Flow:
//   draft → sent → quoted → pending_owner_approval → approved
//        → scheduled → in_progress → completed → invoiced → closed
// Any state may be cancelled. Transitions are validated here, never with
// free-text status writes scattered across the app.
// =====================================================================

export type WorkOrderStatus =
  | 'draft'
  | 'sent'
  | 'quoted'
  | 'pending_owner_approval'
  | 'approved'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'invoiced'
  | 'closed'
  | 'cancelled';

const TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['quoted', 'cancelled'],
  quoted: ['pending_owner_approval', 'cancelled'],
  pending_owner_approval: ['approved', 'draft', 'cancelled'], // owner may reject → back to draft
  approved: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['invoiced', 'cancelled'],
  invoiced: ['closed'],
  closed: [],
  cancelled: [],
};

export const WORK_ORDER_STATUSES = Object.keys(TRANSITIONS) as WorkOrderStatus[];

export function canTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: WorkOrderStatus): WorkOrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isTerminal(status: WorkOrderStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

/**
 * Assert a transition is legal, returning the target status.
 * Throws with a clear message otherwise — callers persist the result.
 */
export function transition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): WorkOrderStatus {
  if (!TRANSITIONS[from]) {
    throw new Error(`unknown work-order status: ${from}`);
  }
  if (!canTransition(from, to)) {
    throw new Error(
      `illegal work-order transition ${from} → ${to}; allowed: [${allowedTransitions(
        from,
      ).join(', ')}]`,
    );
  }
  return to;
}
