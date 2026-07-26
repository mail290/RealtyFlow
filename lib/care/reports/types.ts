// =====================================================================
// Frozen report snapshot — everything the PDF renders, in the owner's
// language. From the moment it is built the report is immutable; editing a
// checklist point six months later changes no already-sent report.
// =====================================================================

import type { ItemStatus, GpsStatus, MeterType } from '../inspections/types';

export interface ReportMeterRow {
  meter_type: MeterType;
  previous: number | null;
  current: number;
  unit: string;
  delta: number | null;
  per_day: number | null;
  is_anomaly: boolean;
  anomaly_note?: string;
}

export interface ReportChecklistRow {
  code: string;
  sort_order: number;
  category: string;
  title: string; // resolved to owner locale
  status: ItemStatus;
  value?: number | null;
  value_unit?: string | null;
}

export interface ReportPhotoRef {
  storage_path: string;
  item_code: string | null;
  caption: string | null;
  is_deviation: boolean;
}

export interface ReportIssueRow {
  title: string; // resolved to owner locale (falls back to source language)
  severity: 'info' | 'low' | 'medium' | 'high' | 'urgent';
  opened_at: string;
  status: string;
  work_order_ref?: string | null;
}

export interface ReportSnapshot {
  reference: string;
  locale: string; // owner locale — drives all formatting
  org_default_locale: string;
  org_name: string;
  brand_name?: string | null;
  property_name: string;
  property_reference: string;
  address: string;
  inspector_name: string;
  started_at: string;
  completed_at: string; // server time in prod
  timezone: string;
  gps_status: GpsStatus;
  next_inspection_at?: string | null;

  summary: {
    checked: number;
    total: number;
    deviations: number;
    not_applicable: number;
    photo_count: number;
    by_severity: Record<string, number>;
  };

  meters: ReportMeterRow[];
  checklist: ReportChecklistRow[];
  photos: ReportPhotoRef[];
  issues: ReportIssueRow[];

  comment: string;
  comment_source_locale: string;
  comment_is_source_language: boolean; // true when shown in the writer's language

  frozen_at: string;
}
