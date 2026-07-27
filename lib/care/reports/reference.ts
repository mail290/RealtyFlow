// =====================================================================
// Customer-facing report numbering: KH-R-{yy}-{seq}.
// Never a random id in customer communication — a reference builds trust.
// The sequence is per organisation per year (a Postgres sequence in prod).
// =====================================================================

export function formatReportReference(year: number, seq: number, prefix = 'KH-R'): string {
  const yy = String(year % 100).padStart(2, '0');
  const n = String(seq).padStart(4, '0');
  return `${prefix}-${yy}-${n}`;
}

/** Next sequence value given the last used value for that org+year. */
export function nextSeq(lastValue: number | null | undefined): number {
  return (lastValue ?? 0) + 1;
}
