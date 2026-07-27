// =====================================================================
// iCal (RFC 5545) feed per property — low build cost, high perceived value.
// The owner subscribes and sees when you've been there. Pure, tested.
// =====================================================================

export interface ICalEvent {
  uid: string;
  summary: string;
  start: string;      // ISO
  end: string;        // ISO
  allDay?: boolean;
  description?: string;
  location?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC timestamp form: 20260312T090000Z */
function toICalDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}
/** All-day date form: 20260312 */
function toICalDate(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** Escape per RFC 5545 (commas, semicolons, backslashes, newlines). */
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold long content lines to 75 octets with CRLF + space (RFC 5545). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

export function buildICalFeed(
  calendarName: string,
  events: ICalEvent[],
  now: Date = new Date(),
): string {
  const stamp = toICalDateTime(now.toISOString());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RealtyFlow Care//Keyholding//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(calendarName)}`,
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${toICalDate(e.start)}`);
      lines.push(`DTEND;VALUE=DATE:${toICalDate(e.end)}`);
    } else {
      lines.push(`DTSTART:${toICalDateTime(e.start)}`);
      lines.push(`DTEND:${toICalDateTime(e.end)}`);
    }
    lines.push(fold(`SUMMARY:${escapeICalText(e.summary)}`));
    if (e.description) lines.push(fold(`DESCRIPTION:${escapeICalText(e.description)}`));
    if (e.location) lines.push(fold(`LOCATION:${escapeICalText(e.location)}`));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
