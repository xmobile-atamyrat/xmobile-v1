import { describe, expect, it } from 'vitest';

import {
  dayBoundsUtc,
  dayFromDb,
  dayStartUtc,
  daysInRange,
  eachDay,
  isComplete,
  isoWeekStart,
  localDay,
  monthStart,
  periodEnd,
  periodStart,
  periodStarts,
  previousRange,
  rawWindowStart,
  sqlDayRange,
  sqlLocalDay,
  sqlTimestamp,
} from '@/lib/analytics/time';
import { Prisma } from '@prisma/client';
import { periodContaining } from '@/pages/admin/analytics/format';

describe('Ashgabat day boundaries', () => {
  it('starts a day at 19:00 UTC the evening before', () => {
    expect(dayStartUtc('2026-11-26').toISOString()).toBe(
      '2026-11-25T19:00:00.000Z',
    );
  });

  it('puts 18:59 UTC in the same day and 19:00 UTC in the next', () => {
    expect(localDay(new Date('2026-11-25T18:59:59.999Z'))).toBe('2026-11-25');
    expect(localDay(new Date('2026-11-25T19:00:00.000Z'))).toBe('2026-11-26');
  });

  it('gives a half-open UTC range for inclusive days', () => {
    const { start, end } = dayBoundsUtc('2026-11-01', '2026-11-30');
    expect(start.toISOString()).toBe('2026-10-31T19:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-30T19:00:00.000Z');
  });

  it('crosses the year boundary', () => {
    expect(dayStartUtc('2027-01-01').toISOString()).toBe(
      '2026-12-31T19:00:00.000Z',
    );
    expect(localDay(new Date('2026-12-31T19:00:00Z'))).toBe('2027-01-01');
    expect(localDay(new Date('2026-12-31T18:59:00Z'))).toBe('2026-12-31');
  });
});

describe('ranges', () => {
  it('counts days inclusively, across months and leap days', () => {
    expect(daysInRange('2026-11-27', '2026-11-27')).toBe(1);
    expect(daysInRange('2026-11-01', '2026-11-30')).toBe(30);
    expect(daysInRange('2028-02-28', '2028-03-01')).toBe(3);
    expect(daysInRange('2026-12-31', '2027-01-01')).toBe(2);
  });

  it('lists every day', () => {
    expect(eachDay('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
    expect(eachDay('2026-01-02', '2026-01-01')).toEqual([]);
  });

  it('takes the equally long range right before', () => {
    expect(previousRange('2026-11-27', '2026-11-27')).toEqual({
      from: '2026-11-26',
      to: '2026-11-26',
    });
    expect(previousRange('2026-11-01', '2026-11-30')).toEqual({
      from: '2026-10-02',
      to: '2026-10-31',
    });
    expect(previousRange('2027-01-01', '2027-01-07')).toEqual({
      from: '2026-12-25',
      to: '2026-12-31',
    });
  });
});

describe('ISO weeks', () => {
  it('starts on Monday', () => {
    // 2026-11-23 is a Monday.
    expect(isoWeekStart('2026-11-23')).toBe('2026-11-23');
    expect(isoWeekStart('2026-11-27')).toBe('2026-11-23');
    expect(isoWeekStart('2026-11-29')).toBe('2026-11-23'); // Sunday
    expect(isoWeekStart('2026-11-30')).toBe('2026-11-30');
  });

  it('crosses month and year boundaries', () => {
    expect(isoWeekStart('2026-12-02')).toBe('2026-11-30');
    // 2027-01-01 is a Friday; its ISO week started on Monday 2026-12-28.
    expect(isoWeekStart('2027-01-01')).toBe('2026-12-28');
    expect(isoWeekStart('2027-01-03')).toBe('2026-12-28');
    expect(isoWeekStart('2027-01-04')).toBe('2027-01-04');
  });

  it('ends on Sunday', () => {
    expect(periodEnd('2026-12-28', 'week')).toBe('2027-01-03');
  });
});

describe('months', () => {
  it('starts on the 1st', () => {
    expect(monthStart('2026-11-27')).toBe('2026-11-01');
    expect(monthStart('2026-12-31')).toBe('2026-12-01');
  });

  it('ends on the last day, leap years included', () => {
    expect(periodEnd('2026-02-01', 'month')).toBe('2026-02-28');
    expect(periodEnd('2028-02-01', 'month')).toBe('2028-02-29');
    expect(periodEnd('2026-12-01', 'month')).toBe('2026-12-31');
    expect(periodEnd('2026-04-01', 'month')).toBe('2026-04-30');
  });
});

describe('periods', () => {
  it('maps a day to its period start', () => {
    expect(periodStart('2026-11-27', 'day')).toBe('2026-11-27');
    expect(periodStart('2026-11-27', 'week')).toBe('2026-11-23');
    expect(periodStart('2026-11-27', 'month')).toBe('2026-11-01');
    expect(periodEnd('2026-11-27', 'day')).toBe('2026-11-27');
  });

  it('lists the periods overlapping a range, the first one may start before it', () => {
    expect(periodStarts('2026-11-27', '2026-12-08', 'week')).toEqual([
      '2026-11-23',
      '2026-11-30',
      '2026-12-07',
    ]);
    expect(periodStarts('2026-11-15', '2027-02-01', 'month')).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ]);
    expect(periodStarts('2026-12-30', '2027-01-01', 'day')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ]);
  });
});

