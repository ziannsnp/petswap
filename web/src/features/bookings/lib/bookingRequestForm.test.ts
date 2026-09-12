import { validateBookingRequestForm } from './bookingRequestForm';

function values(overrides: Partial<Parameters<typeof validateBookingRequestForm>[0]> = {}) {
  return {
    petId: 'pet-1',
    startDate: '2027-01-10',
    endDate: '2027-01-14',
    ...overrides,
  };
}

it('accepts a well-formed request with no errors', () => {
  expect(validateBookingRequestForm(values())).toEqual({});
});

it('requires a pet to be chosen', () => {
  expect(validateBookingRequestForm(values({ petId: '' }))).toEqual({
    petId: 'Choose which pet this booking is for.',
  });
});

it('requires a start date', () => {
  expect(validateBookingRequestForm(values({ startDate: '' }))).toEqual({
    startDate: 'Start date is required.',
  });
});

it('requires an end date', () => {
  expect(validateBookingRequestForm(values({ endDate: '' }))).toEqual({
    endDate: 'End date is required.',
  });
});

it('rejects an end date that is not after the start date', () => {
  expect(validateBookingRequestForm(values({ startDate: '2027-01-14', endDate: '2027-01-14' }))).toEqual({
    endDate: 'End date must be later than the start date.',
  });
  expect(validateBookingRequestForm(values({ startDate: '2027-01-14', endDate: '2027-01-10' }))).toEqual({
    endDate: 'End date must be later than the start date.',
  });
});

it('rejects unparsable dates without throwing', () => {
  expect(validateBookingRequestForm(values({ startDate: 'not-a-date', endDate: '2027-01-14' }))).toEqual({
    endDate: 'Enter valid dates.',
  });
});
