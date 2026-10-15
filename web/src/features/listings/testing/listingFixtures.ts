import type { Database } from '@/shared/types/database.types';
import type { Listing, ListingHost, ListingImage } from '../lib/listingApi';
import { ListingError } from '../lib/listingErrors';
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
  return { ...makeListingRow(), listing_images: [], cover_photo_url: null, host: null, ...overrides };
}

/** A listing photo as the adapters return it: stored metadata plus a short-lived signed URL. */
export function makeListingImage(overrides: Partial<ListingImage> = {}): ListingImage {
  const id = overrides.id ?? 'image-1';
  return {
    id,
    listing_id: 'listing-1',
    storage_path: `listing-1/${id}.jpg`,
    alt_text: null,
    sort_order: 0,
    created_at: '2026-09-01T00:00:00.000Z',
    signed_url: `https://storage.test/signed/listing-1/${id}.jpg`,
    ...overrides,
  };
}

export const LISTING_OWNER_ID = 'owner-1';
export const OTHER_USER_ID = 'owner-2';
export const MISSING_LISTING_ID = 'listing-missing';

/**
 * One listing per visibility case on the detail page, seen from LISTING_OWNER_ID. A missing
 * listing has no row at all, only MISSING_LISTING_ID.
 */
export const detailVisibilityListings = {
  published: makeListing({ id: 'listing-published', owner_id: LISTING_OWNER_ID }),
  draft: makeListing({
    id: 'listing-draft',
    owner_id: LISTING_OWNER_ID,
    status: 'draft',
    published_at: null,
  }),
  deleted: makeListing({
    id: 'listing-deleted',
    owner_id: LISTING_OWNER_ID,
    status: 'deleted',
    published_at: null,
    deleted_at: '2026-10-01T00:00:00.000Z',
  }),
} satisfies Record<string, Listing>;

/**
 * How `getListing` refuses a listing the viewer may not see, with the messages it throws.
 * RLS hides someone else's draft, so it fails exactly like a missing id and the refusal
 * never confirms that a private listing exists.
 */
export const detailUnavailableErrors = {
  missing: new ListingError('not_found', 'This listing is unavailable.'),
  otherUsersDraft: new ListingError('not_found', 'This listing is unavailable.'),
  deleted: new ListingError('deleted', 'This listing is no longer available.'),
};

/** Host projections the detail page can receive; a listing without one has `host: null`. */
export const listingHosts = {
  withPhoto: {
    id: LISTING_OWNER_ID,
    display_name: 'Alex Rivera',
    photo_url: 'https://storage.test/avatars/owner-1.jpg',
    location: 'Chiang Mai',
  },
  withoutPhoto: { id: LISTING_OWNER_ID, display_name: 'Alex Rivera', photo_url: null, location: 'Chiang Mai' },
  withoutLocation: { id: LISTING_OWNER_ID, display_name: 'Alex Rivera', photo_url: null, location: null },
} satisfies Record<string, ListingHost>;

/** Stored facility text: one label per line, as `serializeFacilities` writes it. */
export const listingFacilities = {
  several: 'Lawn\nEnclosed fence\nDaily photo updates',
  withBlankLines: '  Lawn \n\nSecurity cameras\n',
  none: null,
};

/**
 * Photo sets in gallery order, main photo first. A photo whose signing failed arrives with
 * `signed_url: null`; a photo that fails to load in the browser is simulated in the test by
 * firing an error on its image.
 */
export const listingPhotoSets = {
  multiple: [
    makeListingImage({ id: 'image-1', sort_order: 0, alt_text: 'Fenced garden' }),
    makeListingImage({ id: 'image-2', sort_order: 1 }),
    makeListingImage({ id: 'image-3', sort_order: 2, alt_text: 'Guest room' }),
  ],
  none: [],
  signingFailed: [
    makeListingImage({ id: 'image-1', sort_order: 0, signed_url: null }),
    makeListingImage({ id: 'image-2', sort_order: 1, signed_url: null }),
  ],
} satisfies Record<string, ListingImage[]>;

/** Published listings that exercise every section of the detail page. */
export const detailContentListings = {
  complete: makeListing({
    id: 'listing-complete',
    facilities: listingFacilities.several,
    listing_images: listingPhotoSets.multiple,
    cover_photo_url: listingPhotoSets.multiple[0].signed_url,
    host: listingHosts.withPhoto,
  }),
  bare: makeListing({
    id: 'listing-bare',
    facilities: listingFacilities.none,
    listing_images: listingPhotoSets.none,
    cover_photo_url: null,
    host: null,
  }),
  photosUnavailable: makeListing({
    id: 'listing-photos-unavailable',
    listing_images: listingPhotoSets.signingFailed,
    cover_photo_url: null,
    host: listingHosts.withoutPhoto,
  }),
} satisfies Record<string, Listing>;

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

/**
 * What supabase-js hands back when the network is down. Neither is the browser's TypeError:
 * PostgREST resolves with a plain object and auth with an AuthRetryableFetchError.
 */
export const networkFailures = {
  postgrest: { code: '', message: 'TypeError: Failed to fetch', details: 'TypeError: Failed to fetch', hint: '' },
  auth: Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 }),
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
