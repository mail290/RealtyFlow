// =====================================================================
// Care operations service — calendar, keys and charges/invoicing.
// Same demo pattern as careService: localStorage + best-effort Supabase
// mirror into the `care` schema.
// =====================================================================

import { supabase, isCloudConnected } from '../supabase';
import { careStore, DEMO_ORG_ID } from '../careService';
import {
  generateMonthlyInspections, prepTaskForStay, postDepartureInspection,
  type ProposedEvent, type DateRange,
} from '../../lib/care/calendar/scheduling';
import { buildICalFeed, type ICalEvent } from '../../lib/care/calendar/ical';
import { buildInvoiceDraft, formatInvoiceReference, type ChargeInput } from '../../lib/care/invoicing/draft';

const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`);
const nowIso = () => new Date().toISOString();

export interface CalendarEvent {
  id: string; org_id: string; property_id: string;
  event_type: ProposedEvent['event_type'];
  title: string; starts_at: string; ends_at: string; all_day: boolean;
  guest_name?: string | null; is_billable: boolean;
  status: 'planned' | 'done' | 'cancelled'; source: 'manual' | 'auto';
}
export interface KeyRecord {
  id: string; org_id: string; property_id: string;
  label: string; storage_location?: string | null; code?: string | null;
  status: 'in_office' | 'with_holder' | 'lost' | 'retired';
}
export interface KeyEvent {
  id: string; org_id: string; key_id: string; property_id: string;
  action: 'checked_out' | 'checked_in'; holder_name?: string | null; reason?: string | null; at: string;
}
export interface ChargeRecord {
  id: string; org_id: string; property_id: string; contract_id?: string | null;
  description: string; quantity: number; unit_cents: number; amount_cents: number;
  currency: string; occurred_on: string; status: 'open' | 'invoiced' | 'void'; invoice_id?: string | null;
}
export interface InvoiceRecord {
  id: string; org_id: string; property_id: string; reference: string;
  period_start: string; period_end: string; status: 'draft' | 'approved' | 'sent' | 'paid' | 'void';
  currency: string; subtotal_cents: number; iva_cents: number; irpf_cents: number; total_cents: number;
  lines: { line_type: string; description: string; amount_cents: number }[];
  created_at: string;
}

interface OpsState {
  events: CalendarEvent[]; keys: KeyRecord[]; keyEvents: KeyEvent[];
  charges: ChargeRecord[]; invoices: InvoiceRecord[]; invoiceCounter: Record<string, number>;
}
const KEY = 'rf_care_ops_v1';

function read(): OpsState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { events: [], keys: [], keyEvents: [], charges: [], invoices: [], invoiceCounter: {} };
}

class OpsService {
  private state: OpsState = read();
  private listeners: (() => void)[] = [];

  private save() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* quota */ }
    this.listeners.forEach((l) => l());
  }
  subscribe(l: () => void) { this.listeners.push(l); return () => { this.listeners = this.listeners.filter((x) => x !== l); }; }

  private async mirror(table: string, row: Record<string, unknown>) {
    if (!isCloudConnected) return;
    try { await supabase.schema('care').from(table).upsert(row, { onConflict: 'id' }); }
    catch (e) { console.warn(`Care ops: mirror ${table} failed`, e); }
  }

  // ---- calendar ----
  getEvents(propertyId?: string) {
    return this.state.events
      .filter((e) => !propertyId || e.property_id === propertyId)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
  async addEvent(input: Partial<CalendarEvent> & { property_id: string; event_type: CalendarEvent['event_type']; starts_at: string; ends_at: string }) {
    const ev: CalendarEvent = {
      id: uuid(), org_id: DEMO_ORG_ID, property_id: input.property_id, event_type: input.event_type,
      title: input.title ?? '', starts_at: input.starts_at, ends_at: input.ends_at, all_day: input.all_day ?? false,
      guest_name: input.guest_name ?? null, is_billable: input.is_billable ?? input.event_type !== 'storm_callout',
      status: 'planned', source: input.source ?? 'manual',
    };
    this.state.events.push(ev);
    // Registering a stay spawns a prep task (24h before) + post-departure inspection.
    if (ev.event_type === 'owner_stay' || ev.event_type === 'guest_stay') {
      const stay: DateRange = { start: ev.starts_at, end: ev.ends_at };
      for (const p of [prepTaskForStay(stay), postDepartureInspection(stay)]) {
        this.state.events.push(this.fromProposed(ev.property_id, p));
      }
    }
    this.save();
    await this.mirror('kh_calendar_events', { id: ev.id, org_id: ev.org_id, property_id: ev.property_id, event_type: ev.event_type, title: ev.title, starts_at: ev.starts_at, ends_at: ev.ends_at, all_day: ev.all_day, guest_name: ev.guest_name, is_billable: ev.is_billable, status: ev.status, source: ev.source });
    return ev;
  }
  private fromProposed(propertyId: string, p: ProposedEvent): CalendarEvent {
    return { id: uuid(), org_id: DEMO_ORG_ID, property_id: propertyId, event_type: p.event_type, title: p.title, starts_at: p.starts_at, ends_at: p.ends_at, all_day: p.all_day, is_billable: p.is_billable, status: 'planned', source: 'auto' };
  }
  /** Auto-generate this month's inspections from the plan, avoiding stays. */
  async autoScheduleMonth(propertyId: string, visitsPerMonth: number, year: number, month1: number) {
    const stays: DateRange[] = this.getEvents(propertyId)
      .filter((e) => e.event_type === 'owner_stay' || e.event_type === 'guest_stay')
      .map((e) => ({ start: e.starts_at, end: e.ends_at }));
    const proposed = generateMonthlyInspections(year, month1, visitsPerMonth, stays);
    const created = proposed.map((p) => this.fromProposed(propertyId, p));
    this.state.events.push(...created);
    this.save();
    return created;
  }
  icalFor(propertyId: string, calendarName: string): string {
    const events: ICalEvent[] = this.getEvents(propertyId).map((e) => ({
      uid: `${e.id}@care.zenecohomes.com`, summary: e.title || e.event_type,
      start: e.starts_at, end: e.ends_at, allDay: e.all_day,
    }));
    return buildICalFeed(calendarName, events);
  }

  // ---- keys ----
  getKeys(propertyId?: string) { return this.state.keys.filter((k) => !propertyId || k.property_id === propertyId); }
  getKeyEvents(keyId: string) { return this.state.keyEvents.filter((e) => e.key_id === keyId).sort((a, b) => b.at.localeCompare(a.at)); }
  async addKey(input: { property_id: string; label: string; storage_location?: string; code?: string }) {
    const k: KeyRecord = { id: uuid(), org_id: DEMO_ORG_ID, property_id: input.property_id, label: input.label, storage_location: input.storage_location ?? null, code: input.code ?? null, status: 'in_office' };
    this.state.keys.push(k); this.save();
    await this.mirror('kh_keys', k);
    return k;
  }
  async logKeyEvent(keyId: string, action: 'checked_out' | 'checked_in', holderName?: string, reason?: string) {
    const key = this.state.keys.find((k) => k.id === keyId);
    if (!key) throw new Error('key not found');
    const ev: KeyEvent = { id: uuid(), org_id: DEMO_ORG_ID, key_id: keyId, property_id: key.property_id, action, holder_name: holderName ?? null, reason: reason ?? null, at: nowIso() };
    this.state.keyEvents.push(ev);
    key.status = action === 'checked_out' ? 'with_holder' : 'in_office';
    this.save();
    await this.mirror('kh_key_events', ev);
    await this.mirror('kh_keys', key);
    return ev;
  }

  // ---- charges & invoicing ----
  getCharges(propertyId?: string) { return this.state.charges.filter((c) => !propertyId || c.property_id === propertyId); }
  getInvoices(propertyId?: string) { return this.state.invoices.filter((i) => !propertyId || i.property_id === propertyId); }
  async addCharge(input: { property_id: string; description: string; quantity: number; unit_cents: number }) {
    const amount = Math.round(input.quantity * input.unit_cents);
    const c: ChargeRecord = { id: uuid(), org_id: DEMO_ORG_ID, property_id: input.property_id, description: input.description, quantity: input.quantity, unit_cents: input.unit_cents, amount_cents: amount, currency: 'EUR', occurred_on: nowIso().slice(0, 10), status: 'open', invoice_id: null };
    this.state.charges.push(c); this.save();
    await this.mirror('kh_charges', c);
    return c;
  }
  /** Build a monthly draft invoice: plan fixed + this property's open charges. */
  async createMonthlyDraft(propertyId: string, planName: string, fixedCents: number, ivaPct = 21, irpfPct = 0) {
    const open = this.getCharges(propertyId).filter((c) => c.status === 'open');
    const charges: ChargeInput[] = open.map((c) => ({ id: c.id, description: c.description, quantity: c.quantity, unit_cents: c.unit_cents, amount_cents: c.amount_cents }));
    const draft = buildInvoiceDraft({ planName, fixedCents, charges, ivaPct, irpfPct });
    const year = new Date().getFullYear();
    const seq = (this.state.invoiceCounter[year] ?? 0) + 1;
    this.state.invoiceCounter[year] = seq;
    const now = new Date();
    const inv: InvoiceRecord = {
      id: uuid(), org_id: DEMO_ORG_ID, property_id: propertyId,
      reference: formatInvoiceReference('INV', year, seq),
      period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
      status: 'draft', currency: draft.currency,
      subtotal_cents: draft.subtotal_cents, iva_cents: draft.iva_cents, irpf_cents: draft.irpf_cents, total_cents: draft.total_cents,
      lines: draft.lines.map((l) => ({ line_type: l.line_type, description: l.description, amount_cents: l.amount_cents })),
      created_at: nowIso(),
    };
    this.state.invoices.unshift(inv);
    for (const c of open) c.status = 'invoiced';
    this.save();
    await this.mirror('kh_invoices', { id: inv.id, org_id: inv.org_id, property_id: inv.property_id, reference: inv.reference, period_start: inv.period_start, period_end: inv.period_end, status: inv.status, currency: inv.currency, fixed_cents: fixedCents, charges_cents: draft.charges_cents, subtotal_cents: inv.subtotal_cents, iva_pct: ivaPct, iva_cents: inv.iva_cents, irpf_pct: irpfPct, irpf_cents: inv.irpf_cents, total_cents: inv.total_cents });
    return inv;
  }
}

export const opsStore = new OpsService();
export { careStore };
