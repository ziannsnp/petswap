import { validateListingForm } from './listingForm';

describe('validateListingForm', () => {
  it('accepts a complete listing form', () => {
    expect(
      validateListingForm({
        title: 'Quiet home near the park',
        location: 'Chiang Mai',
        description: 'A fenced home with plenty of indoor space.',
        capacity: 2,
      }),
    ).toEqual({});
  });

  it('reports every required value and an invalid capacity', () => {
    expect(
      validateListingForm({ title: ' ', location: '', description: '\n', capacity: 0 }),
    ).toEqual({
      title: 'Listing title is required.',
      location: 'Location is required.',
      description: 'Description is required.',
      capacity: 'Capacity must be at least 1.',
    });
  });

  it('reports an empty capacity while allowing it as an editing state', () => {
    expect(
      validateListingForm({
        title: 'Quiet home near the park',
        location: 'Chiang Mai',
        description: 'A fenced home with plenty of indoor space.',
        capacity: '',
      }),
    ).toEqual({ capacity: 'Capacity must be at least 1.' });
  });
});
