import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await getSupabaseClient().auth.getUser();

  if (userError || !userData.user) {
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
