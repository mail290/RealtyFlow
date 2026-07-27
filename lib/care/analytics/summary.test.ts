import { describe, it, expect } from 'vitest';
import { computeCareSummary } from './summary';

const plans = [
  { id: 'p1', price_cents: 9900, visits_per_month: 1 },
  { id: 'p2', price_cents: 17900, visits_per_month: 2 },
];

describe('computeCareSummary', () => {
  it('computes MRR/ARR and visit load from active contracts only', () => {
    const s = computeCareSummary({
      propertiesCount: 3,
      plans,
      contracts: [
        { property_id: 'a', plan_id: 'p2', status: 'active' },
        { property_id: 'b', plan_id: 'p1', status: 'active' },
        { property_id: 'c', plan_id: 'p2', status: 'cancelled' }, // excluded
      ],
    });
    expect(s.active_contracts).toBe(2);
    expect(s.mrr_cents).toBe(9900 + 17900);
    expect(s.arr_cents).toBe((9900 + 17900) * 12);
    expect(s.visits_per_month).toBe(3);
  });

  it('sums open charges only', () => {
    const s = computeCareSummary({
      propertiesCount: 1, plans, contracts: [],
      charges: [
        { amount_cents: 1000, status: 'open' },
        { amount_cents: 5000, status: 'open' },
        { amount_cents: 9999, status: 'invoiced' }, // excluded
      ],
    });
    expect(s.open_charges_cents).toBe(6000);
  });

  it('splits invoiced-ytd from drafts and ignores void', () => {
    const s = computeCareSummary({
      propertiesCount: 1, plans, contracts: [], year: 2026,
      invoices: [
        { total_cents: 20000, status: 'sent', created_at: '2026-03-01' },
        { total_cents: 10000, status: 'paid', created_at: '2026-04-01' },
        { total_cents: 5000, status: 'draft', created_at: '2026-04-01' },
        { total_cents: 9999, status: 'void', created_at: '2026-04-01' },
        { total_cents: 7000, status: 'sent', created_at: '2025-12-01' }, // prior year
      ],
    });
    expect(s.invoiced_ytd_cents).toBe(30000);
    expect(s.draft_invoices_cents).toBe(5000);
  });

  it('counts open and urgent issues', () => {
    const s = computeCareSummary({
      propertiesCount: 1, plans, contracts: [],
      issues: [
        { status: 'open', severity: 'high' },
        { status: 'in_progress', severity: 'low' },
        { status: 'closed', severity: 'urgent' }, // excluded
      ],
    });
    expect(s.open_issues).toBe(2);
    expect(s.urgent_issues).toBe(1);
  });

  it('handles empty input', () => {
    const s = computeCareSummary({ propertiesCount: 0, plans: [], contracts: [] });
    expect(s.mrr_cents).toBe(0);
    expect(s.open_issues).toBe(0);
  });
});
