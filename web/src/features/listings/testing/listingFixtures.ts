import type { Database } from '@/shared/types/database.types';
import type { Listing } from '../lib/listingApi';
import type { ListingFormErrors, ListingFormValues } from '../lib/listingForm';
import type { PetSpecies } from '@/shared/lib/petSpecies';

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
    facilities: 'Enclosed fence',
    status: 'published',
    deleted_at: null,
    published_at: '2026-09-01T00:00:00.000Z',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    listing_images: [],
    ...overrides,
  };
}

/** A listing as the API adapters hand it to screens: signed photo URLs, main photo first. */
export function makeListing(overrides: Partial<Listing> = {}): Listing {
  return { ...makeListingRow(), listing_images: [], cover_photo_url: null, ...overrides };
}

export const LISTING_OWNER_ID = 'owner-1';
export const OTHER_USER_ID = 'owner-2';
export const MISSING_LISTING_ID = 'listing-missing';

/**
 * The listings an unpublish or delete can be aimed at, seen from LISTING_OWNER_ID. A missing
 * listing has no row at all, only MISSING_LISTING_ID.
 */
export const ownerActionListings = {
  owned: makeListing({ id: 'listing-owned', owner_id: LISTING_OWNER_ID }),
  ownedByOtherUser: makeListing({ id: 'listing-other-owner', owner_id: OTHER_USER_ID }),
  alreadyDeleted: makeListing({
    id: 'listing-deleted',
    owner_id: LISTING_OWNER_ID,
    status: 'deleted',
    published_at: null,
    deleted_at: '2026-10-01T00:00:00.000Z',
  }),
} satisfies Record<string, Listing>;

/**
 * How `delete_listing_with_active_booking_check` refuses each case, as supabase-js hands it
 * back: a plain object, not an `Error`. The messages are the ones the migration raises.
 * Someone else's listing and a missing one get the same answer, so a refusal never confirms
 * that a listing exists.
 */
export const deleteListingRpcErrors = {
  signedOut: { code: '42501', message: 'You must be signed in to delete a listing.', details: null, hint: null },
  notOwner: { code: '42501', message: 'Only the listing owner can delete this listing.', details: null, hint: null },
  missing: { code: '42501', message: 'Only the listing owner can delete this listing.', details: null, hint: null },
  alreadyDeleted: { code: 'P0001', message: 'Listing is already deleted.', details: null, hint: null },
  activeBookings: { code: 'P0001', message: 'Listing has active bookings and cannot be deleted.', details: null, hint: null },
};

export const validListingFormValues: ListingFormValues = {
  title: 'Quiet home near the park',
  location: 'Chiang Mai',
  description: 'A fenced home with plenty of indoor space.',
  capacity: 2,
  acceptedPetTypes: ['dog', 'cat'],
};

export const unsupportedListingPetType = 'dragon' as PetSpecies;

export interface InvalidListingFormCase {
  name: string;
  values: ListingFormValues;
  expectedErrors: ListingFormErrors;
}

export const invalidListingFormCases: readonly InvalidListingFormCase[] = [
  {
    name: 'blank required fields',
    values: { ...validListingFormValues, title: ' ', location: '', description: '\n' },
    expectedErrors: {
      title: 'Listing title is required.',
      location: 'Location is required.',
      description: 'Description is required.',
    },
  },
  {
    name: 'empty capacity',
    values: { ...validListingFormValues, capacity: '' },
    expectedErrors: { capacity: 'Capacity is required.' },
  },
  {
    name: 'zero capacity',
    values: { ...validListingFormValues, capacity: 0 },
    expectedErrors: { capacity: 'Capacity must be at least 1.' },
  },
  {
    name: 'fractional capacity',
    values: { ...validListingFormValues, capacity: 1.5 },
    expectedErrors: { capacity: 'Capacity must be a whole number.' },
  },
  {
    name: 'empty accepted pet types',
    values: { ...validListingFormValues, acceptedPetTypes: [] },
    expectedErrors: { acceptedPetTypes: 'Choose at least one accepted pet type.' },
  },
  {
    name: 'unsupported accepted pet type',
    values: { ...validListingFormValues, acceptedPetTypes: [unsupportedListingPetType] },
    expectedErrors: { acceptedPetTypes: 'Accepted pet types must use a supported option.' },
  },
];
