/**
 * Minimal .ics (RFC 5545) writer for reminders --- "Esporta scadenze"
 * (v. RemindersPanel). Deliberately not a full implementation: no line
 * folding for very long titles, no timezone/VALARM support --- just
 * enough for a single all-day event per reminder, which every mainstream
 * calendar app (Google/Apple/Outlook) reads without issue.
 */

export interface IcsEventInput {
  id: string;
  title: string;
  /** ISO date/datetime --- only the calendar date (in local time, matching how it's shown elsewhere in the app) is used. */
  dueAt: string;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** YYYYMMDD, in local time --- consistent with how dueAt is already displayed (formatDate) throughout the app. */
function toIcsDate(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function toIcsTimestamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function buildEvent(event: IcsEventInput, stamp: string): string {
  return [
    "BEGIN:VEVENT",
    `UID:${event.id}@hinthial.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${toIcsDate(event.dueAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    "END:VEVENT",
  ].join("\r\n");
}

/** One or more reminders as a single .ics calendar (one VEVENT each). */
export function buildIcsCalendar(events: IcsEventInput[], now: Date = new Date()): string {
  const stamp = toIcsTimestamp(now);
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Hinthial//Scadenze//IT",
      "CALSCALE:GREGORIAN",
      ...events.map((event) => buildEvent(event, stamp)),
      "END:VCALENDAR",
    ].join("\r\n") + "\r\n"
  );
}
