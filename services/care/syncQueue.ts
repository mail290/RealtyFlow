// =====================================================================
// Sync engine — drains the offline queue to Supabase, FIFO, with backoff.
// =====================================================================
// Sync order per inspection: inspection → items → meter_readings → photos
// → mark completed. Photos last because they are heaviest; metadata should
// land on the server even if the images lag. Every write is an upsert on
// the client-generated id, so a retry after a mid-transfer failure writes
// the same row — no duplicates. There is no conflict resolution: one
// inspector owns one inspection.
// =====================================================================

import { supabase, isCloudConnected } from '../supabase';
import { nextAttemptAt } from '../../lib/care/inspections/backoff';
import {
  readyQueue,
  queueLength,
  updateQueueEntry,
  removeQueueEntry,
  getInspection,
  getItems,
  getMeterReadings,
  getPhotos,
  markPhotoUploaded,
  type QueueEntry,
  type StoredPhoto,
} from './inspectionDb';

const PHOTO_BUCKET = 'kh-photos';
const care = () => supabase.schema('care');

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** Process every ready queue entry once. Safe to call repeatedly. */
export async function drainQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (!isCloudConnected) return; // demo mode: keep everything queued
    const ready = await readyQueue();
    for (const entry of ready) {
      try {
        await runStage(entry);
        await removeQueueEntry(entry.id);
      } catch (err) {
        const attempts = entry.attempts + 1;
        const updated: QueueEntry = {
          ...entry,
          attempts,
          next_attempt_at: nextAttemptAt(attempts),
        };
        await updateQueueEntry(updated);
        console.warn(`Care sync: ${entry.id} failed (attempt ${attempts})`, err);
        // Stop this pass at the first failure to preserve FIFO ordering.
        break;
      }
    }
  } finally {
    running = false;
  }
}

async function runStage(entry: QueueEntry): Promise<void> {
  const inspection = await getInspection(entry.inspection_id);
  if (!inspection) return; // nothing to sync

  switch (entry.stage) {
    case 'inspection': {
      const { template_snapshot, ...rest } = inspection;
      const { error } = await care()
        .from('kh_inspections')
        .upsert({ ...rest, template_snapshot }, { onConflict: 'id' });
      if (error) throw error;
      return;
    }
    case 'items': {
      const items = await getItems(entry.inspection_id);
      if (items.length === 0) return;
      const { error } = await care().from('kh_inspection_items').upsert(
        items.map((i) => ({
          id: i.id,
          org_id: i.org_id,
          inspection_id: i.inspection_id,
          item_code: i.item_code,
          status: i.status,
          value_numeric: i.value_numeric ?? null,
          value_unit: i.value_unit ?? null,
          note: i.note ?? null,
          recorded_at: i.recorded_at,
        })),
        { onConflict: 'id' },
      );
      if (error) throw error;
      return;
    }
    case 'meters': {
      const meters = await getMeterReadings(entry.inspection_id);
      if (meters.length === 0) return;
      const { error } = await care().from('kh_meter_readings').upsert(meters, { onConflict: 'id' });
      if (error) throw error;
      return;
    }
    case 'photos': {
      const photos = await getPhotos(entry.inspection_id);
      for (const p of photos) {
        if (p.uploaded) continue;
        await uploadPhoto(p);
      }
      return;
    }
    case 'complete': {
      // Server stamps completed_at from now(); we only flip the status.
      const { error } = await care()
        .from('kh_inspections')
        .update({ status: 'synced', synced_at: new Date().toISOString() })
        .eq('id', entry.inspection_id);
      if (error) throw error;
      return;
    }
  }
}

async function uploadPhoto(p: StoredPhoto): Promise<void> {
  if (!p.blob) {
    // Blob already dropped — treat as uploaded metadata only.
    return;
  }
  const up = await supabase.storage.from(PHOTO_BUCKET).upload(p.storage_path, p.blob, {
    contentType: 'image/jpeg',
    upsert: true, // idempotent: re-upload to the same path overwrites
  });
  if (up.error) throw up.error;

  const { error } = await care().from('kh_photos').upsert(
    {
      id: p.id,
      org_id: p.org_id,
      inspection_id: p.inspection_id,
      item_code: p.item_code ?? null,
      storage_path: p.storage_path,
      width: p.width ?? null,
      height: p.height ?? null,
      bytes: p.bytes,
      taken_at: p.taken_at,
      sort_order: p.sort_order,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;

  // Only drop the local Blob once BOTH the file and the row are confirmed.
  await markPhotoUploaded(p.id);
}

/**
 * Start background syncing: on the `online` event, at startup, and every
 * 30 s while the queue is not empty.
 */
export function startSync(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void drainQueue());
  void drainQueue();
  if (!timer) {
    timer = setInterval(async () => {
      if ((await queueLength()) > 0) void drainQueue();
    }, 30_000);
  }
}

export function stopSync(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
