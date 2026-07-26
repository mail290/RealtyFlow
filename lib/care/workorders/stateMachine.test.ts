import { describe, it, expect } from 'vitest';
import {
  canTransition,
  transition,
  allowedTransitions,
  isTerminal,
  WORK_ORDER_STATUSES,
} from './stateMachine';

describe('work-order state machine', () => {
  it('walks the full happy path', () => {
    const path = [
      'draft',
      'sent',
      'quoted',
      'pending_owner_approval',
      'approved',
      'scheduled',
      'in_progress',
      'completed',
      'invoiced',
      'closed',
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(transition(path[i], path[i + 1])).toBe(path[i + 1]);
    }
  });

  it('rejects skipping a step', () => {
    expect(canTransition('draft', 'approved')).toBe(false);
    expect(() => transition('draft', 'completed')).toThrow(/illegal/);
  });

  it('allows owner rejection back to draft from pending approval', () => {
    expect(canTransition('pending_owner_approval', 'draft')).toBe(true);
  });

  it('allows cancellation from any non-terminal, billable-safe state', () => {
    for (const s of ['draft', 'sent', 'quoted', 'approved', 'in_progress', 'completed']) {
      expect(canTransition(s as never, 'cancelled')).toBe(true);
    }
  });

  it('invoiced can only go to closed (not cancelled)', () => {
    expect(allowedTransitions('invoiced')).toEqual(['closed']);
    expect(canTransition('invoiced', 'cancelled')).toBe(false);
  });

  it('closed and cancelled are terminal', () => {
    expect(isTerminal('closed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(allowedTransitions('closed')).toEqual([]);
  });

  it('throws on unknown status', () => {
    expect(() => transition('bogus' as never, 'draft')).toThrow(/unknown/);
  });

  it('exposes all statuses', () => {
    expect(WORK_ORDER_STATUSES).toContain('pending_owner_approval');
    expect(WORK_ORDER_STATUSES.length).toBe(11);
  });
});
