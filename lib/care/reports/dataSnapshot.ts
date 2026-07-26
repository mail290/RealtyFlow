// =====================================================================
// buildReportSnapshot — freezes a finished inspection into everything the
// report needs, resolved to the OWNER's locale (Principle 3). Pure.
// =====================================================================

import { resolveTranslation } from '../i18n/resolveTranslation';
import { visibleItems } from '../inspections/completion';
import type {
  ItemStatus,
  MeterType,
  PropertyType,
  SnapshotItem,
} from '../inspections/types';
import type {
  ReportSnapshot,
  ReportChecklistRow,
  ReportMeterRow,
  ReportPhotoRef,
  ReportIssueRow,
} from './types';

export interface SnapshotInputs {
  reference: string;
  ownerLocale: string;
  orgDefaultLocale: string;
  orgName: string;
  brandName?: string | null;
  property: {
    name?: string | null;
    reference: string;
    address: string;
    property_type: PropertyType;
  };
  inspectorName: string;
  startedAt: string;
  completedAt: string;
  timezone?: string;
  gpsStatus: ReportSnapshot['gps_status'];
  nextInspectionAt?: string | null;

  templateItems: SnapshotItem[];
  itemRecords: { item_code: string; status: ItemStatus; value_numeric?: number | null; value_unit?: string | null }[];
  meters: {
    meter_type: MeterType;
    reading: number;
    unit: string;
    previous?: number | null;
    delta?: number | null;
    per_day?: number | null;
    is_anomaly?: boolean;
    anomaly_note?: string;
  }[];
  photos: { storage_path: string; item_code?: string | null; caption?: Record<string, string> | null }[];
  issues: {
    title: Record<string, string>;
    severity: ReportIssueRow['severity'];
    opened_at: string;
    status: string;
    item_code?: string | null;
    work_order_ref?: string | null;
  }[];
  comment: Record<string, string> | null;

  frozenAt?: string;
}

function localize(map: Record<string, string> | null | undefined, owner: string, orgDefault: string): string {
  if (!map) return '';
  const rows = Object.entries(map)
    .filter(([k]) => !k.startsWith('_'))
    .map(([locale, title]) => ({ locale, title }));
  try {
    return resolveTranslation(rows, owner, orgDefault, { optional: true }) || rows[0]?.title || '';
  } catch {
    return rows[0]?.title ?? '';
  }
}

export function buildReportSnapshot(input: SnapshotInputs): ReportSnapshot {
  const owner = input.ownerLocale;
  const orgDefault = input.orgDefaultLocale;

  const visible = visibleItems(input.templateItems, input.property.property_type);
  const statusByCode = new Map(input.itemRecords.map((r) => [r.item_code, r]));
  const deviationCodes = new Set(
    input.itemRecords.filter((r) => r.status === 'deviation').map((r) => r.item_code),
  );

  const checklist: ReportChecklistRow[] = visible.map((it: SnapshotItem) => {
    const rec = statusByCode.get(it.code);
    return {
      code: it.code,
      sort_order: it.sort_order,
      category: it.category,
      title: resolveTranslation(
        Object.entries(it.title).map(([locale, title]) => ({ locale, title })),
        owner,
        orgDefault,
      ),
      status: rec?.status ?? 'not_checked',
      value: rec?.value_numeric ?? null,
      value_unit: rec?.value_unit ?? it.value_unit,
    };
  });

  const checked = checklist.filter((c) => c.status !== 'not_checked').length;
  const deviations = checklist.filter((c) => c.status === 'deviation').length;
  const not_applicable = checklist.filter((c) => c.status === 'not_applicable').length;

  const meters: ReportMeterRow[] = input.meters.map((m) => ({
    meter_type: m.meter_type,
    previous: m.previous ?? null,
    current: m.reading,
    unit: m.unit,
    delta: m.delta ?? null,
    per_day: m.per_day ?? null,
    is_anomaly: !!m.is_anomaly,
    anomaly_note: m.anomaly_note,
  }));

  const photos: ReportPhotoRef[] = input.photos.map((p) => ({
    storage_path: p.storage_path,
    item_code: p.item_code ?? null,
    caption: p.caption ? localize(p.caption, owner, orgDefault) : null,
    is_deviation: p.item_code ? deviationCodes.has(p.item_code) : false,
  }));
  // deviation photos first
  photos.sort((a, b) => Number(b.is_deviation) - Number(a.is_deviation));

  const by_severity: Record<string, number> = {};
  const issues: ReportIssueRow[] = input.issues.map((i) => {
    by_severity[i.severity] = (by_severity[i.severity] ?? 0) + 1;
    return {
      title: localize(i.title, owner, orgDefault),
      severity: i.severity,
      opened_at: i.opened_at,
      status: i.status,
      work_order_ref: i.work_order_ref ?? null,
    };
  });

  const commentSource = (input.comment?._source as string) || orgDefault;
  const commentIsSource = commentSource === owner;
  const comment = localize(input.comment, owner, commentSource);

  return {
    reference: input.reference,
    locale: owner,
    org_default_locale: orgDefault,
    org_name: input.orgName,
    brand_name: input.brandName ?? null,
    property_name: input.property.name || input.property.reference,
    property_reference: input.property.reference,
    address: input.property.address,
    inspector_name: input.inspectorName,
    started_at: input.startedAt,
    completed_at: input.completedAt,
    timezone: input.timezone ?? 'Europe/Madrid',
    gps_status: input.gpsStatus,
    next_inspection_at: input.nextInspectionAt ?? null,
    summary: {
      checked,
      total: visible.length,
      deviations,
      not_applicable,
      photo_count: input.photos.length,
      by_severity,
    },
    meters,
    checklist,
    photos,
    issues,
    comment,
    comment_source_locale: commentSource,
    comment_is_source_language: commentIsSource,
    frozen_at: input.frozenAt ?? new Date().toISOString(),
  };
}
