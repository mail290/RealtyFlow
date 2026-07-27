// =====================================================================
// Care economy summary — pure aggregation for the RealtyFlow brand/economy
// overview. No DB access; feed it the current records. Money in cents.
// =====================================================================

export interface SummaryContract { property_id: string; plan_id: string; status: string }
export interface SummaryPlan { id: string; price_cents: number; visits_per_month: number }
export interface SummaryCharge { amount_cents: number; status: string; occurred_on?: string }
export interface SummaryInvoice { total_cents: number; status: string; created_at?: string }
export interface SummaryIssue { status: string; severity: string }

export interface CareSummaryInput {
  propertiesCount: number;
  contracts: SummaryContract[];
  plans: SummaryPlan[];
  charges?: SummaryCharge[];
  invoices?: SummaryInvoice[];
  issues?: SummaryIssue[];
  upcomingInspections?: number;
  year?: number;
}

export interface CareSummary {
  properties_under_management: number;
  active_contracts: number;
  mrr_cents: number;              // monthly recurring revenue from active plans
  arr_cents: number;              // mrr * 12
  visits_per_month: number;       // contracted inspection load
  open_charges_cents: number;
  invoiced_ytd_cents: number;     // non-void invoices this year
  draft_invoices_cents: number;
  open_issues: number;
  urgent_issues: number;
  upcoming_inspections: number;
  currency: string;
}

export function computeCareSummary(input: CareSummaryInput): CareSummary {
  const year = input.year ?? new Date().getFullYear();
  const planById = new Map(input.plans.map((p) => [p.id, p]));
  const active = input.contracts.filter((c) => c.status === 'active');

  let mrr = 0;
  let visits = 0;
  for (const c of active) {
    const plan = planById.get(c.plan_id);
    if (plan) {
      mrr += plan.price_cents;
      visits += plan.visits_per_month;
    }
  }

  const openCharges = (input.charges ?? [])
    .filter((c) => c.status === 'open')
    .reduce((a, c) => a + c.amount_cents, 0);

  const inYear = (iso?: string) => !iso || new Date(iso).getFullYear() === year;
  const invoicedYtd = (input.invoices ?? [])
    .filter((i) => i.status !== 'void' && i.status !== 'draft' && inYear(i.created_at))
    .reduce((a, i) => a + i.total_cents, 0);
  const draftInvoices = (input.invoices ?? [])
    .filter((i) => i.status === 'draft')
    .reduce((a, i) => a + i.total_cents, 0);

  const openIssues = (input.issues ?? []).filter((i) => i.status !== 'closed');

  return {
    properties_under_management: input.propertiesCount,
    active_contracts: active.length,
    mrr_cents: mrr,
    arr_cents: mrr * 12,
    visits_per_month: visits,
    open_charges_cents: openCharges,
    invoiced_ytd_cents: invoicedYtd,
    draft_invoices_cents: draftInvoices,
    open_issues: openIssues.length,
    urgent_issues: openIssues.filter((i) => i.severity === 'urgent' || i.severity === 'high').length,
    upcoming_inspections: input.upcomingInspections ?? 0,
    currency: 'EUR',
  };
}
