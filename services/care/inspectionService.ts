// =====================================================================
// Inspection orchestration — ties the offline store, pure logic, photo
// and GPS helpers together for the UI. Browser-only.
// =====================================================================

import checklistItems from '../../lib/care/data/checklist.json';
import { buildTemplateSnapshot } from '../../lib/care/inspections/templateSnapshot';
import {
  validateAndComputeReading,
  type OrgThresholds,
} from '../../lib/care/inspections/meterReading';
import { validateCompletion } from '../../lib/care/inspections/completion';
import { suggestIssues, type DeviationInput } from '../../lib/care/inspections/issues';
import type {
  ItemStatus,
  MeterType,
  PropertyType,
  TemplateSnapshot,
} from '../../lib/care/inspections/types';
import { DEMO_ORG_ID } from '../careService';
import { authStore } from '../authService';
import { capturePosition } from './geo';
import { compressPhoto, photoStoragePath } from './photo';
import {
  putInspection,
  getInspection,
  putItem,
  getItems,
  putMeterReading,
  getMeterReadings,
  getLatestMeterReading,
  putPhoto,
  getPhotos,
  enqueueFullSync,
  type InspectionDraft,
  type MeterReadingRecord,
} from './inspectionDb';

const DEFAULT_THRESHOLDS: OrgThresholds = { water: 20, electricity: 3 };
const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

/** Build the standard 42-point snapshot from the seeded checklist. */
export function standardTemplateSnapshot(): TemplateSnapshot {
  return buildTemplateSnapshot(
    {
      template_id: 'standard-v1',
      code: 'standard',
      version: 1,
      name: 'Standard 42-punkts tilsyn',
      min_photos: 14,
      property_types: ['apartment', 'townhouse', 'villa', 'finca'],
    },
    checklistItems.map((i) => ({
      code: i.code,
      sort_order: i.sort_order,
      category: i.category,
      requires_photo: i.requires_photo,
      requires_value: i.requires_value,
      value_unit: i.value_unit,
      applies_to: i.applies_to as PropertyType[],
      is_automatic: i.is_automatic,
      title: i.title as Record<string, string>,
    })),
  );
}

export interface StartInspectionInput {
  property_id: string;
  property_type: PropertyType;
  contract_id?: string | null;
  kind?: string;
}

/** Start an inspection: freeze the template, stamp check-in GPS, persist. */
export async function startInspection(input: StartInspectionInput): Promise<InspectionDraft> {
  const gps = await capturePosition();
  const draft: InspectionDraft = {
    id: uuid(),
    org_id: DEMO_ORG_ID,
    property_id: input.property_id,
    contract_id: input.contract_id ?? null,
    template_id: 'standard-v1',
    template_snapshot: standardTemplateSnapshot(),
    inspector_id: authStore.getUserEmail() ?? 'inspector',
    kind: input.kind ?? 'scheduled',
    is_billable: input.kind !== 'storm',
    status: 'draft',
    started_at: nowIso(),
    start_lat: gps.lat,
    start_lng: gps.lng,
    start_accuracy_m: gps.accuracy_m,
    gps_status: gps.status,
    occupied_in_period: null,
    comment: null,
    photo_count: 0,
  };
  await putInspection(draft);
  // The automatic check-in point (item 1) is filled by the system.
  await recordItem(draft.id, 'arrival.checkin', 'ok');
  return draft;
}

export async function recordItem(
  inspectionId: string,
  itemCode: string,
  status: ItemStatus,
  extra: { value_numeric?: number | null; value_unit?: string | null; note?: Record<string, string> | null } = {},
): Promise<void> {
  const existing = (await getItems(inspectionId)).find((i) => i.item_code === itemCode);
  await putItem({
    id: existing?.id ?? uuid(),
    org_id: DEMO_ORG_ID,
    inspection_id: inspectionId,
    item_code: itemCode,
    status,
    value_numeric: extra.value_numeric ?? null,
    value_unit: extra.value_unit ?? null,
    note: extra.note ?? null,
    recorded_at: nowIso(),
  });
}

export interface RecordMeterInput {
  inspectionId: string;
  propertyId: string;
  meterType: MeterType;
  reading: number;
  unit: string;
  meterReplaced?: boolean;
  occupiedInPeriod?: boolean | null;
  thresholds?: OrgThresholds;
}

export interface RecordMeterResult {
  ok: boolean;
  error?: string;
  reading?: MeterReadingRecord;
  previous?: MeterReadingRecord | null;
  isAnomaly?: boolean;
  anomalyReason?: string;
}

