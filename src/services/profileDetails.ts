import type { ConnectionState } from '@/services/connections';
import { createProfilePhotoUrl } from '@/services/profilePhotos';
import { rowToProfile, type ProfileRow } from '@/services/profileMapping';
import { supabase } from '@/services/supabase';
import type { Profile } from '@/types/domain';

export type ProfileDetail = {
  id: string;
  profile: Profile;
  avatarUrl?: string;
  connectionState: ConnectionState | null;
  viewerSaved: boolean;
};

type ProfileDetailRow = ProfileRow & {
  id: string;
  avatar_path: string;
  connection_state: 'none' | ConnectionState;
  viewer_saved: boolean;
};

export async function fetchProfileDetail(targetProfileId: string) {
  if (!supabase) return { detail: null as ProfileDetail | null, error: 'Profile details are not configured.' };

  const { data, error } = await supabase.rpc('get_profile_detail', { target_profile_id: targetProfileId }).maybeSingle();
  if (error) return { detail: null as ProfileDetail | null, error: 'This profile could not be loaded.' };
  if (!data) return { detail: null as ProfileDetail | null, error: 'This profile is unavailable.' };

  const row = data as unknown as ProfileDetailRow;
  const avatarUrl = await createProfilePhotoUrl(row.avatar_path);
  return {
    detail: {
      id: row.id,
      profile: rowToProfile({ ...row, onboarding_completed: true }),
      avatarUrl: avatarUrl ?? undefined,
      connectionState: row.connection_state === 'none' ? null : row.connection_state,
      viewerSaved: row.viewer_saved,
    },
    error: null,
  };
}
