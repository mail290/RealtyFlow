// =====================================================================
// Report service — draft → preview → approve & finalise. Browser-only.
// =====================================================================
// Human-in-the-loop (Principle 5): the system never generates and sends in
// one step. A draft can be previewed any number of times; approving freezes
// the data_snapshot, renders the final PDF, computes the content hash, and
// creates the (immutable) report record. Email delivery + the tokened,
// login-free share page need a backend and are stubbed here — see README.
// =====================================================================

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import ReportDocument from '../../components/care/ReportDocument';
import { buildReportSnapshot } from '../../lib/care/reports/dataSnapshot';
import { sha256OfJson } from '../../lib/care/reports/contentHash';
import { formatReportReference, nextSeq } from '../../lib/care/reports/reference';
import type { ReportSnapshot } from '../../lib/care/reports/types';
import { supabase, isCloudConnected } from '../supabase';
import { careStore, DEMO_ORG_ID } from '../careService';
import {
  getInspection,
  getItems,
  getMeterReadings,
  getPhotos,
} from './inspectionDb';

const COUNTER_KEY = 'rf_care_report_counter';
const REPORTS_KEY = 'rf_care_reports';

export interface ReportRecord {
  id: string;
  org_id: string;
  inspection_id: string;
  property_id: string;
  reference: string;
  locale: string;
  content_hash: string;
  version: number;
  status: 'draft' | 'approved' | 'sent' | 'viewed';
  data_snapshot: ReportSnapshot;
  share_url?: string;
  created_at: string;
}

export interface DraftBundle {
  snapshot: ReportSnapshot;
  photoUrls: Record<string, string>;
  /** object URLs to revoke when the preview closes */
  revoke: () => void;
}

/** Build a (not yet numbered) draft snapshot + preview image URLs. */
export async function buildDraft(inspectionId: string, ownerLocale = 'no'): Promise<DraftBundle> {
  const inspection = await getInspection(inspectionId);
  if (!inspection) throw new Error('inspection not found');
  const property = careStore.getProperties().find((p) => p.id === inspection.property_id);
  const items = await getItems(inspectionId);
  const meters = await getMeterReadings(inspectionId);
  const photos = await getPhotos(inspectionId);

  const orgDefault = 'no';
  const snapshot = buildReportSnapshot({
    reference: 'UTKAST',
    ownerLocale,
    orgDefaultLocale: orgDefault,
    orgName: 'Zen Eco Homes',
    property: {
      name: property?.name,
      reference: property?.reference ?? 'KH-0000',
      address: `${property?.address_line ?? ''}, ${property?.municipality ?? ''}`,
      property_type: (property?.property_type ?? 'villa') as never,
    },
    inspectorName: inspection.inspector_id,
    startedAt: inspection.started_at,
    completedAt: inspection.device_completed_at ?? inspection.started_at,
    gpsStatus: inspection.gps_status,
    templateItems: inspection.template_snapshot.items,
    itemRecords: items.map((i) => ({ item_code: i.item_code, status: i.status, value_numeric: i.value_numeric, value_unit: i.value_unit })),
    meters: meters.map((m) => ({
      meter_type: m.meter_type, reading: m.reading, unit: m.unit,
      previous: m.previous_id ? undefined : null, delta: m.delta, per_day: m.per_day,
      is_anomaly: m.is_anomaly, anomaly_note: m.is_anomaly ? 'Forbruk over terskel i ubebodd bolig' : undefined,
    })),
    photos: photos.map((p) => ({ storage_path: p.storage_path, item_code: p.item_code })),
    issues: [],
    comment: inspection.comment ?? null,
    frozenAt: inspection.device_completed_at ?? inspection.started_at, // stable → deterministic hash
  });

  // Resolve preview image URLs (object URLs from local Blobs, or signed URLs).
  const urls: Record<string, string> = {};
  const created: string[] = [];
  for (const p of photos) {
    if (p.blob) {
      const u = URL.createObjectURL(p.blob);
      urls[p.storage_path] = u;
      created.push(u);
    } else if (isCloudConnected) {
      try {
        const { data } = await supabase.storage.from('kh-photos').createSignedUrl(p.storage_path, 600);
        if (data?.signedUrl) urls[p.storage_path] = data.signedUrl;
      } catch { /* leave as placeholder */ }
    }
  }
  return { snapshot, photoUrls: urls, revoke: () => created.forEach((u) => URL.revokeObjectURL(u)) };
}

