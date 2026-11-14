import type { ActivityEvent } from './types';

export type ActivityDayGroup = {
  key: string;
  label: string;
  count: number;
  events: ActivityEvent[];
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function activityDayLabel(checkedAt: string | Date, now: Date = new Date()): string {
  const date = checkedAt instanceof Date ? checkedAt : new Date(checkedAt);
  const diffDays = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / DAY_MS);
  if (diffDays === 0) { return 'Today'; }
  if (diffDays === 1) { return 'Yesterday'; }
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}${year}`;
}

export function formatActivityTime(checkedAt: string | Date): string {
  const date = checkedAt instanceof Date ? checkedAt : new Date(checkedAt);
  const hours = date.getHours();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(date.getMinutes()).padStart(2, '0')} ${suffix}`;
}

/**
 * Groups newest-first activity events into stable local-calendar-day sections.
 * A new section starts whenever the local date changes, so relative labels like
 * "15h ago" can no longer split or rename a day's history.
 */
export function groupActivityEventsByDay(events: ActivityEvent[], now: Date = new Date()): ActivityDayGroup[] {
  const groups: ActivityDayGroup[] = [];
  for (const event of events) {
    const date = new Date(event.checkedAt);
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
      last.count += 1;
      continue;
    }
    groups.push({ key, label: activityDayLabel(date, now), count: 1, events: [event] });
  }
  return groups;
}
