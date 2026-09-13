import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Pick<
  Database['public']['Tables']['profiles']['Update'],
  'display_name' | 'phone_number' | 'location' | 'photo_url'
>;

const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function avatarStoragePath(userId: string): string {
  return `${userId}/avatar`;
}

function assertSupportedAvatarType(file: Pick<File, 'type'>): void {
  const normalizedType = file.type.trim().toLowerCase();
  if (!AVATAR_MIME_TYPES.has(normalizedType)) {
    throw new Error('Unsupported avatar type. Choose a JPG, PNG, WebP, or GIF image.');
  }
}

function cacheBustedPublicUrl(publicUrl: string): string {
  const url = new URL(publicUrl);
  url.searchParams.set('v', Date.now().toString());
  return url.toString();
}

/** Returns the authenticated user's profile, or null when no session exists. */
export async function getProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await getSupabaseClient().auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    return null;
  }

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Updates only the authenticated user's profile. RLS remains the authorization boundary;
 * the id predicate keeps the client request scoped to that same user.
 */
export async function updateProfile(values: ProfileUpdate): Promise<Profile> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error('You must be signed in to update your profile.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userData.user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Replaces the authenticated user's avatar and returns a cache-busted public URL.
 * Persist the result with updateProfile({ photo_url: publicUrl }).
 */
export const AVATAR_MAX_BYTES = 10_485_760; // 10 MB limit matching Supabase Storage bucket
export async function uploadAvatar(file: File): Promise<string> {
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error('Avatar image must be smaller than 10 MB.');
  }
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error('You must be signed in to upload an avatar.');
  }

  assertSupportedAvatarType(file);
  // A fixed object path prevents a JPG-to-PNG replacement leaving the old public object behind.
  const storagePath = avatarStoragePath(userData.user.id);
  const avatarBucket = supabase.storage.from('avatars');
  const { error: uploadError } = await avatarBucket.upload(storagePath, file, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = avatarBucket.getPublicUrl(storagePath);
  if (!data.publicUrl) {
    throw new Error('Could not create a public URL for the uploaded avatar.');
  }

  return cacheBustedPublicUrl(data.publicUrl);
}

/** Removes the authenticated user's avatar object. Clear photo_url separately when needed. */
export async function deleteAvatar(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error('You must be signed in to delete an avatar.');
  }

  const { error } = await supabase.storage.from('avatars').remove([avatarStoragePath(userData.user.id)]);
  if (error) {
    throw error;
  }
}

/** @deprecated Use getProfile. Retained for the existing profile query hook. */
export const getCurrentProfile = getProfile;
