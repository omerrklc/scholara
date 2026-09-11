import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { authStorage } from '@/services/secureStorage';
import { isSecretSupabaseKey } from '@/services/supabaseKey';
import type { Database } from '@/types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const isStaticWebRender = Platform.OS === 'web' && typeof window === 'undefined';

if (publishableKey && isSecretSupabaseKey(publishableKey)) {
  throw new Error('Refusing to start: a Supabase secret/service-role key cannot be used in an EXPO_PUBLIC variable.');
}

export const supabase: SupabaseClient<Database> | null = url && publishableKey
  ? createClient<Database>(url, publishableKey, {
      auth: {
        ...(isStaticWebRender ? {} : { storage: authStorage }),
        autoRefreshToken: !isStaticWebRender,
        persistSession: !isStaticWebRender,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

export const isSupabaseConfigured = Boolean(supabase);
