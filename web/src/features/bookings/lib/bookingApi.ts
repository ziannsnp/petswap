import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database.types';

export type Booking = Database['public']['Tables']['bookings']['Row'];
export type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

export type BookingPetSummary = Pick<Database['public']['Tables']['pets']['Row'], 'id' | 'name' | 'species' | 'photo_url'>;
export type BookingListingSummary = Pick<Database['public']['Tables']['listings']['Row'], 'id' | 'title' | 'location'>;

/** A booking plus enough pet/listing context to render FR-5.3's outgoing/incoming lists. */
export type BookingWithDetails = Booking & {
  pet: BookingPetSummary;
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

const BOOKING_DETAILS_SELECT = '*, pet:pets(id, name, species, photo_url), listing:listings(id, title, location)';

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
    .select('*, pet:pets(id, name, species, photo_url), listing:listings!inner(id, title, location, owner_id)')
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
    throw error;
  }

  return data;
}
