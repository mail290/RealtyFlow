import { describe, it, expect } from 'vitest';
import {
  calculateWorkOrderFinancials,
  type AgreementSnapshot,
} from './workOrderFinancials';

const base = (o: Partial<AgreementSnapshot> = {}): AgreementSnapshot => ({
  fee_model: 'markup_on_cost',
  billing_route: 'agency_reinvoices',
  iva_pct: 21,
  irpf_pct: 0,
  currency: 'EUR',
  ...o,
});

describe('calculateWorkOrderFinancials — fee models', () => {
  it('markup_on_cost: fee = net*pct, owner net = net + fee (agency reinvoices)', () => {
    const r = calculateWorkOrderFinancials(base({ fee_pct: 15 }), 10000);
    expect(r.fee_cents).toBe(1500);
    expect(r.owner_net_cents).toBe(11500);
    expect(r.owner_iva_cents).toBe(2415); // 21% of 11500
    expect(r.owner_total_cents).toBe(13915);
  });

  it('commission_on_vendor: owner pays vendor directly, owner net = vendor net', () => {
    const r = calculateWorkOrderFinancials(
      base({ fee_model: 'commission_on_vendor', fee_pct: 20 }),
      10000,
    );
    expect(r.fee_cents).toBe(2000);
    expect(r.owner_net_cents).toBe(10000); // fee not added to owner
    expect(r.owner_total_cents).toBe(12100);
  });

  it('fixed_fee with agency_reinvoices adds fee to owner net', () => {
    const r = calculateWorkOrderFinancials(
      base({ fee_model: 'fixed_fee', fee_fixed_cents: 2500 }),
      10000,
    );
    expect(r.fee_cents).toBe(2500);
    expect(r.owner_net_cents).toBe(12500);
  });

  it('fixed_fee with vendor_invoices_owner does NOT add fee to owner net', () => {
    const r = calculateWorkOrderFinancials(
      base({
        fee_model: 'fixed_fee',
        fee_fixed_cents: 2500,
        billing_route: 'vendor_invoices_owner',
      }),
      10000,
    );
    expect(r.fee_cents).toBe(2500);
    expect(r.owner_net_cents).toBe(10000);
  });

  it('hourly_coordination: fee = hours * rate', () => {
    const r = calculateWorkOrderFinancials(
      base({ fee_model: 'hourly_coordination', hourly_rate_cents: 4500 }),
      10000,
      { hoursSpent: 2.5 },
    );
    expect(r.fee_cents).toBe(11250);
    expect(r.owner_net_cents).toBe(21250);
  });

  it('hourly_coordination without hours throws', () => {
    expect(() =>
      calculateWorkOrderFinancials(
        base({ fee_model: 'hourly_coordination', hourly_rate_cents: 4500 }),
        10000,
      ),
    ).toThrow(/hoursSpent/);
  });

  it('none: no fee, owner net = vendor net', () => {
    const r = calculateWorkOrderFinancials(base({ fee_model: 'none' }), 10000);
    expect(r.fee_cents).toBe(0);
    expect(r.owner_net_cents).toBe(10000);
    expect(r.owner_total_cents).toBe(12100);
  });
});