describe('rawWindowStart', () => {
  it('is the oldest day still entirely inside the 90-day retention', () => {
    // Ashgabat day 2026-11-27 (07:00 local); 89 days back.
    expect(rawWindowStart(new Date('2026-11-27T02:00:00Z'))).toBe('2026-08-30');
    // 23:30 local on 2026-11-27 is still the same local day.
    expect(rawWindowStart(new Date('2026-11-27T18:30:00Z'))).toBe('2026-08-30');
    // 00:30 local on 2026-11-28.
    expect(rawWindowStart(new Date('2026-11-27T19:30:00Z'))).toBe('2026-08-31');
  });

  it('never includes a day the retention cut-off has reached', () => {
    const now = new Date('2026-11-27T18:59:00Z');
    const cutoff = now.getTime() - 90 * 24 * 60 * 60 * 1000;
    expect(dayStartUtc(rawWindowStart(now)).getTime()).toBeGreaterThanOrEqual(
      cutoff,
    );
  });
});

describe('isComplete', () => {
  it('waits an hour after the last day for late events', () => {
    // 2026-11-29 (a Sunday) ends at 2026-11-29T19:00Z.
    expect(isComplete('2026-11-29', new Date('2026-11-29T19:59:59Z'))).toBe(
      false,
    );
    expect(isComplete('2026-11-29', new Date('2026-11-29T20:00:00Z'))).toBe(
      true,
    );
    expect(isComplete('2026-11-29', new Date('2026-11-29T12:00:00Z'))).toBe(
      false,
    );
  });
});

describe('SQL helpers', () => {
  it('ends a day range early at `until`, never late', () => {
    const column = Prisma.sql`"occurredAt"`;
    expect(sqlDayRange(column, '2026-11-26', '2026-11-27').values).toEqual([
      '2026-11-25 19:00:00.000',
      '2026-11-27 19:00:00.000',
    ]);
    expect(
      sqlDayRange(
        column,
        '2026-11-26',
        '2026-11-27',
        new Date('2026-11-27T04:30:00Z'),
      ).values,
    ).toEqual(['2026-11-25 19:00:00.000', '2026-11-27 04:30:00.000']);
    expect(
      sqlDayRange(
        column,
        '2026-11-26',
        '2026-11-27',
        new Date('2026-11-28T04:30:00Z'),
      ).values,
    ).toEqual(['2026-11-25 19:00:00.000', '2026-11-27 19:00:00.000']);
  });

  it('takes the local day with interval arithmetic, not AT TIME ZONE', () => {
    const sql = sqlLocalDay(Prisma.sql`"completedAt"`).sql;
    expect(sql).toContain(`interval '5 hours'`);
    expect(sql).not.toMatch(/time zone/i);
  });

  it('passes timestamps as zone-less UTC text', () => {
    const sql = sqlTimestamp(new Date('2026-11-25T19:00:00.000Z'));
    expect(sql.values).toEqual(['2026-11-25 19:00:00.000']);
    expect(sql.sql).toContain('::timestamp');
  });

  it('reads date columns back as days', () => {
    expect(dayFromDb(new Date('2026-11-27T00:00:00.000Z'))).toBe('2026-11-27');
    expect(dayFromDb('2026-11-27')).toBe('2026-11-27');
  });
});

describe('periodContaining (dashboard copy of periodStart)', () => {
  it('agrees with periodStart for every day of two years', () => {
    eachDay('2025-01-01', '2026-12-31').forEach((day) => {
      (['day', 'week', 'month'] as const).forEach((granularity) => {
        expect(periodContaining(day, granularity)).toBe(
          periodStart(day, granularity),
        );
      });
    });
  });
});