/** Render a snapshot to a PDF Blob. */
export async function renderPdf(snapshot: ReportSnapshot, contentHash: string, photoUrls: Record<string, string>): Promise<Blob> {
  const element = React.createElement(ReportDocument, { snapshot, contentHash, photoUrls });
  // @react-pdf/renderer accepts a document element here.
  return pdf(element as never).toBlob();
}

function nextReference(): { reference: string; year: number; seq: number } {
  const year = new Date().getFullYear();
  const store = readJson<Record<string, number>>(COUNTER_KEY, {});
  const seq = nextSeq(store[year]);
  store[year] = seq;
  writeJson(COUNTER_KEY, store);
  return { reference: formatReportReference(year, seq), year, seq };
}

/**
 * Approve & finalise: freeze the snapshot with its real reference, compute
 * the content hash over the frozen snapshot (deterministic — same snapshot,
 * same hash, criterion 6), render the final PDF, and persist the record.
 */
export async function approveAndFinalise(
  inspectionId: string,
  ownerLocale = 'no',
): Promise<{ record: ReportRecord; blob: Blob; photoUrls: Record<string, string>; revoke: () => void }> {
  const draft = await buildDraft(inspectionId, ownerLocale);
  const { reference } = nextReference();
  const snapshot: ReportSnapshot = { ...draft.snapshot, reference };

  const contentHash = await sha256OfJson(snapshot);
  const blob = await renderPdf(snapshot, contentHash, draft.photoUrls);

  const inspection = await getInspection(inspectionId);
  const record: ReportRecord = {
    id: crypto.randomUUID(),
    org_id: DEMO_ORG_ID,
    inspection_id: inspectionId,
    property_id: inspection?.property_id ?? '',
    reference,
    locale: ownerLocale,
    content_hash: contentHash,
    version: 1,
    status: 'approved',
    data_snapshot: snapshot,
    // Share page + email need a backend; produce a placeholder link for now.
    share_url: `https://care.zenecohomes.com/r/${reference.toLowerCase()}`,
    created_at: new Date().toISOString(),
  };

  const list = readJson<ReportRecord[]>(REPORTS_KEY, []);
  list.unshift(record);
  writeJson(REPORTS_KEY, list);

  await mirrorReport(record, blob);
  return { record, blob, photoUrls: draft.photoUrls, revoke: draft.revoke };
}

export function listReports(): ReportRecord[] {
  return readJson<ReportRecord[]>(REPORTS_KEY, []);
}

/** Best-effort mirror to care.kh_reports + storage; silent no-op in demo. */
async function mirrorReport(record: ReportRecord, blob: Blob): Promise<void> {
  if (!isCloudConnected) return;
  try {
    const path = `kh/${record.org_id}/${record.property_id}/${record.inspection_id}/${record.reference}.pdf`;
    await supabase.storage.from('kh-photos').upload(path, blob, { contentType: 'application/pdf', upsert: true });
    await supabase.schema('care').from('kh_reports').upsert(
      {
        id: record.id,
        org_id: record.org_id,
        inspection_id: record.inspection_id,
        property_id: record.property_id,
        reference: record.reference,
        locale: record.locale,
        storage_path: path,
        bytes: blob.size,
        content_hash: record.content_hash,
        version: record.version,
        status: record.status,
        data_snapshot: record.data_snapshot,
      },
      { onConflict: 'id' },
    );
  } catch (e) {
    console.warn('Care: report mirror failed (staying local)', e);
  }
}

// ---- tiny localStorage helpers ----
function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore quota */ }
}
