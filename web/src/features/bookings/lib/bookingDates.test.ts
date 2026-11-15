import { earliestRequestStartDate, laterIsoDate, todayIsoDate, utcTodayIsoDate } from './bookingDates';

it('reads the UTC calendar day of an instant', () => {
  expect(utcTodayIsoDate(new Date('2026-09-14T00:00:00Z'))).toBe('2026-09-14');
  expect(utcTodayIsoDate(new Date('2026-09-14T23:59:59Z'))).toBe('2026-09-14');
  expect(utcTodayIsoDate(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-31');
});

it('uses the local day when the visitor is ahead of UTC near midnight', () => {
  // Bangkok (UTC+7) at 01:00 on the 14th: local 14th, UTC still the 13th.
  expect(laterIsoDate('2026-09-14', '2026-09-13')).toBe('2026-09-14');
});

it('uses the UTC day when the visitor is behind UTC near midnight', () => {
  // New York at 21:30 on the 13th: local 13th, UTC (database) already the 14th.
  expect(laterIsoDate('2026-09-13', '2026-09-14')).toBe('2026-09-14');
});

it('handles month and year rollovers', () => {
  expect(laterIsoDate('2026-12-31', '2027-01-01')).toBe('2027-01-01');
  expect(laterIsoDate('2026-10-01', '2026-09-30')).toBe('2026-10-01');
});

it('never returns a day earlier than either clock in the running timezone', () => {
  for (const instant of ['2026-09-13T17:30:00Z', '2026-09-14T01:30:00Z', '2026-09-14T12:00:00Z']) {
    const now = new Date(instant);
    const earliest = earliestRequestStartDate(now);
    expect(earliest >= todayIsoDate(now)).toBe(true);
    expect(earliest >= utcTodayIsoDate(now)).toBe(true);
  }
});
