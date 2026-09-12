import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Pick<
  Database['public']['Tables']['profiles']['Update'],
  'display_name' | 'username' | 'phone_number' | 'location' | 'photo_url'
>;

const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function avatarStoragePath(userId: string, file: Pick<File, 'type'>): string {
  if (!AVATAR_MIME_TYPES.has(file.type)) {
    throw new Error('Unsupported avatar type. Choose a JPG, PNG, WebP, or GIF image.');
  }

  // A fixed object path prevents a JPG-to-PNG replacement leaving the old public object behind.
  return `${userId}/avatar`;
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
 * Replaces the authenticated user's avatar and returns its stable public URL.
 * Persist the result with updateProfile({ photo_url: publicUrl }).
 */
export async function uploadAvatar(file: File): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error('You must be signed in to upload an avatar.');
  }

  const storagePath = avatarStoragePath(userData.user.id, file);
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

  return data.publicUrl;
}

/** @deprecated Use getProfile. Retained for the existing profile query hook. */
export const getCurrentProfile = getProfile;
