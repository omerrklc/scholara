import type { Profile } from '@/types/domain';
import { supabase } from '@/services/supabase';
import { profileToRow, rowToProfile } from '@/services/profileMapping';
export { profileToRow, rowToProfile, type ProfileRow } from '@/services/profileMapping';

export async function fetchProfile(userId: string) {
  if (!supabase) return { profile: null, completed: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return { profile: null, completed: false, error: error.message };
  if (!data) return { profile: null, completed: false, error: null };
  return { profile: rowToProfile(data), completed: data.onboarding_completed, error: null };
}

export async function saveProfile(profile: Profile, userId: string) {
  if (!supabase) return 'Supabase is not configured.';
  const { error } = await supabase.from('profiles').upsert(profileToRow(profile, userId), { onConflict: 'id' });
  return error?.message ?? null;
}
