import { todayIsoDate, validateBookingRequestForm } from './bookingRequestForm';

// Pinned so the suite does not start failing once the calendar reaches the
// fixture dates below.
const TODAY = '2026-09-13';

function values(overrides: Partial<Parameters<typeof validateBookingRequestForm>[0]> = {}) {
  return {
    petId: 'pet-1',
    startDate: '2027-01-10',
    endDate: '2027-01-14',
    ...overrides,
  };
}

function validate(overrides: Partial<Parameters<typeof validateBookingRequestForm>[0]> = {}) {
  return validateBookingRequestForm(values(overrides), TODAY);
}

it('accepts a well-formed request with no errors', () => {
  expect(validate()).toEqual({});
});

it('requires a pet to be chosen', () => {
  expect(validate({ petId: '' })).toEqual({
    petId: 'Choose which pet this booking is for.',
  });
});

it('requires a start date', () => {
  expect(validate({ startDate: '' })).toEqual({
    startDate: 'Start date is required.',
  });
});

it('requires an end date', () => {
  expect(validate({ endDate: '' })).toEqual({
    endDate: 'End date is required.',
  });
});

it('rejects an end date that is not after the start date', () => {
  expect(validate({ startDate: '2027-01-14', endDate: '2027-01-14' })).toEqual({
    endDate: 'End date must be later than the start date.',
  });
  expect(validate({ startDate: '2027-01-14', endDate: '2027-01-10' })).toEqual({
    endDate: 'End date must be later than the start date.',
  });
});

it('rejects a stay that starts before today', () => {
  expect(validate({ startDate: '2026-09-12', endDate: '2026-09-16' })).toEqual({
    startDate: 'Start date cannot be in the past.',
  });
});

it('accepts a stay that starts today', () => {
  expect(validate({ startDate: TODAY, endDate: '2026-09-16' })).toEqual({});
});

it('reports both problems when a past stay also ends before it starts', () => {
  expect(validate({ startDate: '2026-09-12', endDate: '2026-09-11' })).toEqual({
    startDate: 'Start date cannot be in the past.',
    endDate: 'End date must be later than the start date.',
  });
});

it('rejects unparsable dates without throwing', () => {
  expect(validate({ startDate: 'not-a-date', endDate: '2027-01-14' })).toEqual({
    endDate: 'Enter valid dates.',
  });
});

it('defaults to the local calendar day when no reference day is given', () => {
  expect(todayIsoDate(new Date(2026, 8, 5))).toBe('2026-09-05');
  expect(todayIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
});

it('treats the past check as local, not UTC', () => {
  // 01:00 on the 14th in UTC+7 is still the 13th in UTC; the visitor picked the
  // 14th from their own calendar, so it must not be read as yesterday.
  const localMidnightish = new Date(2026, 8, 14, 1, 0, 0);
  expect(validateBookingRequestForm(
    values({ startDate: '2026-09-14', endDate: '2026-09-18' }),
    todayIsoDate(localMidnightish),
  )).toEqual({});
});
