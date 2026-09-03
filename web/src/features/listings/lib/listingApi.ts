import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database.types';

export type Listing = Database['public']['Tables']['listings']['Row'] & {
  listing_images: Database['public']['Tables']['listing_images']['Row'][];
  cover_photo_url: string | null;
};

function addCoverPhotoUrl(
  listing: Database['public']['Tables']['listings']['Row'] & {
    listing_images: Database['public']['Tables']['listing_images']['Row'][];
  },
): Listing {
  const listingImages = [...listing.listing_images].sort((left, right) => left.sort_order - right.sort_order);
  const coverImage = listingImages[0];
  const coverPhotoUrl = coverImage
    ? getSupabaseClient().storage.from('listing-photos').getPublicUrl(coverImage.storage_path).data.publicUrl
    : null;

  return { ...listing, listing_images: listingImages, cover_photo_url: coverPhotoUrl };
}

export async function listPublishedListings(): Promise<Listing[]> {
  const { data, error } = await getSupabaseClient()
    .from('listings')
    .select('*, listing_images(*)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(addCoverPhotoUrl);
}

export async function listMyListings(): Promise<Listing[]> {
  const { data, error } = await getSupabaseClient()
    .from('listings')
    .select('*, listing_images(*)')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(addCoverPhotoUrl);
}
