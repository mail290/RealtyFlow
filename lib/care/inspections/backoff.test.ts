import { describe, it, expect } from 'vitest';
import { backoffDelayMs, nextAttemptAt, BACKOFF_CAP_MS } from './backoff';

describe('backoffDelayMs', () => {
  it('doubles: 1, 2, 4, 8 seconds', () => {
    expect(backoffDelayMs(0)).toBe(1000);
    expect(backoffDelayMs(1)).toBe(2000);
    expect(backoffDelayMs(2)).toBe(4000);
    expect(backoffDelayMs(3)).toBe(8000);
  });
  it('caps at 5 minutes', () => {
    expect(backoffDelayMs(20)).toBe(BACKOFF_CAP_MS);
    expect(backoffDelayMs(1000)).toBe(BACKOFF_CAP_MS);
  });
  it('treats negative/fractional attempts safely', () => {
    expect(backoffDelayMs(-3)).toBe(1000);
    expect(backoffDelayMs(2.9)).toBe(4000);
  });
  it('nextAttemptAt adds the delay to now', () => {
    expect(nextAttemptAt(2, 10_000)).toBe(14_000);
  });
});
