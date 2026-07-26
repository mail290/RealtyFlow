// =====================================================================
// Deviation → issue suggestions. Pure, tested.
// =====================================================================
// At completion the app SUGGESTS creating an issue for each point marked
// as a deviation, with title/note pre-filled — but the manager decides
// (a dust film after a Calima is not a three-month case). If an open
// issue already exists on the same item_code for the same property,
// suggest LINKING to it instead of creating a duplicate.
// =====================================================================

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'urgent';

export interface DeviationInput {
  item_code: string;
  /** frozen point title in the inspector's language */
  title: string;
  /** inspector's note (i18n layer-3 jsonb) */
  note?: Record<string, string> | null;
  /** carry a leak anomaly straight to high severity */
  severity?: Severity;
}

export interface OpenIssue {
  id: string;
  item_code: string | null;
}

export interface IssueSuggestion {
  kind: 'create' | 'link';
  item_code: string;
  /** set when kind === 'link' */
  link_to_issue_id?: string;
  /** set when kind === 'create' */
  title?: Record<string, string>;
  description?: Record<string, string> | null;
  severity?: Severity;
}

/**
 * Build issue suggestions from the deviation points of a finished
 * inspection, de-duplicating against the property's open issues.
 *
 * @param inspectorLocale locale the inspector wrote in (for the jsonb key)
 */
export function suggestIssues(
  deviations: DeviationInput[],
  openIssues: OpenIssue[],
  inspectorLocale = 'no',
): IssueSuggestion[] {
  const openByCode = new Map<string, string>();
  for (const oi of openIssues) {
    if (oi.item_code) openByCode.set(oi.item_code, oi.id);
  }

  const seen = new Set<string>();
  const out: IssueSuggestion[] = [];
  for (const d of deviations) {
    if (seen.has(d.item_code)) continue; // one suggestion per code
    seen.add(d.item_code);

    const existing = openByCode.get(d.item_code);
    if (existing) {
      out.push({ kind: 'link', item_code: d.item_code, link_to_issue_id: existing });
      continue;
    }
    out.push({
      kind: 'create',
      item_code: d.item_code,
      title: { [inspectorLocale]: d.title, _source: inspectorLocale } as Record<string, string>,
      description: d.note ?? null,
      severity: d.severity ?? 'medium',
    });
  }
  return out;
}
