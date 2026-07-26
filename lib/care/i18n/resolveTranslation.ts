// =====================================================================
// resolveTranslation — the single source of fallback logic for i18n
// layer 2 (system content: checklist items, trades, statuses...).
// =====================================================================
// Lookup order everywhere: requested locale -> org default -> 'en'.
// A string missing in ALL languages is a hard error, never an empty
// string — a blank line in a customer report hides a real data gap.
// =====================================================================

export interface TranslationRow {
  locale: string;
  [field: string]: unknown;
}

export interface ResolveOptions {
  /** field to read from the row; defaults to 'title' */
  field?: string;
  /** final fallback locale; defaults to 'en' */
  finalFallback?: string;
  /**
   * when true, returns `undefined` instead of throwing if nothing is
   * found (use for optional fields like help_text).
   */
  optional?: boolean;
}

/**
 * Resolve a translated string from a set of rows keyed by locale.
 *
 * @param rows            translation rows (e.g. kh_checklist_item_translations)
 * @param requestedLocale the recipient's locale (Principle 3)
 * @param orgDefault      the organisation's default_locale
 */
export function resolveTranslation(
  rows: TranslationRow[] | null | undefined,
  requestedLocale: string,
  orgDefault: string,
  options: ResolveOptions = {},
): string {
  const field = options.field ?? 'title';
  const finalFallback = options.finalFallback ?? 'en';

  const chain = [requestedLocale, orgDefault, finalFallback].filter(
    (l, i, arr) => l && arr.indexOf(l) === i,
  );

  if (rows && rows.length) {
    const byLocale = new Map(rows.map((r) => [r.locale, r]));
    for (const locale of chain) {
      const row = byLocale.get(locale);
      const value = row?.[field];
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
  }

  if (options.optional) {
    return '' as string; // caller opted out of the hard error
  }
  throw new Error(
    `resolveTranslation: no '${field}' found for locales [${chain.join(
      ', ',
    )}] (checked ${rows?.length ?? 0} rows)`,
  );
}
