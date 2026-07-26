import { describe, it, expect } from 'vitest';
import { validateCompletion, visibleItems } from './completion';
import type { SnapshotItem, ItemStatus, MeterType } from './types';

const item = (o: Partial<SnapshotItem> & { code: string; sort_order: number }): SnapshotItem => ({
  category: 'x',
  requires_photo: false,
  requires_value: false,
  value_unit: null,
  applies_to: ['apartment', 'townhouse', 'villa', 'finca'],
  is_automatic: false,
  title: { no: o.code },
  ...o,
});

const items: SnapshotItem[] = [
  item({ code: 'arrival.checkin', sort_order: 1, is_automatic: true }),
  item({ code: 'exterior.facade', sort_order: 2 }),
  item({ code: 'climate.temperature', sort_order: 27, requires_value: true, value_unit: 'C' }),
  item({ code: 'mail.scanned', sort_order: 17, requires_photo: true }),
  item({ code: 'pool.technical', sort_order: 41, applies_to: ['villa', 'finca'], requires_photo: true }),
  item({ code: 'checkout.secure', sort_order: 42, is_automatic: true }),
];

const allOk = (): Record<string, ItemStatus> => ({
  'exterior.facade': 'ok',
  'climate.temperature': 'ok',
  'mail.scanned': 'ok',
  'pool.technical': 'ok',
});

const baseInput = () => ({
  items,
  propertyType: 'villa' as const,
  statuses: allOk(),
  values: { 'climate.temperature': 21 },
  photosByItem: { 'mail.scanned': 1, 'pool.technical': 1 },
  totalPhotos: 14,
  minPhotos: 14,
  metersRecorded: ['water', 'electricity'] as MeterType[],
  comment: 'Alt i orden.',
});

describe('visibleItems', () => {
  it('hides the pool point for apartments entirely', () => {
    const v = visibleItems(items, 'apartment');
    expect(v.find((i) => i.code === 'pool.technical')).toBeUndefined();
  });
  it('shows the pool point for villas', () => {
    const v = visibleItems(items, 'villa');
    expect(v.find((i) => i.code === 'pool.technical')).toBeDefined();
  });
  it('sorts by sort_order', () => {
    const v = visibleItems(items, 'villa');
    expect(v.map((i) => i.sort_order)).toEqual([1, 2, 17, 27, 41, 42]);
  });
});

describe('validateCompletion', () => {
  it('passes a fully completed villa inspection', () => {
    const r = validateCompletion(baseInput());
    expect(r.complete).toBe(true);
    expect(r.problems).toHaveLength(0);
  });

  it('progress ignores automatic points', () => {
    const r = validateCompletion(baseInput());
    // 4 manual points (facade, temp, mail, pool), all done
    expect(r.progress).toEqual({ done: 4, total: 4 });
  });

  it('flags a missing status', () => {
    const inp = baseInput();
    delete inp.statuses['exterior.facade'];
    const r = validateCompletion(inp);
    expect(r.complete).toBe(false);
    expect(r.problems.some((p) => p.code === 'status:exterior.facade')).toBe(true);
  });

  it('treats not_checked as missing', () => {
    const inp = baseInput();
    inp.statuses['exterior.facade'] = 'not_checked';
    const r = validateCompletion(inp);
    expect(r.complete).toBe(false);
  });

  it('requires a value on a requires_value OK point', () => {
    const inp = baseInput();
    inp.values = {};
    const r = validateCompletion(inp);
    expect(r.problems.some((p) => p.code === 'value:climate.temperature')).toBe(true);
  });

  it('requires a photo on a requires_photo OK point', () => {
    const inp = baseInput();
    inp.photosByItem = { 'pool.technical': 1 }; // mail.scanned photo missing
    const r = validateCompletion(inp);
    expect(r.problems.some((p) => p.code === 'photo:mail.scanned')).toBe(true);
  });

  it('does not require value/photo when the point is a deviation, not OK', () => {
    const inp = baseInput();
    inp.statuses['climate.temperature'] = 'deviation';
    inp.statuses['mail.scanned'] = 'deviation';
    inp.values = {};
    inp.photosByItem = { 'pool.technical': 1 };
    const r = validateCompletion(inp);
    expect(r.problems.some((p) => p.code.startsWith('value:'))).toBe(false);
    expect(r.problems.some((p) => p.code === 'photo:mail.scanned')).toBe(false);
  });

  it('enforces min_photos', () => {
    const inp = baseInput();
    inp.totalPhotos = 13;
    const r = { ...validateCompletion({ ...inp, minPhotos: 14 }) };
    expect(r.problems.some((p) => p.code === 'min_photos')).toBe(true);
  });

  it('requires both meters', () => {
    const inp = baseInput();
    inp.metersRecorded = ['water'];
    const r = validateCompletion({ ...inp, minPhotos: 14 });
    expect(r.problems.some((p) => p.code === 'meter:electricity')).toBe(true);
  });

  it('requires a comment', () => {
    const inp = baseInput();
    inp.comment = '   ';
    const r = validateCompletion({ ...inp, minPhotos: 14 });
    expect(r.problems.some((p) => p.code === 'comment')).toBe(true);
  });
});

// note: baseInput omits minPhotos; add it where the default matters
describe('validateCompletion (min_photos default wiring)', () => {
  it('passes with minPhotos supplied', () => {
    const r = validateCompletion({ ...baseInput(), minPhotos: 14 });
    expect(r.complete).toBe(true);
  });
});
