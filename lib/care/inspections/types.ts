// =====================================================================
// Inspection domain types (shared by pure logic, storage and UI).
// =====================================================================

export type ItemStatus = 'ok' | 'deviation' | 'not_applicable' | 'not_checked';
export type MeterType = 'water' | 'electricity' | 'gas';
export type GpsStatus = 'ok' | 'low_accuracy' | 'denied' | 'unavailable';
export type InspectionStatus = 'draft' | 'completed' | 'synced' | 'reported';
export type PropertyType = 'apartment' | 'townhouse' | 'villa' | 'finca';

/** One checklist point inside a frozen template_snapshot. */
export interface SnapshotItem {
  code: string;
  sort_order: number;
  category: string;
  requires_photo: boolean;
  requires_value: boolean;
  value_unit: string | null;
  applies_to: PropertyType[];
  is_automatic: boolean;
  /** all locales, so the report renders in the owner's language later */
  title: Record<string, string>;
}

export interface TemplateSnapshot {
  template_id: string;
  code: string;
  version: number;
  name: string;
  min_photos: number;
  property_types: PropertyType[];
  items: SnapshotItem[];
  /** locales the snapshot carries translations for */
  locales: string[];
  frozen_at: string;
}

/** A recorded result for one checklist point (kh_inspection_items). */
export interface InspectionItemRecord {
  id: string;
  inspection_id: string;
  item_code: string;
  status: ItemStatus;
  value_numeric?: number | null;
  value_unit?: string | null;
  note?: Record<string, string> | null;
  recorded_at: string;
}

export interface PhotoRecord {
  id: string;
  inspection_id: string;
  item_code?: string | null;
  storage_path: string;
  bytes?: number;
  taken_at: string;
  uploaded: boolean;
}
