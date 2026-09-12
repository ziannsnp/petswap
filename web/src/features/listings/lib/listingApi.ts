import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database.types';

export type Listing = Database['public']['Tables']['listings']['Row'] & {
  listing_images: Database['public']['Tables']['listing_images']['Row'][];
  cover_photo_url: string | null;
  /** Public URLs for every image in `listing_images` order, so screens never touch Storage. */
  photo_urls: string[];
};

function addCoverPhotoUrl(
  listing: Database['public']['Tables']['listings']['Row'] & {
    listing_images: Database['public']['Tables']['listing_images']['Row'][];
  },
): Listing {
  const listingImages = [...listing.listing_images].sort((left, right) => left.sort_order - right.sort_order);
  const bucket = getSupabaseClient().storage.from('listing-photos');
  const photoUrls = listingImages.map((image) => bucket.getPublicUrl(image.storage_path).data.publicUrl);

  return {
    ...listing,
    listing_images: listingImages,
    cover_photo_url: photoUrls[0] ?? null,
    photo_urls: photoUrls,
  };
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
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from('listings')
    .select('*, listing_images(*)')
    .eq('owner_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(addCoverPhotoUrl);
}
