// =====================================================================
// Invoice draft aggregation (Fase 6) — pure, tested.
// =====================================================================
// The monthly amount is fixed per plan; add-on charges are what must be
// tracked. At month end, fixed + open charges roll into a draft the human
// approves before it goes out (never auto-send). Money in integer cents,
// IVA and IRPF as separate lines, half-up rounding once at the end.
//
// Spanish invoicing needs gap-free numbering and (likely) Verifactu —
// confirm the number series with the gestor before going live.
// =====================================================================

export interface ChargeInput {
  id?: string;
  description: string;
  quantity: number;
  unit_cents: number;
  amount_cents: number; // frozen quantity * unit_cents
}

export interface InvoiceLine {
  line_type: 'plan' | 'charge';
  description: string;
  quantity: number;
  unit_cents: number;
  amount_cents: number;
  charge_id?: string;
}

export interface InvoiceDraft {
  lines: InvoiceLine[];
  fixed_cents: number;
  charges_cents: number;
  subtotal_cents: number;
  iva_pct: number;
  iva_cents: number;
  irpf_pct: number;
  irpf_cents: number;
  total_cents: number;
  currency: string;
}

export interface DraftInput {
  planName: string;
  fixedCents: number;
  charges: ChargeInput[];
  ivaPct?: number;
  irpfPct?: number;
  currency?: string;
}

const roundHalfUp = (v: number) => Math.sign(v) * Math.round(Math.abs(v));

export function buildInvoiceDraft(input: DraftInput): InvoiceDraft {
  const ivaPct = input.ivaPct ?? 21;
  const irpfPct = input.irpfPct ?? 0;
  const currency = input.currency ?? 'EUR';

  if (!Number.isInteger(input.fixedCents) || input.fixedCents < 0) {
    throw new Error('fixedCents must be a non-negative integer');
  }

  const lines: InvoiceLine[] = [];
  if (input.fixedCents > 0) {
    lines.push({
      line_type: 'plan',
      description: input.planName,
      quantity: 1,
      unit_cents: input.fixedCents,
      amount_cents: input.fixedCents,
    });
  }
  let charges_cents = 0;
  for (const c of input.charges) {
    if (!Number.isInteger(c.amount_cents)) {
      throw new Error(`charge amount_cents must be an integer (${c.description})`);
    }
    charges_cents += c.amount_cents;
    lines.push({
      line_type: 'charge',
      description: c.description,
      quantity: c.quantity,
      unit_cents: c.unit_cents,
      amount_cents: c.amount_cents,
      charge_id: c.id,
    });
  }

  const subtotal_cents = input.fixedCents + charges_cents;
  const iva_cents = roundHalfUp((subtotal_cents * ivaPct) / 100);
  const irpf_cents = roundHalfUp((subtotal_cents * irpfPct) / 100);
  const total_cents = subtotal_cents + iva_cents - irpf_cents;

  return {
    lines,
    fixed_cents: input.fixedCents,
    charges_cents,
    subtotal_cents,
    iva_pct: ivaPct,
    iva_cents,
    irpf_pct: irpfPct,
    irpf_cents,
    total_cents,
    currency,
  };
}

/** Gap-free customer-facing number: INV-26-0001. */
export function formatInvoiceReference(prefix: string, year: number, seq: number): string {
  const yy = String(year % 100).padStart(2, '0');
  return `${prefix}-${yy}-${String(seq).padStart(4, '0')}`;
}
