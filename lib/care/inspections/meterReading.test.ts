import { describe, it, expect } from 'vitest';
import { validateAndComputeReading, type OrgThresholds } from './meterReading';

const thresholds: OrgThresholds = { water: 20, electricity: 3 };
const prev = (reading: number, read_at: string) => ({ reading, read_at });

describe('validateAndComputeReading', () => {
  it('accepts the first reading with no history (baseline)', () => {
    const r = validateAndComputeReading(
      { meter_type: 'water', reading: 100, read_at: '2026-01-01T00:00:00Z' },
      null,
      thresholds,
    );
    expect(r.ok).toBe(true);
    expect(r.delta).toBeNull();
    expect(r.per_day).toBeNull();
    expect(r.is_anomaly).toBe(false);
  });

  it('rejects a decreasing reading without meter_replaced', () => {
    const r = validateAndComputeReading(
      { meter_type: 'water', reading: 90, read_at: '2026-02-01T00:00:00Z' },
      prev(100, '2026-01-01T00:00:00Z'),
      thresholds,
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/lavere enn forrige/);
  });

  it('accepts a decreasing reading when meter_replaced is set (baseline reset)', () => {
    const r = validateAndComputeReading(
      { meter_type: 'water', reading: 5, read_at: '2026-02-01T00:00:00Z', meter_replaced: true },
      prev(100, '2026-01-01T00:00:00Z'),
      thresholds,
    );
    expect(r.ok).toBe(true);
    expect(r.delta).toBeNull();
    expect(r.is_anomaly).toBe(false);
  });

  it('computes delta, days_elapsed and per_day', () => {
    const r = validateAndComputeReading(
      { meter_type: 'water', reading: 110, read_at: '2026-01-11T00:00:00Z' },
      prev(100, '2026-01-01T00:00:00Z'),
      thresholds,
    );
    expect(r.delta).toBe(10);
    expect(r.days_elapsed).toBe(10);
    expect(r.per_day).toBe(1);
    expect(r.is_anomaly).toBe(false);
  });

  it('flags a water anomaly: >20 l/day in an unoccupied home', () => {
    // 300 litres over 10 days = 30/day > 20 threshold
    const r = validateAndComputeReading(
      {
        meter_type: 'water',
        reading: 400,
        read_at: '2026-01-11T00:00:00Z',
        occupied_in_period: false,
      },
      prev(100, '2026-01-01T00:00:00Z'),
      thresholds,
    );
    expect(r.per_day).toBe(30);
    expect(r.is_anomaly).toBe(true);
    expect(r.anomaly_reason).toMatch(/ubebodd/);
  });

  it('does NOT flag an anomaly when the home was occupied', () => {
    const r = validateAndComputeReading(
      {
        meter_type: 'water',
        reading: 400,
        read_at: '2026-01-11T00:00:00Z',
        occupied_in_period: true,
      },
      prev(100, '2026-01-01T00:00:00Z'),
      thresholds,
    );
    expect(r.is_anomaly).toBe(false);
  });

  it('does NOT flag when occupancy is unknown (null)', () => {
    const r = validateAndComputeReading(
      { meter_type: 'water', reading: 400, read_at: '2026-01-11T00:00:00Z', occupied_in_period: null },
      prev(100, '2026-01-01T00:00:00Z'),
      thresholds,
    );
    expect(r.is_anomaly).toBe(false);
  });

  it('uses the electricity threshold for electricity meters', () => {
    // 40 kWh over 10 days = 4/day > 3 threshold
    const r = validateAndComputeReading(
      { meter_type: 'electricity', reading: 140, read_at: '2026-01-11T00:00:00Z', occupied_in_period: false },
      prev(100, '2026-01-01T00:00:00Z'),
      thresholds,
    );
    expect(r.per_day).toBe(4);
    expect(r.is_anomaly).toBe(true);
  });

  it('never flags gas when no gas threshold is configured', () => {
    const r = validateAndComputeReading(
      { meter_type: 'gas', reading: 1000, read_at: '2026-01-11T00:00:00Z', occupied_in_period: false },
      prev(100, '2026-01-01T00:00:00Z'),
      thresholds,
    );
    expect(r.is_anomaly).toBe(false);
  });

  it('keeps delta but skips per_day for same-instant timestamps', () => {
    const r = validateAndComputeReading(
      { meter_type: 'water', reading: 110, read_at: '2026-01-01T00:00:00Z', occupied_in_period: false },
      prev(100, '2026-01-01T00:00:00Z'),
      thresholds,
    );
    expect(r.delta).toBe(10);
    expect(r.per_day).toBeNull();
    expect(r.is_anomaly).toBe(false);
  });

  it('rejects a negative reading', () => {
    const r = validateAndComputeReading(
      { meter_type: 'water', reading: -5, read_at: '2026-01-11T00:00:00Z' },
      null,
      thresholds,
    );
    expect(r.ok).toBe(false);
  });
});