/** Validate against the previous reading, compute rates, flag leaks. */
export async function recordMeterReading(input: RecordMeterInput): Promise<RecordMeterResult> {
  const previous = await getLatestMeterReading(input.propertyId, input.meterType, input.inspectionId);
  const readAt = nowIso();
  const result = validateAndComputeReading(
    {
      meter_type: input.meterType,
      reading: input.reading,
      read_at: readAt,
      meter_replaced: input.meterReplaced,
      occupied_in_period: input.occupiedInPeriod ?? null,
    },
    previous ? { reading: previous.reading, read_at: previous.read_at } : null,
    input.thresholds ?? DEFAULT_THRESHOLDS,
  );
  if (!result.ok) return { ok: false, error: result.error, previous };

  const record: MeterReadingRecord = {
    id: uuid(),
    org_id: DEMO_ORG_ID,
    property_id: input.propertyId,
    inspection_id: input.inspectionId,
    meter_type: input.meterType,
    reading: input.reading,
    unit: input.unit,
    read_at: readAt,
    previous_id: previous?.id ?? null,
    delta: result.delta,
    days_elapsed: result.days_elapsed,
    per_day: result.per_day,
    is_anomaly: result.is_anomaly,
    meter_replaced: !!input.meterReplaced,
  };
  await putMeterReading(record);
  return {
    ok: true,
    reading: record,
    previous,
    isAnomaly: result.is_anomaly,
    anomalyReason: result.anomaly_reason,
  };
}

export async function getPreviousMeter(
  propertyId: string,
  meterType: MeterType,
  inspectionId: string,
): Promise<MeterReadingRecord | null> {
  return getLatestMeterReading(propertyId, meterType, inspectionId);
}

/** Compress, store in IndexedDB, bump the inspection photo count. */
export async function addPhoto(
  inspectionId: string,
  propertyId: string,
  file: File | Blob,
  itemCode?: string,
): Promise<void> {
  const inspection = await getInspection(inspectionId);
  if (!inspection) throw new Error('inspection not found');
  const compressed = await compressPhoto(file);
  const photoId = uuid();
  const existing = await getPhotos(inspectionId);
  await putPhoto({
    id: photoId,
    org_id: DEMO_ORG_ID,
    inspection_id: inspectionId,
    property_id: propertyId,
    item_code: itemCode ?? null,
    blob: compressed.blob,
    storage_path: photoStoragePath(DEMO_ORG_ID, propertyId, inspectionId, photoId),
    width: compressed.width,
    height: compressed.height,
    bytes: compressed.bytes,
    taken_at: nowIso(),
    sort_order: existing.length,
    uploaded: false,
  });
  inspection.photo_count = existing.length + 1;
  await putInspection(inspection);
}

export interface CompletionCheck {
  complete: boolean;
  problems: { code: string; message: string }[];
  progress: { done: number; total: number };
}

export async function checkCompletion(
  inspectionId: string,
  propertyType: PropertyType,
  comment: string,
): Promise<CompletionCheck> {
  const inspection = await getInspection(inspectionId);
  if (!inspection) throw new Error('inspection not found');
  const items = await getItems(inspectionId);
  const photos = await getPhotos(inspectionId);
  const meters = await getMeterReadings(inspectionId);

  const statuses: Record<string, ItemStatus> = {};
  const values: Record<string, number | null> = {};
  for (const i of items) {
    statuses[i.item_code] = i.status;
    if (i.value_numeric != null) values[i.item_code] = i.value_numeric;
  }
  const photosByItem: Record<string, number> = {};
  for (const p of photos) if (p.item_code) photosByItem[p.item_code] = (photosByItem[p.item_code] ?? 0) + 1;

  return validateCompletion({
    items: inspection.template_snapshot.items,
    propertyType,
    statuses,
    values,
    photosByItem,
    totalPhotos: photos.length,
    minPhotos: inspection.template_snapshot.min_photos,
    metersRecorded: Array.from(new Set(meters.map((m) => m.meter_type))),
    comment,
  });
}

/** Finalise: fill the automatic check-out point, stamp GPS, enqueue sync. */
export async function completeInspection(
  inspectionId: string,
  comment: string,
): Promise<{ deviations: DeviationInput[] }> {
  const inspection = await getInspection(inspectionId);
  if (!inspection) throw new Error('inspection not found');

  const gps = await capturePosition();
  await recordItem(inspectionId, 'checkout.secure', 'ok');

  inspection.end_lat = gps.lat;
  inspection.end_lng = gps.lng;
  if (gps.status !== 'ok' && inspection.gps_status === 'ok') inspection.gps_status = gps.status;
  inspection.comment = { [inspection.template_snapshot.locales[0] ?? 'no']: comment, _source: 'no' } as Record<string, string>;
  inspection.device_completed_at = nowIso();
  inspection.status = 'completed';
  await putInspection(inspection);

  await enqueueFullSync(inspectionId, Date.now());

  // Surface deviation points so the UI can offer issue suggestions.
  const items = await getItems(inspectionId);
  const byCode = new Map(inspection.template_snapshot.items.map((i) => [i.code, i]));
  const deviations: DeviationInput[] = items
    .filter((i) => i.status === 'deviation')
    .map((i) => ({
      item_code: i.item_code,
      title: byCode.get(i.item_code)?.title?.no ?? i.item_code,
      note: i.note ?? null,
    }));
  return { deviations };
}

export { suggestIssues };
