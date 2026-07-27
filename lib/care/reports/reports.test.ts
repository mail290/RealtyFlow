import { describe, it, expect } from 'vitest';
import { formatReportReference, nextSeq } from './reference';
import { sha256Hex, sha256OfJson, stableStringify } from './contentHash';
import { formatDate, formatNumber, formatCents, localeToBcp47 } from './format';
import { buildReportSnapshot, type SnapshotInputs } from './dataSnapshot';
import type { SnapshotItem } from '../inspections/types';

describe('report reference', () => {
  it('formats KH-R-yy-seq zero-padded', () => {
    expect(formatReportReference(2026, 1)).toBe('KH-R-26-0001');
    expect(formatReportReference(2026, 42)).toBe('KH-R-26-0042');
  });
  it('nextSeq increments from last (or 0)', () => {
    expect(nextSeq(null)).toBe(1);
    expect(nextSeq(7)).toBe(8);
  });
});

describe('content hash', () => {
  it('is stable for identical bytes (criterion 6)', async () => {
    const a = new TextEncoder().encode('same pdf bytes');
    const b = new TextEncoder().encode('same pdf bytes');
    expect(await sha256Hex(a)).toBe(await sha256Hex(b));
  });
  it('differs for different bytes', async () => {
    const a = new TextEncoder().encode('pdf one');
    const b = new TextEncoder().encode('pdf two');
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(b));
  });
  it('produces a 64-char hex digest', async () => {
    const h = await sha256Hex(new TextEncoder().encode('x'));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it('stableStringify sorts keys so snapshot hashing is order-independent', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });
  it('sha256OfJson equal for reordered objects', async () => {
    expect(await sha256OfJson({ b: 1, a: [{ y: 2, x: 1 }] })).toBe(
      await sha256OfJson({ a: [{ x: 1, y: 2 }], b: 1 }),
    );
  });
});

describe('locale formatting (criterion 2)', () => {
  it('formats dates per locale', () => {
    const iso = '2026-03-12T09:00:00Z';
    expect(formatDate(iso, 'nb-NO')).toBe('12.03.2026');
    expect(formatDate(iso, 'de-DE')).toBe('12.03.2026');
    expect(formatDate(iso, 'en-GB')).toBe('12/03/2026');
  });
  it('formats numbers per locale', () => {
    expect(formatNumber(1234.5, 'de-DE')).toBe('1.234,50');
    expect(formatNumber(1234.5, 'nb-NO')).toBe('1 234,50'); // NBSP thousands
  });
  it('formats currency per locale', () => {
    expect(formatCents(123450, 'EUR', 'de-DE')).toContain('1.234,50');
    expect(formatCents(123450, 'EUR', 'en-GB')).toContain('1,234.50');
  });
  it('maps short locale codes to BCP-47 tags', () => {
    expect(localeToBcp47('no')).toBe('nb-NO');
    expect(localeToBcp47('de')).toBe('de-DE');
    expect(localeToBcp47('xx')).toBe('xx');
  });
});

// ---- snapshot builder ----
const items: SnapshotItem[] = [
  { code: 'exterior.facade', sort_order: 2, category: 'ext', requires_photo: false, requires_value: false, value_unit: null, applies_to: ['apartment', 'villa'], is_automatic: false, title: { no: 'Fasade', en: 'Facade', de: 'Fassade' } },
  { code: 'pool.technical', sort_order: 41, category: 'rooms', requires_photo: true, requires_value: false, value_unit: null, applies_to: ['villa'], is_automatic: false, title: { no: 'Basseng', en: 'Pool' } },
];

const baseInput = (): SnapshotInputs => ({
  reference: 'KH-R-26-0001',
  ownerLocale: 'de',
  orgDefaultLocale: 'no',
  orgName: 'Zen Eco Homes',
  property: { name: 'Villa Sol', reference: 'KH-0001', address: 'Calle A, Polop', property_type: 'villa' },
  inspectorName: 'Freddy',
  startedAt: '2026-03-12T08:00:00Z',
  completedAt: '2026-03-12T08:20:00Z',
  gpsStatus: 'ok',
  templateItems: items,
  itemRecords: [
    { item_code: 'exterior.facade', status: 'ok' },
    { item_code: 'pool.technical', status: 'deviation' },
  ],
  meters: [{ meter_type: 'water', reading: 400, unit: 'm3', previous: 100, delta: 300, per_day: 30, is_anomaly: true, anomaly_note: 'leak' }],
  photos: [
    { storage_path: 'kh/o/p/i/a.jpg', item_code: 'exterior.facade' },
    { storage_path: 'kh/o/p/i/b.jpg', item_code: 'pool.technical' },
  ],
  issues: [{ title: { no: 'Basseng uklart' }, severity: 'high', opened_at: '2026-03-12T08:20:00Z', status: 'open' }],
  comment: { no: 'Alt ok bortsett fra basseng', _source: 'no' },
});

describe('buildReportSnapshot', () => {
  it('resolves checklist titles to the owner locale with fallback', () => {
    const s = buildReportSnapshot(baseInput());
    expect(s.checklist.find((c) => c.code === 'exterior.facade')?.title).toBe('Fassade'); // de
    // pool has no de title → falls back to org default (no) → 'Basseng'
    expect(s.checklist.find((c) => c.code === 'pool.technical')?.title).toBe('Basseng');
  });

  it('includes only points visible for the property type', () => {
    const s = buildReportSnapshot(baseInput());
    expect(s.checklist.map((c) => c.code)).toEqual(['exterior.facade', 'pool.technical']);
    const apt = buildReportSnapshot({ ...baseInput(), property: { ...baseInput().property, property_type: 'apartment' } });
    expect(apt.checklist.find((c) => c.code === 'pool.technical')).toBeUndefined();
  });

  it('computes the summary', () => {
    const s = buildReportSnapshot(baseInput());
    expect(s.summary).toMatchObject({ checked: 2, total: 2, deviations: 1, photo_count: 2 });
    expect(s.summary.by_severity.high).toBe(1);
  });

  it('sorts deviation photos first', () => {
    const s = buildReportSnapshot(baseInput());
    expect(s.photos[0].item_code).toBe('pool.technical');
    expect(s.photos[0].is_deviation).toBe(true);
  });

  it('marks the comment as non-source-language for a German owner (written in no)', () => {
    const s = buildReportSnapshot(baseInput());
    expect(s.comment_is_source_language).toBe(false);
    expect(s.comment_source_locale).toBe('no');
    expect(s.comment).toBe('Alt ok bortsett fra basseng');
  });

  it('carries meter anomaly through', () => {
    const s = buildReportSnapshot(baseInput());
    expect(s.meters[0].is_anomaly).toBe(true);
    expect(s.meters[0].per_day).toBe(30);
  });
});
