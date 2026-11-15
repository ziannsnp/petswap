import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database.types';
import {
  BookingCancellationError,
  BookingCompletionError,
  BookingConflictError,
  BookingExpiredError,
  BookingListingFullError,
  BookingNotFoundError,
  BookingPetUnavailableError,
  BookingStartDateError,
  DuplicateBookingRequestError,
} from './bookingErrors';

export {
  BookingCancellationError,
  BookingCompletionError,
  BookingConflictError,
  BookingExpiredError,
  BookingListingFullError,
  BookingNotFoundError,
  BookingPetUnavailableError,
  BookingStartDateError,
  DuplicateBookingRequestError,
};

export type Booking = Database['public']['Tables']['bookings']['Row'];
export type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

type PetRow = Database['public']['Tables']['pets']['Row'];

/** Care notes travel with the pet so the host can read them on the request (FR-2.2). */
export type BookingPetSummary = Pick<
  PetRow,
  | 'id'
  | 'name'
  | 'species'
  | 'photo_url'
  | 'feeding_instruction'
  | 'medical_note'
  | 'behavior_note'
  | 'allergies'
  | 'vaccination_info'
  | 'special_requirement'
>;
export type BookingListingSummary = Pick<Database['public']['Tables']['listings']['Row'], 'id' | 'title' | 'location'>;

/** A booking plus enough pet/listing context to render FR-5.3's outgoing/incoming lists. */
export type BookingWithDetails = Booking & {
  /**
   * Null when the pet is no longer shared with the viewer: a host keeps access to the requester's
   * pet only while the booking is pending, confirmed, or completed (not after declining it or after
   * the requester cancels).
   */
  pet: BookingPetSummary | null;
  listing: BookingListingSummary;
};

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('You must be signed in to view bookings.');
  }

  return data.user.id;
}

// RLS lets a listing owner read a pet booked at their listing, care columns included.
const BOOKING_PET_SELECT =
  'pet:pets(id, name, species, photo_url, feeding_instruction, medical_note, behavior_note, allergies, vaccination_info, special_requirement)' as const;
const BOOKING_DETAILS_SELECT = `*, ${BOOKING_PET_SELECT}, listing:listings(id, title, location)` as const;

/** Bookings the current user requested, regardless of who owns the listing. */
export async function listOutgoingBookings(): Promise<BookingWithDetails[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await getSupabaseClient()
    .from('bookings')
    .select(BOOKING_DETAILS_SELECT)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/** Bookings made against listings the current user owns, regardless of who requested them. */
export async function listIncomingBookings(): Promise<BookingWithDetails[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await getSupabaseClient()
    .from('bookings')
    .select(`*, ${BOOKING_PET_SELECT}, listing:listings!inner(id, title, location, owner_id)` as const)
    .eq('listing.owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(({ listing, ...booking }) => ({
    ...booking,
    listing: { id: listing.id, title: listing.title, location: listing.location },
  }));
}

export async function createBookingRequest(values: BookingInsert): Promise<Booking> {
  const { data, error } = await getSupabaseClient()
    .from('bookings')
    .insert(values)
    .select()
    .single();

  if (error) {
    // guard_booking_change() judges the start day against the database's UTC day.
    if (error.code === 'P0001' && error.message.includes('start date cannot be in the past')) {
      throw new BookingStartDateError();
    }

    // guard_booking_change() refuses a second identical pending request (double submit or retry).
    if (error.code === 'P0001' && error.message.includes('identical booking request')) {
      throw new DuplicateBookingRequestError();
    }

    throw error;
  }

  return data;
}

export async function updateBookingStatus(
  bookingId: string,
  status: Database['public']['Enums']['booking_status'],
): Promise<Booking> {
  const { data, error } = await getSupabaseClient()
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) {
    // hold_booking_availability is the authoritative, concurrency-safe check (ADR 0011). Its refusals
    // are mapped to fixed copy; the raw error is dropped so nothing about another booking leaks.
    if (status === 'confirmed' && error.code === 'PBC01') {
      throw new BookingListingFullError();
    }
    // PBP01 from the trigger; 23P01 only if the per-pet exclusion backstop ever fires instead.
    if (status === 'confirmed' && (error.code === 'PBP01' || error.code === '23P01')) {
      throw new BookingPetUnavailableError();
    }

    // guard_booking_change() raises P0001 when the stay has not ended or the booking is not confirmed.
    if (status === 'completed' && error.code === 'P0001') {
      throw new BookingCompletionError();
    }

    // ...when a request is confirmed after its start date has passed.
    if (status === 'confirmed' && error.code === 'P0001' && error.message.includes('start date has passed')) {
      throw new BookingExpiredError();
    }

    // ...and when a confirmed stay is cancelled after it has ended.
    if (status === 'cancelled' && error.code === 'P0001' && error.message.includes('stay that has ended')) {
      throw new BookingCancellationError();
    }

    throw error;
  }

  return data;
}

