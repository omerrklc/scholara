import { supabase } from '@/services/supabase';
import { createProfilePhotoUrls } from '@/services/profilePhotos';
import { rowToProfile, type ProfileRow } from '@/services/profiles';
import type { Profile } from '@/types/domain';

export { rankResearchers, toResearcher } from '@/services/discoveryMatching';

type DiscoveryProfile = Profile & { id: string; avatarUrl?: string };
type DiscoveryProfileRow = Pick<ProfileRow,
  'full_name' | 'avatar_path' | 'academic_stage' | 'university' | 'department' | 'program' |
  'institution_ror_id' | 'institution_country_code' |
  'research_description' | 'research_interests' | 'intents' | 'current_city' |
  'current_country' | 'current_city_geonames_id' | 'current_country_code' | 'is_relocating' | 'destination_city' | 'destination_country' |
  'destination_city_geonames_id' | 'destination_country_code' |
  'relocation_date'
> & { id: string };

export async function fetchDiscoveryProfiles(currentUserId: string) {
  if (!supabase) return { profiles: [] as DiscoveryProfile[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('discover_profiles');

  if (error) return { profiles: [] as DiscoveryProfile[], error: error.message };
  const rows = (data as unknown as DiscoveryProfileRow[]).filter((row) => row.id !== currentUserId);
  const photoUrls = await createProfilePhotoUrls(rows.map((row) => row.avatar_path ?? ''));
  const profiles = rows
    .map((row) => ({
      id: row.id,
      avatarUrl: row.avatar_path ? photoUrls.get(row.avatar_path) : undefined,
      ...rowToProfile({
        ...row,
        username: '',
        languages: [],
        onboarding_completed: true,
      }),
    }));
  return { profiles, error: null };
}
