// =====================================================================
// Care (keyholding) data service.
// =====================================================================
// Mirrors the existing RealtyFlow store pattern (subscribe/notify +
// localStorage) so the Care admin UI works in the app's demo mode.
// When Supabase is truly connected AND a real session exists, reads/writes
// are sent to the kh_ tables with RLS doing tenant isolation. Otherwise it
// degrades to localStorage seeded with the demo org — exactly like
// propertyService/leadService do today.
//
// NOTE: full multi-tenant enforcement requires wiring real Supabase Auth
// (the app currently uses a hardcoded credential check). Until then the
// cloud path is best-effort and the local demo path is the default.
// =====================================================================

import { supabase, isCloudConnected } from './supabase';
import checklistItems from '../lib/care/data/checklist.json';
import { resolveTranslation } from '../lib/care/i18n/resolveTranslation';
import type {
  KhProperty,
  KhPlan,
  KhContract,
  KhVendor,
  PropertyType,
} from '../lib/care/types/careDb';

const STORAGE_KEY = 'rf_care_data_v1';
export const DEMO_ORG_ID = '11111111-1111-1111-1111-111111111111';

type ChecklistSeedItem = (typeof checklistItems)[number];

interface CareState {
  properties: KhProperty[];
  plans: KhPlan[];
  contracts: KhContract[];
  vendors: KhVendor[];
}

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

const nowIso = () => new Date().toISOString();

function seedPlans(orgId: string): KhPlan[] {
  const mk = (
    code: string,
    name: string,
    visits: number,
    cents: number,
    services: string[],
  ): KhPlan => ({
    id: uuid(),
    org_id: orgId,
    code,
    name,
    visits_per_month: visits,
    price_cents: cents,
    currency: 'EUR',
    included_services: services,
    is_active: true,
    created_at: nowIso(),
  });
  return [
    mk('basic', 'Basic — 1 tilsyn/mnd', 1, 9900, []),
    mk('standard', 'Standard — 2 tilsyn/mnd', 2, 17900, ['mail_handling']),
    mk('premium', 'Premium — 4 tilsyn/mnd', 4, 32900, ['mail_handling', 'pre_arrival']),
  ];
}

class CareService {
  private state: CareState;
  private listeners: (() => void)[] = [];

  constructor() {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      try {
        this.state = JSON.parse(saved);
      } catch {
        this.state = this.freshState();
      }
    } else {
      this.state = this.freshState();
    }
  }

  private freshState(): CareState {
    return {
      properties: [],
      plans: seedPlans(DEMO_ORG_ID),
      contracts: [],
      vendors: [],
    };
  }

  // ---- checklist (read-only system content) ----

  /** The 42-point standard checklist, resolved to a locale with fallback. */
  getChecklist(locale: string, orgDefault = 'no') {
    return (checklistItems as ChecklistSeedItem[])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        ...item,
        title: resolveTranslation(
          Object.entries(item.title).map(([l, title]) => ({ locale: l, title })),
          locale,
          orgDefault,
        ),
      }));
  }

  /** Checklist filtered to the points that apply to a property type. */
  getChecklistFor(propertyType: PropertyType, locale: string, orgDefault = 'no') {
    return this.getChecklist(locale, orgDefault).filter((i) =>
      i.applies_to.includes(propertyType),
    );
  }

  // ---- properties ----

  getProperties(): KhProperty[] {
    return this.state.properties;
  }

  async addProperty(input: Partial<KhProperty>): Promise<KhProperty> {
    const property: KhProperty = {
      id: uuid(),
      org_id: DEMO_ORG_ID,
      brand_id: input.brand_id ?? null,
      owner_id: input.owner_id ?? uuid(),
      listing_id: input.listing_id ?? null,
      reference: input.reference || this.nextPropertyReference(),
      property_type: input.property_type ?? 'apartment',
      name: input.name ?? null,
      address_line: input.address_line ?? '',
      municipality: input.municipality ?? '',
      postcode: input.postcode ?? null,
      country: input.country ?? 'ES',
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      has_pool: input.has_pool ?? false,
      has_garden: input.has_garden ?? false,
      access_notes: input.access_notes ?? null,
      status: 'active',
      created_at: nowIso(),
    };
    this.state.properties = [property, ...this.state.properties];
    this.save();
    await this.cloudUpsert('kh_properties', property);
    return property;
  }

  private nextPropertyReference(): string {
    const n = this.state.properties.length + 1;
    return `KH-${String(n).padStart(4, '0')}`;
  }

  // ---- plans ----

  getPlans(): KhPlan[] {
    return this.state.plans;
  }

  // ---- contracts ----

  getContracts(): KhContract[] {
    return this.state.contracts;
  }

  async addContract(input: {
    property_id: string;
    plan_id: string;
    starts_on: string;
    billing_day?: number;
  }): Promise<KhContract> {
    const plan = this.state.plans.find((p) => p.id === input.plan_id);
    const contract: KhContract = {
      id: uuid(),
      org_id: DEMO_ORG_ID,
      property_id: input.property_id,
      plan_id: input.plan_id,
      plan_snapshot: plan ? { ...plan } : {}, // Principle 2 — freeze plan terms
      starts_on: input.starts_on,
      ends_on: null,
      billing_day: input.billing_day ?? 1,
      status: 'active',
      created_at: nowIso(),
    };
    this.state.contracts = [contract, ...this.state.contracts];
    this.save();
    await this.cloudUpsert('kh_contracts', contract);
    return contract;
  }

  // ---- vendors ----

  getVendors(): KhVendor[] {
    return this.state.vendors;
  }

  async addVendor(input: Partial<KhVendor>): Promise<KhVendor> {
    const vendor: KhVendor = {
      id: uuid(),
      org_id: DEMO_ORG_ID,
      company_name: input.company_name ?? '',
      contact_name: input.contact_name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      whatsapp: input.whatsapp ?? null,
      tax_id: input.tax_id ?? null,
      locales: input.locales ?? ['es'],
      preferred_locale: input.preferred_locale ?? 'es',
      service_areas: input.service_areas ?? [],
      is_preferred: input.is_preferred ?? false,
      insurance_expires_on: input.insurance_expires_on ?? null,
      rating: input.rating ?? null,
      notes: input.notes ?? null,
      status: 'active',
      created_at: nowIso(),
    };
    this.state.vendors = [vendor, ...this.state.vendors];
    this.save();
    await this.cloudUpsert('kh_vendors', vendor);
    return vendor;
  }

  /** Vendors whose insurance expires within `days` (or already expired). */
  vendorsWithExpiringInsurance(days = 30): KhVendor[] {
    const cutoff = Date.now() + days * 86_400_000;
    return this.state.vendors.filter(
      (v) => v.insurance_expires_on && new Date(v.insurance_expires_on).getTime() <= cutoff,
    );
  }

  // ---- persistence ----

  private save() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.error('Care: localStorage save failed', e);
    }
    this.notify();
  }

  /** Best-effort mirror to Supabase (care schema); silent no-op in demo mode. */
  private async cloudUpsert(table: string, row: Record<string, unknown>) {
    if (!isCloudConnected) return;
    try {
      // Client-generated ids make this idempotent (upsert on primary key).
      // Care lives in its own `care` schema (add it to API → Exposed schemas).
      await supabase.schema('care').from(table).upsert(row, { onConflict: 'id' });
    } catch (e) {
      console.warn(`Care: cloud upsert to care.${table} failed (staying local)`, e);
    }
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const careStore = new CareService();

/** Format integer cents to a locale-aware currency string. */
export function formatCents(cents: number, currency = 'EUR', locale = 'no'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}
