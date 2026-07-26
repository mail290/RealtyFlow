// =====================================================================
// Meter reading + leak detection — the one feature a low-cost competitor
// can't easily copy. Pure, fully tested.
// =====================================================================
// On save:
//  1. find the previous reading for the same property + meter type
//  2. a decreasing value is rejected UNLESS meter_replaced is checked
//     (meters don't count backwards — it's a typo or a swapped meter)
//  3. compute delta, days_elapsed, per_day
//  4. read occupied_in_period from the inspection (manual in this phase)
//  5. unoccupied + per_day over the org threshold → anomaly (+ a high issue)
// =====================================================================

import type { MeterType } from './types';

export interface OrgThresholds {
  /** litres per day in an empty home */
  water: number;
  /** kWh per day in an empty home */
  electricity: number;
  /** optional gas threshold; no anomaly check when absent */
  gas?: number;
}

export interface PreviousReading {
  reading: number;
  read_at: string; // ISO
}

export interface MeterReadingInput {
  meter_type: MeterType;
  reading: number;
  read_at: string; // ISO
  meter_replaced?: boolean;
  /** manual answer for this phase; null/undefined = unknown */
  occupied_in_period?: boolean | null;
}

export interface MeterReadingResult {
  ok: boolean;
  error?: string;
  delta: number | null;
  days_elapsed: number | null;
  per_day: number | null;
  is_anomaly: boolean;
  anomaly_reason?: string;
}

const MS_PER_DAY = 86_400_000;
const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export function validateAndComputeReading(
  input: MeterReadingInput,
  previous: PreviousReading | null,
  thresholds: OrgThresholds,
): MeterReadingResult {
  if (!Number.isFinite(input.reading) || input.reading < 0) {
    return fail('Avlesningen må være et positivt tall.');
  }

  // No history yet → store the baseline, nothing to compare.
  if (!previous) {
    return {
      ok: true,
      delta: null,
      days_elapsed: null,
      per_day: null,
      is_anomaly: false,
    };
  }

  // Meter swapped: don't compare across the swap, just accept the baseline.
  if (input.meter_replaced) {
    return {
      ok: true,
      delta: null,
      days_elapsed: null,
      per_day: null,
      is_anomaly: false,
    };
  }

  // Decreasing value without a meter swap is rejected.
  if (input.reading < previous.reading) {
    return fail(
      `Ny avlesning (${input.reading}) er lavere enn forrige (${previous.reading}). ` +
        'Målere teller ikke bakover — kryss av for «måler byttet» hvis den er skiftet.',
    );
  }

  const days = (new Date(input.read_at).getTime() - new Date(previous.read_at).getTime()) / MS_PER_DAY;
  const delta = round(input.reading - previous.reading, 3);

  // Same-instant or out-of-order timestamps: keep delta, skip per-day.
  if (!(days > 0)) {
    return { ok: true, delta, days_elapsed: null, per_day: null, is_anomaly: false };
  }

  const days_elapsed = round(days, 2);
  const per_day = round(delta / days, 4);

  const threshold = thresholds[input.meter_type];
  const unoccupied = input.occupied_in_period === false;
  let is_anomaly = false;
  let anomaly_reason: string | undefined;
  if (unoccupied && threshold != null && per_day > threshold) {
    is_anomaly = true;
    anomaly_reason =
      `Forbruk ${per_day}/døgn i ubebodd bolig, forventet under ${threshold}.`;
  }

  return { ok: true, delta, days_elapsed, per_day, is_anomaly, anomaly_reason };
}

function fail(error: string): MeterReadingResult {
  return {
    ok: false,
    error,
    delta: null,
    days_elapsed: null,
    per_day: null,
    is_anomaly: false,
  };
}