type BookingDetailRow = Database['public']['Functions']['get_booking_detail']['Returns'][number];

/** The pet on a booking, with its care notes. Null on the detail when it is not shared with the viewer. */
export type BookingDetailPet = Pick<
  PetRow,
  | 'id'
  | 'name'
  | 'species'
  | 'breed'
  | 'age_year'
  | 'photo_url'
  | 'description'
  | 'feeding_instruction'
  | 'medical_note'
  | 'behavior_note'
  | 'allergies'
  | 'vaccination_info'
  | 'special_requirement'
> & {
  /** The owner has since removed the pet; the booking keeps it as history. */
  readonly isDeleted: boolean;
};

/** The other participant: never an email address or phone number (ADR 0011). */
export interface BookingDetailPeer {
  readonly id: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly location: string | null;
}

/** Everything the booking-detail screen shows, for one of the booking's two participants. */
export interface BookingDetail {
  readonly id: string;
  readonly status: Database['public']['Enums']['booking_status'];
  readonly startDate: string;
  readonly endDate: string;
  readonly requesterNote: string | null;
  readonly ownerNote: string | null;
  readonly createdAt: string;
  readonly confirmedAt: string | null;
  readonly declinedAt: string | null;
  readonly cancelledAt: string | null;
  readonly completedAt: string | null;
  /** 'requester' sent the request; 'owner' hosts the listing. */
  readonly viewerRole: 'requester' | 'owner';
  readonly listing: {
    readonly id: string;
    readonly title: string;
    readonly location: string;
    /** A draft or deleted listing still shows its booking history. */
    readonly status: Database['public']['Enums']['listing_status'];
  };
  readonly pet: BookingDetailPet | null;
  readonly peer: BookingDetailPeer;
}

function toBookingDetail(row: BookingDetailRow): BookingDetail {
  const pet: BookingDetailPet | null = row.pet_id && row.pet_name && row.pet_species
    ? {
        id: row.pet_id,
        name: row.pet_name,
        species: row.pet_species,
        breed: row.pet_breed,
        age_year: row.pet_age_year,
        photo_url: row.pet_photo_url,
        description: row.pet_description,
        feeding_instruction: row.pet_feeding_instruction,
        medical_note: row.pet_medical_note,
        behavior_note: row.pet_behavior_note,
        allergies: row.pet_allergies,
        vaccination_info: row.pet_vaccination_info,
        special_requirement: row.pet_special_requirement,
        isDeleted: row.pet_deleted === true,
      }
    : null;

  return {
    id: row.id,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    requesterNote: row.requester_note,
    ownerNote: row.owner_note,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    declinedAt: row.declined_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    viewerRole: row.viewer_role === 'owner' ? 'owner' : 'requester',
    listing: {
      id: row.listing_id,
      title: row.listing_title,
      location: row.listing_location,
      status: row.listing_status,
    },
    pet,
    peer: {
      id: row.peer_id,
      displayName: row.peer_display_name,
      photoUrl: row.peer_photo_url,
      location: row.peer_location,
    },
  };
}

/**
 * One booking for its requester or the listing owner (get_booking_detail). Access is decided by the
 * database; anyone else, and an unknown id, get BookingNotFoundError.
 */
export async function getBookingDetail(bookingId: string): Promise<BookingDetail> {
  const { data, error } = await getSupabaseClient().rpc('get_booking_detail', { target_booking_id: bookingId });

  if (error) {
    throw error;
  }

  const [row] = data ?? [];

  if (!row) {
    throw new BookingNotFoundError();
  }

  return toBookingDetail(row);
}
