import { activityDayLabel, formatActivityTime, groupActivityEventsByDay } from '../activity';
import type { ActivityEvent } from '../types';

const now = new Date(2026, 10, 14, 15, 0);

function event(id: number, date: Date, overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id,
    trackedProductId: id,
    productTitle: `Product ${id}`,
    newPriceMinor: 9000,
    currency: 'AED',
    priceDirection: 'down',
    source: 'manual_batch',
    checkedAt: date.toISOString(),
    ...overrides
  };
}

describe('activity grouping', () => {
  it('groups events by stable local calendar day and counts them', () => {
    const events = [
      event(1, new Date(2026, 10, 14, 9, 5)),
      event(2, new Date(2026, 10, 14, 0, 30)),
      event(3, new Date(2026, 10, 13, 23, 30)),
      event(4, new Date(2026, 10, 10, 12, 0)),
      event(5, new Date(2025, 11, 31, 18, 15))
    ];

    const groups = groupActivityEventsByDay(events, now);
    expect(groups.map((group) => [group.label, group.count, group.events.map((item) => item.id)])).toEqual([
      ['Today', 2, [1, 2]],
      ['Yesterday', 1, [3]],
      ['Tue, 10 Nov', 1, [4]],
      ['Wed, 31 Dec 2025', 1, [5]]
    ]);
  });

  it('uses a stable day label instead of the relative age of each event', () => {
    expect(activityDayLabel(new Date(2026, 10, 14, 0, 1).toISOString(), now)).toBe('Today');
    expect(activityDayLabel(new Date(2026, 10, 13, 23, 59).toISOString(), now)).toBe('Yesterday');
    expect(activityDayLabel(new Date(2026, 10, 12, 9, 0).toISOString(), now)).toBe('Thu, 12 Nov');
  });

  it('formats the time of day for the row meta line', () => {
    expect(formatActivityTime(new Date(2026, 10, 14, 0, 5))).toBe('12:05 AM');
    expect(formatActivityTime(new Date(2026, 10, 14, 9, 30))).toBe('9:30 AM');
    expect(formatActivityTime(new Date(2026, 10, 14, 15, 12))).toBe('3:12 PM');
  });
});
