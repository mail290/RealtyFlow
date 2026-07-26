// =====================================================================
// Offline store for inspections — IndexedDB via `idb`.
// =====================================================================
// Stores: inspections, items, photos (with Blob), meter_readings, queue.
// Everything an inspection produces lives here first, so a full round can
// be done in airplane mode and survive an app restart. All ids are
// client-generated (crypto.randomUUID) which makes the later sync
// idempotent (upsert on the primary key).
// =====================================================================

import { openDB, type IDBPDatabase } from 'idb';
import type {
  GpsStatus,
  InspectionItemRecord,
  InspectionStatus,
  MeterType,
  TemplateSnapshot,
} from '../../lib/care/inspections/types';

const DB_NAME = 'care-inspections';
const DB_VERSION = 1;

export interface InspectionDraft {
  id: string;
  org_id: string;
  property_id: string;
  contract_id?: string | null;
  template_id: string;
  template_snapshot: TemplateSnapshot;
  inspector_id: string;
  kind: string;
  is_billable: boolean;
  status: InspectionStatus;
  started_at: string;
  device_completed_at?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  start_accuracy_m?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  gps_status: GpsStatus;
  occupied_in_period?: boolean | null;
  comment?: Record<string, string> | null;
  photo_count: number;
}

export interface MeterReadingRecord {
  id: string;
  org_id: string;
  property_id: string;
  inspection_id: string;
  meter_type: MeterType;
  reading: number;
  unit: string;
  read_at: string;
  previous_id?: string | null;
  delta?: number | null;
  days_elapsed?: number | null;
  per_day?: number | null;
  is_anomaly: boolean;
  meter_replaced: boolean;
}

export interface StoredPhoto {
  id: string;
  org_id: string;
  inspection_id: string;
  property_id: string;
  item_code?: string | null;
  blob?: Blob; // dropped once uploaded
  storage_path: string;
  width?: number;
  height?: number;
  bytes: number;
  taken_at: string;
  sort_order: number;
  uploaded: boolean;
}

export type SyncStage = 'inspection' | 'items' | 'meters' | 'photos' | 'complete';

export interface QueueEntry {
  id: string; // `${inspection_id}:${stage}` — dedupes retries
  inspection_id: string;
  stage: SyncStage;
  seq: number; // FIFO ordering
  attempts: number;
  next_attempt_at: number; // epoch ms
  created_at: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('inspections')) {
          database.createObjectStore('inspections', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('items')) {
          const s = database.createObjectStore('items', { keyPath: 'id' });
          s.createIndex('by_inspection', 'inspection_id');
        }
        if (!database.objectStoreNames.contains('photos')) {
          const s = database.createObjectStore('photos', { keyPath: 'id' });
          s.createIndex('by_inspection', 'inspection_id');
        }
        if (!database.objectStoreNames.contains('meter_readings')) {
          const s = database.createObjectStore('meter_readings', { keyPath: 'id' });
          s.createIndex('by_inspection', 'inspection_id');
        }
        if (!database.objectStoreNames.contains('queue')) {
          const s = database.createObjectStore('queue', { keyPath: 'id' });
          s.createIndex('by_seq', 'seq');
        }
      },
    });
  }
  return dbPromise;
}

// ---- inspections ----
export async function putInspection(i: InspectionDraft): Promise<void> {
  await (await db()).put('inspections', i);
}
export async function getInspection(id: string): Promise<InspectionDraft | undefined> {
  return (await db()).get('inspections', id);
}
export async function listInspections(): Promise<InspectionDraft[]> {
  return (await db()).getAll('inspections');
}

// ---- items ----
export async function putItem(item: InspectionItemRecord & { org_id: string }): Promise<void> {
  await (await db()).put('items', item);
}
export async function getItems(inspectionId: string): Promise<(InspectionItemRecord & { org_id: string })[]> {
  return (await db()).getAllFromIndex('items', 'by_inspection', inspectionId);
}

// ---- meter readings ----
export async function putMeterReading(m: MeterReadingRecord): Promise<void> {
  await (await db()).put('meter_readings', m);
}
export async function getMeterReadings(inspectionId: string): Promise<MeterReadingRecord[]> {
  return (await db()).getAllFromIndex('meter_readings', 'by_inspection', inspectionId);
}
/** Latest reading for a property + meter type (offline history for leak checks). */
export async function getLatestMeterReading(
  propertyId: string,
  meterType: MeterType,
  excludeInspectionId?: string,
): Promise<MeterReadingRecord | null> {
  const all = (await (await db()).getAll('meter_readings')) as MeterReadingRecord[];
  const matches = all
    .filter(
      (m) =>
        m.property_id === propertyId &&
        m.meter_type === meterType &&
        m.inspection_id !== excludeInspectionId,
    )
    .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime());
  return matches[0] ?? null;
}

// ---- photos ----
export async function putPhoto(p: StoredPhoto): Promise<void> {
  await (await db()).put('photos', p);
}
export async function getPhotos(inspectionId: string): Promise<StoredPhoto[]> {
  return (await db()).getAllFromIndex('photos', 'by_inspection', inspectionId);
}
/** Drop the Blob once the upload is confirmed, keep the metadata row. */
export async function markPhotoUploaded(id: string): Promise<void> {
  const d = await db();
  const p = (await d.get('photos', id)) as StoredPhoto | undefined;
  if (!p) return;
  delete p.blob;
  p.uploaded = true;
  await d.put('photos', p);
}

// ---- queue ----
export async function enqueue(inspectionId: string, stage: SyncStage, seq: number): Promise<void> {
  const entry: QueueEntry = {
    id: `${inspectionId}:${stage}`,
    inspection_id: inspectionId,
    stage,
    seq,
    attempts: 0,
    next_attempt_at: Date.now(),
    created_at: Date.now(),
  };
  await (await db()).put('queue', entry); // put = idempotent per (inspection,stage)
}
export async function enqueueFullSync(inspectionId: string, baseSeq: number): Promise<void> {
  const stages: SyncStage[] = ['inspection', 'items', 'meters', 'photos', 'complete'];
  for (let i = 0; i < stages.length; i++) await enqueue(inspectionId, stages[i], baseSeq + i);
}
export async function readyQueue(now = Date.now()): Promise<QueueEntry[]> {
  const all = (await (await db()).getAllFromIndex('queue', 'by_seq')) as QueueEntry[];
  return all.filter((e) => e.next_attempt_at <= now).sort((a, b) => a.seq - b.seq);
}
export async function queueLength(): Promise<number> {
  return (await db()).count('queue');
}
export async function updateQueueEntry(entry: QueueEntry): Promise<void> {
  await (await db()).put('queue', entry);
}
export async function removeQueueEntry(id: string): Promise<void> {
  await (await db()).delete('queue', id);
}
