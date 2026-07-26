// =====================================================================
// Hand-written TypeScript types mirroring the kh_ database schema.
// (Until `supabase gen types typescript` can run against a live project,
//  these are the source of truth for the Care module's data shapes.)
// =====================================================================

import type { FeeModel, BillingRoute } from '../finance/workOrderFinancials';

export type PropertyType = 'apartment' | 'townhouse' | 'villa' | 'finca';
export type Uuid = string;
/** i18n layer-3 user content: keyed by locale, with a `_source` marker. */
export type LocalizedText = { _source?: string; _mt?: string[] } & Record<string, string | string[] | undefined>;

export interface Org {
  id: Uuid;
  name: string;
  slug: string;
  default_locale: string;
  supported_locales: string[];
  currency: string;
  timezone: string;
  country: string;
  water_leak_lpd: number;
  power_leak_kwhpd: number;
  created_at: string;
}

export interface Locale {
  code: string;
  name_en: string;
  rtl: boolean;
}

export interface ChecklistTemplate {
  id: Uuid;
  org_id: Uuid;
  code: string;
  version: number;
  name: string;
  property_types: PropertyType[];
  min_photos: number;
  is_active: boolean;
  active_from: string;
  created_at: string;
}

export interface ChecklistItem {
  id: Uuid;
  org_id: Uuid;
  template_id: Uuid;
  code: string;
  sort_order: number;
  category: string;
  requires_photo: boolean;
  requires_value: boolean;
  value_unit: string | null;
  applies_to: PropertyType[];
  is_automatic: boolean;
  is_system: boolean;
}

export interface ChecklistItemTranslation {
  item_id: Uuid;
  locale: string;
  title: string;
  help_text: string | null;
}

export interface KhProperty {
  id: Uuid;
  org_id: Uuid;
  brand_id: Uuid | null;
  owner_id: Uuid;
  listing_id: Uuid | null;
  reference: string;
  property_type: PropertyType;
  name: string | null;
  address_line: string;
  municipality: string;
  postcode: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  has_pool: boolean;
  has_garden: boolean;
  access_notes: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export interface KhPlan {
  id: Uuid;
  org_id: Uuid;
  code: string;
  name: string | null;
  visits_per_month: number;
  price_cents: number;
  currency: string;
  included_services: string[];
  is_active: boolean;
  created_at: string;
}

export interface KhContract {
  id: Uuid;
  org_id: Uuid;
  property_id: Uuid;
  plan_id: Uuid;
  plan_snapshot: Record<string, unknown>;
  starts_on: string;
  ends_on: string | null;
  billing_day: number;
  status: string;
  created_at: string;
}

export interface KhVendor {
  id: Uuid;
  org_id: Uuid;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  tax_id: string | null;
  locales: string[];
  preferred_locale: string;
  service_areas: string[];
  is_preferred: boolean;
  insurance_expires_on: string | null;
  rating: number | null;
  notes: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export interface KhVendorAgreement {
  id: Uuid;
  org_id: Uuid;
  vendor_id: Uuid;
  fee_model: FeeModel;
  billing_route: BillingRoute;
  fee_pct: number | null;
  fee_fixed_cents: number | null;
  fee_min_cents: number | null;
  fee_max_cents: number | null;
  callout_fee_cents: number | null;
  hourly_rate_cents: number | null;
  iva_pct: number;
  irpf_pct: number;
  payment_terms_days: number;
  auto_approve_under_cents: number | null;
  valid_from: string;
  valid_to: string | null;
  currency: string;
  created_at: string;
}

export interface Trade {
  code: string;
  sort_order: number;
}

export interface KhIssue {
  id: Uuid;
  org_id: Uuid;
  property_id: Uuid;
  inspection_id: Uuid | null;
  item_code: string | null;
  severity: 'info' | 'low' | 'medium' | 'high' | 'urgent';
  title: LocalizedText;
  description: LocalizedText | null;
  trade_code: string | null;
  status: 'open' | 'in_progress' | 'closed';
  opened_at: string;
  closed_at: string | null;
}
