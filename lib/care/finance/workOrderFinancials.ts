// =====================================================================
// Work-order commission engine — pure, no DB access, fully tested.
// =====================================================================
// Principle 4: all money is integer minor units (cents). IVA and IRPF
// are separate fields, never baked into a total. Rounding is applied
// once, half-up, at the end — never mid-calculation.
// =====================================================================

export type FeeModel =
  | 'commission_on_vendor'
  | 'markup_on_cost'
  | 'fixed_fee'
  | 'hourly_coordination'
  | 'none';

export type BillingRoute = 'agency_reinvoices' | 'vendor_invoices_owner';

/**
 * Frozen agreement terms (kh_vendor_agreements.agreement_snapshot).
 * Percentages are whole-number percents, e.g. 15 means 15 %.
 */
export interface AgreementSnapshot {
  fee_model: FeeModel;
  billing_route: BillingRoute;
  fee_pct?: number | null;
  fee_fixed_cents?: number | null;
  fee_min_cents?: number | null;
  fee_max_cents?: number | null;
  callout_fee_cents?: number | null;
  hourly_rate_cents?: number | null;
  iva_pct: number;
  irpf_pct: number;
  currency?: string;
}

export interface WorkOrderFinancials {
  currency: string;
  // vendor side
  vendor_net_cents: number;
  vendor_iva_cents: number;
  vendor_irpf_cents: number;
  vendor_total_cents: number; // net + iva - irpf
  // agency fee
  fee_cents: number;
  // owner side
  owner_net_cents: number;
  owner_iva_cents: number;
  owner_total_cents: number; // net + iva
  // control
  blocked: boolean; // true when budget_cap exceeded — order must not proceed
  block_reason?: string;
}

/** Half-up rounding to the nearest integer cent. Works for negatives too. */
function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

function pct(amountCents: number, percent: number | null | undefined): number {
  if (!percent) return 0;
  return (amountCents * percent) / 100;
}

/**
 * Compute all monetary lines for a work order from its frozen agreement.
 *
 * @param agreement       frozen agreement terms
 * @param vendorNetCents  the vendor's net price (integer cents)
 * @param opts.hoursSpent required for the `hourly_coordination` model
 * @param opts.budgetCapCents  if set and the owner total exceeds it, the
 *                             order is flagged `blocked` instead of returned
 *                             as a payable amount.
 */
export function calculateWorkOrderFinancials(
  agreement: AgreementSnapshot,
  vendorNetCents: number,
  opts: { hoursSpent?: number; budgetCapCents?: number | null } = {},
): WorkOrderFinancials {
  if (!Number.isFinite(vendorNetCents) || vendorNetCents < 0) {
    throw new Error('vendorNetCents must be a non-negative finite number');
  }
  if (!Number.isInteger(vendorNetCents)) {
    throw new Error('vendorNetCents must be an integer number of cents');
  }

  const currency = agreement.currency ?? 'EUR';
  const { hoursSpent, budgetCapCents } = opts;

  // --- 1. Raw fee before clamping / callout, as a real number ---
  let feeRaw: number;
  switch (agreement.fee_model) {
    case 'markup_on_cost':
    case 'commission_on_vendor':
      feeRaw = pct(vendorNetCents, agreement.fee_pct);
      break;
    case 'fixed_fee':
      feeRaw = agreement.fee_fixed_cents ?? 0;
      break;
    case 'hourly_coordination':
      if (hoursSpent == null || !Number.isFinite(hoursSpent) || hoursSpent < 0) {
        throw new Error('hourly_coordination requires a non-negative hoursSpent');
      }
      feeRaw = (agreement.hourly_rate_cents ?? 0) * hoursSpent;
      break;
    case 'none':
      feeRaw = 0;
      break;
    default:
      throw new Error(`unknown fee_model: ${(agreement as AgreementSnapshot).fee_model}`);
  }

  // --- 2. Clamp between min and max (on the earned fee, before callout) ---
  if (agreement.fee_min_cents != null && feeRaw < agreement.fee_min_cents) {
    feeRaw = agreement.fee_min_cents;
  }
  if (agreement.fee_max_cents != null && feeRaw > agreement.fee_max_cents) {
    feeRaw = agreement.fee_max_cents;
  }

  // --- 3. Add callout fee, then round ONCE, half-up ---
  if (agreement.callout_fee_cents) {
    feeRaw += agreement.callout_fee_cents;
  }
  const fee_cents = roundHalfUp(feeRaw);

  // --- 4. Vendor side: IRPF is withheld from the vendor's amount ---
  const vendor_iva_cents = roundHalfUp(pct(vendorNetCents, agreement.iva_pct));
  const vendor_irpf_cents = roundHalfUp(pct(vendorNetCents, agreement.irpf_pct));
  const vendor_total_cents = vendorNetCents + vendor_iva_cents - vendor_irpf_cents;

  // --- 5. Owner net depends on model + billing route ---
  // Owner pays (vendorNet + fee) only when the agency re-invoices the work.
  // When the vendor invoices the owner directly, the owner's net is the
  // vendor's net; the fee is the agency's commission, billed separately.
  let owner_net_cents: number;
  switch (agreement.fee_model) {
    case 'commission_on_vendor':
      // Owner pays the vendor directly; agency earns commission from vendor.
      owner_net_cents = vendorNetCents;
      break;
    case 'none':
      owner_net_cents = vendorNetCents;
      break;
    default:
      // markup_on_cost / fixed_fee / hourly_coordination
      owner_net_cents =
        agreement.billing_route === 'agency_reinvoices'
          ? vendorNetCents + fee_cents
          : vendorNetCents;
      break;
  }

  const owner_iva_cents = roundHalfUp(pct(owner_net_cents, agreement.iva_pct));
  const owner_total_cents = owner_net_cents + owner_iva_cents;

  // --- 6. Budget cap: block rather than compute a payable amount ---
  let blocked = false;
  let block_reason: string | undefined;
  if (budgetCapCents != null && owner_total_cents > budgetCapCents) {
    blocked = true;
    block_reason = `owner_total ${owner_total_cents} exceeds budget cap ${budgetCapCents}`;
  }

  return {
    currency,
    vendor_net_cents: vendorNetCents,
    vendor_iva_cents,
    vendor_irpf_cents,
    vendor_total_cents,
    fee_cents,
    owner_net_cents,
    owner_iva_cents,
    owner_total_cents,
    blocked,
    block_reason,
  };
}
