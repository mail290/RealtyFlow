// =====================================================================
// Aggregates Care records (careStore + opsStore) into the economy summary
// shown on the RealtyFlow brand/economy overview. Kept separate from the
// stores to avoid an import cycle.
// =====================================================================

import { careStore } from '../careService';
import { opsStore } from './opsService';
import { computeCareSummary, type CareSummary } from '../../lib/care/analytics/summary';

export function getCareSummary(): CareSummary {
  const properties = careStore.getProperties();
  const contracts = careStore.getContracts();
  const plans = careStore.getPlans();
  const charges = opsStore.getCharges();
  const invoices = opsStore.getInvoices();

  // Inspections scheduled from today onward across all properties.
  const now = Date.now();
  const upcoming = opsStore
    .getEvents()
    .filter((e) => e.event_type === 'inspection' && new Date(e.starts_at).getTime() >= now && e.status === 'planned')
    .length;

  return computeCareSummary({
    propertiesCount: properties.length,
    contracts: contracts.map((c) => ({ property_id: c.property_id, plan_id: c.plan_id, status: c.status })),
    plans: plans.map((p) => ({ id: p.id, price_cents: p.price_cents, visits_per_month: p.visits_per_month })),
    charges: charges.map((c) => ({ amount_cents: c.amount_cents, status: c.status, occurred_on: c.occurred_on })),
    invoices: invoices.map((i) => ({ total_cents: i.total_cents, status: i.status, created_at: i.created_at })),
    upcomingInspections: upcoming,
  });
}

/** Subscribe to both stores so the overview refreshes on any Care change. */
export function subscribeCare(listener: () => void): () => void {
  const a = careStore.subscribe(listener);
  const b = opsStore.subscribe(listener);
  return () => { a(); b(); };
}
