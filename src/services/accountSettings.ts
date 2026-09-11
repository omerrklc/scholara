import { supabase } from '@/services/supabase';

export type NotificationPreferences = { matches: boolean; messages: boolean; community: boolean; productUpdates: boolean };
export type PrivacyPreferences = { currentLocation: boolean; relocationDestination: boolean; relocationDate: boolean };
export type LegalDocumentKey = 'terms' | 'privacy' | 'community_guidelines';
export type AccountSettings = {
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  legal: Record<LegalDocumentKey, { version: string; accepted: boolean }>;
  latestExport: { id: string; status: string; requestedAt: string } | null;
};

export const defaultAccountSettings: AccountSettings = {
  notifications: { matches: true, messages: true, community: true, productUpdates: false },
  privacy: { currentLocation: false, relocationDestination: false, relocationDate: false },
  legal: {
    terms: { version: '', accepted: false }, privacy: { version: '', accepted: false },
    community_guidelines: { version: '', accepted: false },
  },
  latestExport: null,
};

export async function fetchAccountSettings() {
  if (!supabase) return { settings: null, error: 'Account settings are not configured.' };
  const { data, error } = await supabase.rpc('get_account_settings');
  return error
    ? { settings: null, error: 'Account settings could not be loaded.' }
    : { settings: { ...defaultAccountSettings, ...(data as Partial<AccountSettings>) }, error: null };
}

export async function updateNotificationPreferences(value: NotificationPreferences) {
  if (!supabase) return 'Account settings are not configured.';
  const { error } = await supabase.rpc('update_notification_preferences', {
    matches_enabled: value.matches, messages_enabled: value.messages,
    community_enabled: value.community, product_updates_enabled: value.productUpdates,
  });
  return error ? 'Notification preferences could not be saved.' : null;
}

export async function updatePrivacyPreferences(value: PrivacyPreferences) {
  if (!supabase) return 'Account settings are not configured.';
  const { error } = await supabase.rpc('update_profile_privacy', {
    current_location_visible: value.currentLocation,
    relocation_destination_visible: value.relocationDestination,
    relocation_date_visible: value.relocationDate,
  });
  return error ? 'Privacy preferences could not be saved.' : null;
}

export async function acceptCurrentLegalDocuments() {
  if (!supabase) return 'Account settings are not configured.';
  const { error } = await supabase.rpc('accept_current_legal_documents');
  return error ? 'Your acceptance could not be recorded.' : null;
}

export async function createDataExportRequest() {
  if (!supabase) return { id: null, error: 'Account settings are not configured.' };
  const { data, error } = await supabase.rpc('request_data_export');
  return error ? { id: null, error: 'Your export request could not be created.' } : { id: data as string, error: null };
}

export async function permanentlyDeleteAccount(email: string, password: string) {
  if (!supabase) return 'Account settings are not configured.';
  const reauth = await supabase.auth.signInWithPassword({ email, password });
  if (reauth.error) return 'Your password is incorrect.';
  const { error } = await supabase.rpc('delete_my_account', { confirmation: 'DELETE' });
  if (error) return 'Your account could not be deleted. Please try again.';
  await supabase.auth.signOut({ scope: 'local' });
  return null;
}