describe('calculateWorkOrderFinancials — clamps, callout, edge cases', () => {
  it('min and max active simultaneously — clamps to max when over', () => {
    const r = calculateWorkOrderFinancials(
      base({ fee_pct: 50, fee_min_cents: 1000, fee_max_cents: 3000 }),
      10000,
    );
    // 50% = 5000 -> clamped down to 3000
    expect(r.fee_cents).toBe(3000);
    expect(r.owner_net_cents).toBe(13000);
  });

  it('min and max active simultaneously — clamps up to min when under', () => {
    const r = calculateWorkOrderFinancials(
      base({ fee_pct: 5, fee_min_cents: 1000, fee_max_cents: 3000 }),
      10000,
    );
    // 5% = 500 -> clamped up to 1000
    expect(r.fee_cents).toBe(1000);
  });

  it('callout fee is added after clamping', () => {
    const r = calculateWorkOrderFinancials(
      base({ fee_pct: 50, fee_max_cents: 3000, callout_fee_cents: 1500 }),
      10000,
    );
    expect(r.fee_cents).toBe(4500); // 3000 clamped + 1500 callout
  });

  it('zero vendor amount produces all-zero money', () => {
    const r = calculateWorkOrderFinancials(base({ fee_pct: 15 }), 0);
    expect(r.fee_cents).toBe(0);
    expect(r.vendor_total_cents).toBe(0);
    expect(r.owner_total_cents).toBe(0);
  });

  it('rounds half-up once at the end (no mid-calc rounding drift)', () => {
    // 12.5% of 12345 = 1543.125 -> 1543
    const r = calculateWorkOrderFinancials(base({ fee_pct: 12.5 }), 12345);
    expect(r.fee_cents).toBe(1543);
    // 33.33% of 10001 = 3333.3333 -> 3333
    const r2 = calculateWorkOrderFinancials(base({ fee_pct: 33.33 }), 10001);
    expect(r2.fee_cents).toBe(3333);
    // exact .5 rounds up
    const r3 = calculateWorkOrderFinancials(base({ fee_pct: 5 }), 4610);
    // 5% of 4610 = 230.5 -> 231
    expect(r3.fee_cents).toBe(231);
  });

  it('rejects non-integer or negative vendor amounts', () => {
    expect(() => calculateWorkOrderFinancials(base(), 100.5)).toThrow();
    expect(() => calculateWorkOrderFinancials(base(), -100)).toThrow();
  });
});

describe('calculateWorkOrderFinancials — IRPF', () => {
  it('IRPF is withheld from the vendor amount, not the owner amount', () => {
    const r = calculateWorkOrderFinancials(
      base({ fee_model: 'none', irpf_pct: 15 }),
      10000,
    );
    expect(r.vendor_iva_cents).toBe(2100); // 21%
    expect(r.vendor_irpf_cents).toBe(1500); // 15%
    expect(r.vendor_total_cents).toBe(10000 + 2100 - 1500); // 10600
    // owner side untouched by IRPF
    expect(r.owner_net_cents).toBe(10000);
    expect(r.owner_iva_cents).toBe(2100);
    expect(r.owner_total_cents).toBe(12100);
  });
});

describe('calculateWorkOrderFinancials — budget cap', () => {
  it('blocks the order when owner total exceeds the cap', () => {
    const r = calculateWorkOrderFinancials(base({ fee_pct: 15 }), 10000, {
      budgetCapCents: 10000,
    });
    expect(r.blocked).toBe(true);
    expect(r.block_reason).toMatch(/exceeds budget cap/);
  });

  it('does not block when owner total is within the cap', () => {
    const r = calculateWorkOrderFinancials(base({ fee_pct: 15 }), 10000, {
      budgetCapCents: 20000,
    });
    expect(r.blocked).toBe(false);
  });
});

describe('calculateWorkOrderFinancials — line/total invariants', () => {
  const agreements: AgreementSnapshot[] = [
    base({ fee_pct: 15 }),
    base({ fee_model: 'commission_on_vendor', fee_pct: 20, irpf_pct: 15 }),
    base({ fee_model: 'fixed_fee', fee_fixed_cents: 2500, billing_route: 'vendor_invoices_owner' }),
    base({ fee_model: 'hourly_coordination', hourly_rate_cents: 4500 }),
    base({ fee_model: 'none', irpf_pct: 15 }),
  ];

  for (const [i, a] of agreements.entries()) {
    it(`sum of lines equals totals — agreement #${i}`, () => {
      const r = calculateWorkOrderFinancials(a, 33333, { hoursSpent: 1.5 });
      // vendor total = net + iva - irpf
      expect(r.vendor_total_cents).toBe(
        r.vendor_net_cents + r.vendor_iva_cents - r.vendor_irpf_cents,
      );
      // owner total = net + iva
      expect(r.owner_total_cents).toBe(r.owner_net_cents + r.owner_iva_cents);
    });
  }
});
