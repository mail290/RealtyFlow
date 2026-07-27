// =====================================================================
// Completion rules + visible-item filtering. Pure, tested.
// =====================================================================
// A point that does not apply to the property type is not shown at all
// (not as "not applicable" — gone). Completion requires: every visible
// point has a real status, at least min_photos photos exist, both meter
// readings are registered, and a free-text comment is present.
// =====================================================================

import type { ItemStatus, MeterType, PropertyType, SnapshotItem } from './types';

/** Points that apply to this property type, in walkthrough order. */
export function visibleItems(items: SnapshotItem[], propertyType: PropertyType): SnapshotItem[] {
  return items
    .filter((i) => i.applies_to.includes(propertyType))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export interface CompletionInput {
  items: SnapshotItem[];
  propertyType: PropertyType;
  /** item_code -> recorded status */
  statuses: Record<string, ItemStatus | undefined>;
  /** item_code -> numeric value (for requires_value points) */
  values?: Record<string, number | null | undefined>;
  /** item_code -> number of photos attached */
  photosByItem?: Record<string, number | undefined>;
  totalPhotos: number;
  minPhotos: number;
  metersRecorded: MeterType[];
  requiredMeters?: MeterType[]; // defaults to water + electricity
  comment?: string;
}

export interface CompletionResult {
  complete: boolean;
  /** machine-readable reasons, each with a human message */
  problems: { code: string; message: string }[];
  progress: { done: number; total: number };
}

const AUTOMATIC = new Set(['arrival.checkin', 'checkout.secure']);

export function validateCompletion(input: CompletionInput): CompletionResult {
  const visible = visibleItems(input.items, input.propertyType);
  const required = input.requiredMeters ?? (['water', 'electricity'] as MeterType[]);
  const problems: CompletionResult['problems'] = [];

  // Progress counts manual points that have a real (non-not_checked) status.
  const manual = visible.filter((i) => !AUTOMATIC.has(i.code));
  const isDecided = (s?: ItemStatus) => !!s && s !== 'not_checked';
  const doneCount = manual.filter((i) => isDecided(input.statuses[i.code])).length;

  for (const item of manual) {
    const status = input.statuses[item.code];
    if (!isDecided(status)) {
      problems.push({ code: `status:${item.code}`, message: `Punkt ${item.sort_order} mangler status.` });
      continue;
    }
    // requires_value: an OK point must carry a numeric value.
    if (item.requires_value && status === 'ok') {
      const v = input.values?.[item.code];
      if (v == null || !Number.isFinite(v)) {
        problems.push({ code: `value:${item.code}`, message: `Punkt ${item.sort_order} krever en verdi.` });
      }
    }
    // requires_photo: cannot be OK without a photo.
    if (item.requires_photo && status === 'ok') {
      const n = input.photosByItem?.[item.code] ?? 0;
      if (n < 1) {
        problems.push({ code: `photo:${item.code}`, message: `Punkt ${item.sort_order} krever et bilde.` });
      }
    }
  }

  if (input.totalPhotos < input.minPhotos) {
    problems.push({
      code: 'min_photos',
      message: `Minst ${input.minPhotos} bilder kreves (${input.totalPhotos} tatt).`,
    });
  }

  for (const m of required) {
    if (!input.metersRecorded.includes(m)) {
      problems.push({ code: `meter:${m}`, message: `Måleravlesning mangler: ${m}.` });
    }
  }

  if (!input.comment || input.comment.trim() === '') {
    problems.push({ code: 'comment', message: 'Fritekstkommentar mangler.' });
  }

  return {
    complete: problems.length === 0,
    problems,
    progress: { done: doneCount, total: manual.length },
  };
}
