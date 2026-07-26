// Exponential backoff for the sync queue: 1→2→4→8 s, capped at 5 minutes.
// `attempts` is the number of failures so far (0 = first retry).
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_CAP_MS = 5 * 60 * 1000;

export function backoffDelayMs(attempts: number): number {
  const n = Math.max(0, Math.floor(attempts));
  const raw = BACKOFF_BASE_MS * 2 ** n;
  return Math.min(raw, BACKOFF_CAP_MS);
}

export function nextAttemptAt(attempts: number, now = Date.now()): number {
  return now + backoffDelayMs(attempts);
}
