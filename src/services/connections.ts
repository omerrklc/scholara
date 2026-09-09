import { supabase } from '@/services/supabase';

export type ConnectionState = 'sent' | 'received' | 'matched';

type ConnectionRow = {
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted';
};

export async function fetchDiscoveryActions(userId: string) {
  if (!supabase) return { saved: [] as string[], connectionStates: {} as Record<string, ConnectionState>, error: 'Supabase is not configured.' };

  const [savedResult, connectionsResult] = await Promise.all([
    supabase.from('saved_profiles').select('saved_profile_id').eq('user_id', userId),
    supabase.from('connection_requests').select('requester_id, recipient_id, status'),
  ]);

  const error = savedResult.error ?? connectionsResult.error;
  if (error) return { saved: [] as string[], connectionStates: {} as Record<string, ConnectionState>, error: 'Your saved profiles and connections could not be loaded.' };

  const connectionStates: Record<string, ConnectionState> = {};
  for (const row of (connectionsResult.data ?? []) as ConnectionRow[]) {
    const otherUserId = row.requester_id === userId ? row.recipient_id : row.requester_id;
    connectionStates[otherUserId] = row.status === 'accepted'
      ? 'matched'
      : row.requester_id === userId ? 'sent' : 'received';
  }

  return {
    saved: (savedResult.data ?? []).map((row) => row.saved_profile_id as string),
    connectionStates,
    error: null,
  };
}

export async function setSavedProfile(userId: string, savedProfileId: string, shouldSave: boolean) {
  if (!supabase) return 'Supabase is not configured.';

  const result = shouldSave
    ? await supabase.from('saved_profiles').insert({ user_id: userId, saved_profile_id: savedProfileId })
    : await supabase.from('saved_profiles').delete().eq('user_id', userId).eq('saved_profile_id', savedProfileId);

  if (result.error?.code === '23505') return null;
  return result.error ? 'Your saved profiles could not be updated.' : null;
}

export async function requestConnection(targetUserId: string) {
  if (!supabase) return { state: null, error: 'Supabase is not configured.' } as const;

  const { data, error } = await supabase.rpc('request_connection', { target_user_id: targetUserId });
  if (error) return { state: null, error: 'Your connection request could not be sent.' } as const;

  return {
    state: data === 'matched' ? 'matched' as const : 'sent' as const,
    error: null,
  };
}
