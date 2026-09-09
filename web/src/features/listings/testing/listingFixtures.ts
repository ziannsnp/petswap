import type { ListingFormErrors, ListingFormValues } from '../lib/listingForm';
import type { Database } from '@/shared/types/database.types';

export type ListingQueryRow = Database['public']['Tables']['listings']['Row'] & {
  listing_images: Database['public']['Tables']['listing_images']['Row'][];
};

export function makeListingRow(overrides: Partial<ListingQueryRow> = {}): ListingQueryRow {
  return {
    id: 'listing-1',
    owner_id: 'owner-1',
    title: 'Quiet home near the park',
    location: 'Chiang Mai, Hang Dong',
    description: 'A calm, fenced home with plenty of indoor space.',
    capacity: 2,
    accepted_pet_types: ['dog', 'cat'],
    facilities: 'Fenced yard',
    status: 'published',
    deleted_at: null,
    published_at: '2026-09-01T00:00:00.000Z',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    listing_images: [],
    ...overrides,
  };
}

export const validListingFormValues: ListingFormValues = {
  title: 'Quiet home near the park',
  location: 'Chiang Mai, Hang Dong',
  description: 'A calm, fenced home with plenty of indoor space.',
  capacity: 2,
};

export interface InvalidListingFormCase {
  name: string;
  values: ListingFormValues;
  expectedErrors: ListingFormErrors;
}

export const invalidListingFormCases: readonly InvalidListingFormCase[] = [
  {
    name: 'blank required fields',
    values: { title: ' ', location: '', description: '\n', capacity: 2 },
    expectedErrors: {
      title: 'Listing title is required.',
      location: 'Location is required.',
      description: 'Description is required.',
    },
  },
  {
    name: 'empty capacity',
    values: { ...validListingFormValues, capacity: '' },
    expectedErrors: { capacity: 'Capacity must be at least 1.' },
  },
  {
    name: 'zero capacity',
    values: { ...validListingFormValues, capacity: 0 },
    expectedErrors: { capacity: 'Capacity must be at least 1.' },
  },
  {
    name: 'fractional capacity',
    values: { ...validListingFormValues, capacity: 1.5 },
    expectedErrors: { capacity: 'Capacity must be at least 1.' },
  },
];
