import { describe, it, expect } from 'vitest';
import { buildICalFeed, escapeICalText, type ICalEvent } from './ical';

const events: ICalEvent[] = [
  { uid: 'a@care', summary: 'Tilsyn', start: '2026-03-12T09:00:00Z', end: '2026-03-12T10:00:00Z' },
  { uid: 'b@care', summary: 'Eieropphold', start: '2026-07-10', end: '2026-07-20', allDay: true },
];

describe('buildICalFeed', () => {
  const ics = buildICalFeed('Villa Sol', events, new Date('2026-03-01T00:00:00Z'));

  it('wraps a valid VCALENDAR', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
  });

  it('emits one VEVENT per event with UID and DTSTAMP', () => {
    expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(2);
    expect(ics).toContain('UID:a@care');
    expect(ics).toContain('DTSTAMP:20260301T000000Z');
  });

  it('formats timed vs all-day correctly', () => {
    expect(ics).toContain('DTSTART:20260312T090000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260710');
  });

  it('uses CRLF line endings', () => {
    expect(ics.includes('\r\n')).toBe(true);
  });
});

describe('escapeICalText', () => {
  it('escapes commas, semicolons, backslashes and newlines', () => {
    expect(escapeICalText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });
});
