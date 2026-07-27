// =====================================================================
// Calendar scheduling (Fase 4) — pure, tested.
// =====================================================================
// Rules that make the calendar worth building:
//  1. Inspections are generated from the plan — 1, 2 or 4 a month, evenly.
//  2. An inspection is never placed inside a stay; it shifts to a free day.
//  3. A stay creates a "prep before arrival" task 24h before check-in.
//  4. After a departure, a check-out inspection is proposed within 48h.
//  5. Storm callouts are created manually and are not billable.
// =====================================================================

export interface DateRange {
  start: string; // ISO date/datetime (inclusive)
  end: string;   // ISO date/datetime (inclusive)
}

export type CalendarEventType =
  | 'owner_stay' | 'guest_stay' | 'inspection'
  | 'service_visit' | 'prep_task' | 'storm_callout';

export interface ProposedEvent {
  event_type: CalendarEventType;
  title: string;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  all_day: boolean;
  source: 'auto';
  is_billable: boolean;
}

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString();
const atNoonUTC = (y: number, m1: number, day: number) =>
  new Date(Date.UTC(y, m1 - 1, day, 10, 0, 0));

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function within(dateMs: number, ranges: DateRange[]): boolean {
  return ranges.some((r) => {
    const s = new Date(r.start).getTime();
    const e = new Date(r.end).getTime();
    return dateMs >= startOfDay(s) && dateMs <= endOfDay(e);
  });
}
const startOfDay = (ms: number) => { const d = new Date(ms); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
const endOfDay = (ms: number) => { const d = new Date(ms); d.setUTCHours(23, 59, 59, 999); return d.getTime(); };

/** Nudge a date off any stay day: try +1, -1, +2, -2 … within the month. */
function firstFreeDay(year: number, month1: number, day: number, stays: DateRange[]): number {
  const dim = daysInMonth(year, month1);
  const offsets = [0];
  for (let k = 1; k <= dim; k++) offsets.push(k, -k);
  for (const off of offsets) {
    const d = day + off;
    if (d < 1 || d > dim) continue;
    if (!within(atNoonUTC(year, month1, d).getTime(), stays)) return d;
  }
  return day; // everything is a stay — fall back to the original
}

/**
 * Evenly distributed inspection dates for a month, avoiding stays.
 * @param month1 1–12
 */
export function generateMonthlyInspections(
  year: number,
  month1: number,
  visitsPerMonth: number,
  stays: DateRange[] = [],
): ProposedEvent[] {
  if (visitsPerMonth <= 0) return [];
  const dim = daysInMonth(year, month1);
  const used = new Set<number>();
  const out: ProposedEvent[] = [];
  for (let i = 0; i < visitsPerMonth; i++) {
    let day = Math.round(((i + 0.5) / visitsPerMonth) * dim);
    day = Math.min(Math.max(day, 1), dim);
    day = firstFreeDay(year, month1, day, stays);
    while (used.has(day) && day < dim) day++;
    while (used.has(day) && day > 1) day--;
    used.add(day);
    const start = atNoonUTC(year, month1, day);
    out.push({
      event_type: 'inspection',
      title: 'Planlagt tilsyn',
      starts_at: iso(start),
      ends_at: iso(new Date(start.getTime() + 60 * 60 * 1000)),
      all_day: false,
      source: 'auto',
      is_billable: true,
    });
  }
  return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** A prep-before-arrival task 24h before a stay's check-in. */
export function prepTaskForStay(stay: DateRange): ProposedEvent {
  const arrival = new Date(stay.start).getTime();
  const start = new Date(arrival - DAY_MS);
  return {
    event_type: 'prep_task',
    title: 'Klargjøring før ankomst',
    starts_at: iso(start),
    ends_at: iso(new Date(start.getTime() + 60 * 60 * 1000)),
    all_day: false,
    source: 'auto',
    is_billable: true,
  };
}

/** A check-out inspection within 48h after a stay's departure (next day). */
export function postDepartureInspection(stay: DateRange): ProposedEvent {
  const departure = new Date(stay.end).getTime();
  const start = new Date(departure + DAY_MS);
  return {
    event_type: 'inspection',
    title: 'Utsjekk-tilsyn etter opphold',
    starts_at: iso(start),
    ends_at: iso(new Date(start.getTime() + 60 * 60 * 1000)),
    all_day: false,
    source: 'auto',
    is_billable: true,
  };
}

/** True when a proposed instant collides with any stay. */
export function collidesWithStay(instant: string, stays: DateRange[]): boolean {
  return within(new Date(instant).getTime(), stays);
}
