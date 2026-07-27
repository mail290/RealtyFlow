// =====================================================================
// Live reads from the `care` schema (RealtyFlow Pro Supabase).
// =====================================================================
// Care tables enforce RLS (tenant_isolation), so these queries only return
// rows when the browser has a real Supabase Auth session whose user is a
// member of the org (care.org_members). Without a session the anon key
// sees nothing — callers fall back to local demo data.
//
// Requires:
//  - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY pointing at the project
//  - `care` added under Settings → API → Exposed schemas
//  - the signed-in auth user present in care.org_members
// =====================================================================

import { supabase, isCloudConnected } from '../supabase';
import { computeCareSummary, type CareSummary } from '../../lib/care/analytics/summary';
import type { KhProperty, KhPlan, KhContract, KhVendor } from '../../lib/care/types/careDb';

const care = () => supabase.schema('care');

/** True when connected AND a Supabase Auth session exists. */
export async function hasLiveSession(): Promise<boolean> {
  if (!isCloudConnected) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

export interface LiveCareData {
  properties: KhProperty[];
  plans: KhPlan[];
  contracts: KhContract[];
  vendors: KhVendor[];
}

/** Load the Care module's core records live (empty arrays if RLS hides them). */
export async function fetchCareData(): Promise<LiveCareData | null> {
  if (!(await hasLiveSession())) return null;
  try {
    const [properties, plans, contracts, vendors] = await Promise.all([
      care().from('kh_properties').select('*').order('created_at', { ascending: false }),
      care().from('kh_plans').select('*').order('price_cents', { ascending: true }),
      care().from('kh_contracts').select('*').order('created_at', { ascending: false }),
      care().from('kh_vendors').select('*').order('company_name', { ascending: true }),
    ]);
    if (properties.error || plans.error || contracts.error || vendors.error) {
      console.warn('Care live: read error', properties.error || plans.error || contracts.error || vendors.error);
      return null;
    }
    return {
      properties: (properties.data ?? []) as KhProperty[],
      plans: (plans.data ?? []) as KhPlan[],
      contracts: (contracts.data ?? []) as KhContract[],
      vendors: (vendors.data ?? []) as KhVendor[],
    };
  } catch (e) {
    console.warn('Care live: fetchCareData failed', e);
    return null;
  }
}

/** Build the economy summary from live `care` data; null if unavailable. */
export async function fetchCareSummaryLive(): Promise<CareSummary | null> {
  if (!(await hasLiveSession())) return null;
  try {
    const [propCount, contracts, plans, charges, invoices, issues, events] = await Promise.all([
      care().from('kh_properties').select('*', { count: 'exact', head: true }),
      care().from('kh_contracts').select('property_id, plan_id, status'),
      care().from('kh_plans').select('id, price_cents, visits_per_month'),
      care().from('kh_charges').select('amount_cents, status, occurred_on'),
      care().from('kh_invoices').select('total_cents, status, created_at'),
      care().from('kh_issues').select('status, severity'),
      care().from('kh_calendar_events').select('event_type, starts_at, status'),
    ]);

    const now = Date.now();
    const upcoming = (events.data ?? []).filter(
      (e: { event_type: string; starts_at: string; status: string }) =>
        e.event_type === 'inspection' && e.status === 'planned' && new Date(e.starts_at).getTime() >= now,
    ).length;

    return computeCareSummary({
      propertiesCount: propCount.count ?? 0,
      contracts: (contracts.data ?? []) as { property_id: string; plan_id: string; status: string }[],
      plans: (plans.data ?? []) as { id: string; price_cents: number; visits_per_month: number }[],
      charges: (charges.data ?? []) as { amount_cents: number; status: string }[],
      invoices: (invoices.data ?? []) as { total_cents: number; status: string; created_at?: string }[],
      issues: (issues.data ?? []) as { status: string; severity: string }[],
      upcomingInspections: upcoming,
    });
  } catch (e) {
    console.warn('Care live: fetchCareSummaryLive failed', e);
    return null;
  }
}
