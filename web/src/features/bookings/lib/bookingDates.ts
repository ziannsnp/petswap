/**
 * Booking calendar days.
 *
 * The database is the authority on booking dates and judges them against its own
 * UTC calendar day (see ADR 0011). The browser also knows the visitor's local day.
 * Near midnight the two differ by one, so every UI date gate below picks the rule
 * that can never offer something the database will refuse:
 *
 * - Request start: the later of local today and UTC today. A visitor never sees a
 *   day that is already past on their own calendar, and never submits a start day
 *   the database already treats as past.
 * - Completion: UTC today only, exactly as `guard_booking_change()` checks it.
 */

function pad(value: number): string {
  return `${value}`.padStart(2, '0');
}

/** Today as a `YYYY-MM-DD` calendar day in the visitor's own timezone. */
export function todayIsoDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Today as a `YYYY-MM-DD` calendar day in UTC: the day the database compares against. */
export function utcTodayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The later of two `YYYY-MM-DD` calendar days (ISO days compare correctly as strings). */
export function laterIsoDate(first: string, second: string): string {
  return second > first ? second : first;
}

/** The earliest start day a new booking request may use (later of local and UTC today). */
export function earliestRequestStartDate(now: Date = new Date()): string {
  return laterIsoDate(todayIsoDate(now), utcTodayIsoDate(now));
}
