const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** Due dates are calendar dates ("2026-11-30"); parse them as local dates, not UTC instants. */
function parseCalendarDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export type DueStatus = 'overdue' | 'today' | 'upcoming';

export function dueStatus(dueDate: string): DueStatus {
  const diff = parseCalendarDate(dueDate).getTime() - startOfToday().getTime();
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
}

export function formatDueDate(dueDate: string): string {
  const days = Math.round(
    (parseCalendarDate(dueDate).getTime() - startOfToday().getTime()) / 86_400_000,
  );
  if (Math.abs(days) <= 1) return relativeFormat.format(days, 'day');
  return shortDateFormat.format(parseCalendarDate(dueDate));
}

/** A calendar date ("2026-11-30") in full, e.g. "Nov 30, 2026". */
export function formatCalendarDate(value: string): string {
  return dateFormat.format(parseCalendarDate(value));
}

export function formatRelative(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}
