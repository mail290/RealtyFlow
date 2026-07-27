// =====================================================================
// Freeze a checklist template + its translations into a snapshot that the
// inspection (and, later, the report) renders from — never live data.
// =====================================================================

import type { SnapshotItem, TemplateSnapshot, PropertyType } from './types';

export interface TemplateInput {
  template_id: string;
  code: string;
  version: number;
  name: string;
  min_photos: number;
  property_types: PropertyType[];
}

export interface ItemInput {
  code: string;
  sort_order: number;
  category: string;
  requires_photo: boolean;
  requires_value: boolean;
  value_unit: string | null;
  applies_to: PropertyType[];
  is_automatic: boolean;
  /** all available locale titles for this item */
  title: Record<string, string>;
}

export function buildTemplateSnapshot(
  template: TemplateInput,
  items: ItemInput[],
  frozenAt: string = new Date().toISOString(),
): TemplateSnapshot {
  const snapshotItems: SnapshotItem[] = items
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({
      code: i.code,
      sort_order: i.sort_order,
      category: i.category,
      requires_photo: i.requires_photo,
      requires_value: i.requires_value,
      value_unit: i.value_unit,
      applies_to: i.applies_to,
      is_automatic: i.is_automatic,
      title: { ...i.title },
    }));

  const locales = Array.from(
    new Set(snapshotItems.flatMap((i) => Object.keys(i.title))),
  ).sort();

  return {
    template_id: template.template_id,
    code: template.code,
    version: template.version,
    name: template.name,
    min_photos: template.min_photos,
    property_types: template.property_types,
    items: snapshotItems,
    locales,
    frozen_at: frozenAt,
  };
}
