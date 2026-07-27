import { describe, it, expect } from 'vitest';
import {
  generateMonthlyInspections, prepTaskForStay, postDepartureInspection,
  collidesWithStay, type DateRange,
} from './scheduling';

const day = (iso: string) => new Date(iso).getUTCDate();

describe('generateMonthlyInspections', () => {
  it('returns the right count per plan', () => {
    expect(generateMonthlyInspections(2026, 3, 1)).toHaveLength(1);
    expect(generateMonthlyInspections(2026, 3, 2)).toHaveLength(2);
    expect(generateMonthlyInspections(2026, 3, 4)).toHaveLength(4);
    expect(generateMonthlyInspections(2026, 3, 0)).toHaveLength(0);
  });

  it('spreads visits across the month', () => {
    const days = generateMonthlyInspections(2026, 3, 2).map((e) => day(e.starts_at));
    expect(days[0]).toBeLessThan(days[1]);
    expect(days[0]).toBeLessThanOrEqual(16);
    expect(days[1]).toBeGreaterThanOrEqual(16);
  });

  it('never schedules inside a stay', () => {
    // one visit → lands mid-month (day 15/16); block it with a stay
    const stays: DateRange[] = [{ start: '2026-03-14', end: '2026-03-18' }];
    const events = generateMonthlyInspections(2026, 3, 1, stays);
    for (const e of events) expect(collidesWithStay(e.starts_at, stays)).toBe(false);
  });

  it('produces distinct days', () => {
    const days = generateMonthlyInspections(2026, 3, 4).map((e) => day(e.starts_at));
    expect(new Set(days).size).toBe(days.length);
  });
});

describe('prep + post-departure', () => {
  it('prep task is 24h before check-in', () => {
    const stay: DateRange = { start: '2026-07-10T14:00:00Z', end: '2026-07-20T10:00:00Z' };
    const prep = prepTaskForStay(stay);
    expect(prep.event_type).toBe('prep_task');
    expect(new Date(prep.starts_at).toISOString()).toBe('2026-07-09T14:00:00.000Z');
  });

  it('post-departure inspection is within 48h (next day)', () => {
    const stay: DateRange = { start: '2026-07-10T14:00:00Z', end: '2026-07-20T10:00:00Z' };
    const post = postDepartureInspection(stay);
    expect(post.event_type).toBe('inspection');
    const gapH = (new Date(post.starts_at).getTime() - new Date(stay.end).getTime()) / 3_600_000;
    expect(gapH).toBeLessThanOrEqual(48);
  });
});
