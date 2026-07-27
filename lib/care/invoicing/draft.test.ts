import { describe, it, expect } from 'vitest';
import { buildInvoiceDraft, formatInvoiceReference, type ChargeInput } from './draft';

const charges: ChargeInput[] = [
  { description: 'Posthenting', quantity: 1, unit_cents: 1000, amount_cents: 1000 },
  { description: 'Meet & greet', quantity: 2, unit_cents: 2500, amount_cents: 5000 },
];

describe('buildInvoiceDraft', () => {
  it('aggregates plan + charges with IVA', () => {
    const d = buildInvoiceDraft({ planName: 'Standard', fixedCents: 17900, charges, ivaPct: 21 });
    expect(d.fixed_cents).toBe(17900);
    expect(d.charges_cents).toBe(6000);
    expect(d.subtotal_cents).toBe(23900);
    expect(d.iva_cents).toBe(5019); // 21% of 23900
    expect(d.total_cents).toBe(28919);
    expect(d.lines).toHaveLength(3); // 1 plan + 2 charges
  });

  it('withholds IRPF from the total', () => {
    const d = buildInvoiceDraft({ planName: 'Standard', fixedCents: 10000, charges: [], ivaPct: 21, irpfPct: 15 });
    expect(d.iva_cents).toBe(2100);
    expect(d.irpf_cents).toBe(1500);
    expect(d.total_cents).toBe(10000 + 2100 - 1500); // 10600
  });

  it('omits the plan line when fixed is zero (charges-only invoice)', () => {
    const d = buildInvoiceDraft({ planName: 'x', fixedCents: 0, charges });
    expect(d.lines.every((l) => l.line_type === 'charge')).toBe(true);
    expect(d.subtotal_cents).toBe(6000);
  });

  it('rounds IVA half-up once', () => {
    // 21% of 10005 = 2101.05 -> 2101
    const d = buildInvoiceDraft({ planName: 'x', fixedCents: 10005, charges: [], ivaPct: 21 });
    expect(d.iva_cents).toBe(2101);
  });

  it('line/total invariant: subtotal = sum of line amounts', () => {
    const d = buildInvoiceDraft({ planName: 'Standard', fixedCents: 17900, charges, ivaPct: 21 });
    const sum = d.lines.reduce((a, l) => a + l.amount_cents, 0);
    expect(sum).toBe(d.subtotal_cents);
    expect(d.total_cents).toBe(d.subtotal_cents + d.iva_cents - d.irpf_cents);
  });

  it('rejects non-integer cents', () => {
    expect(() => buildInvoiceDraft({ planName: 'x', fixedCents: 100.5, charges: [] })).toThrow();
  });
});

describe('formatInvoiceReference', () => {
  it('formats gap-free INV-yy-seq', () => {
    expect(formatInvoiceReference('INV', 2026, 1)).toBe('INV-26-0001');
    expect(formatInvoiceReference('ZEN', 2026, 123)).toBe('ZEN-26-0123');
  });
});
