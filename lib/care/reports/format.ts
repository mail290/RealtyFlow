// =====================================================================
// Locale-aware date / number / currency formatting for the report.
// Always Intl.*, never manual string building — a German owner sees
// 1.234,50 € and 12.03.2026, a Norwegian 1 234,50 kr and 12.03.2026,
// an English €1,234.50.
// =====================================================================

/** Map our short locale codes to BCP-47 tags for correct Intl formatting. */
const BCP47: Record<string, string> = {
  no: 'nb-NO', en: 'en-GB', es: 'es-ES', de: 'de-DE', nl: 'nl-NL',
  sv: 'sv-SE', da: 'da-DK', fr: 'fr-FR', pt: 'pt-PT', el: 'el-GR',
};
export function localeToBcp47(locale: string): string {
  return BCP47[locale] ?? locale;
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: string, timeZone = 'Europe/Madrid'): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

export function formatNumber(value: number, locale: string, fractionDigits = 2): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** amount in integer minor units (cents) → localized currency string */
export function formatCents(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export function formatMeter(value: number | null, unit: string, locale: string): string {
  if (value == null) return '—';
  return `${formatNumber(value, locale, 3).replace(/[.,]000$/, '')} ${unit}`;
}
