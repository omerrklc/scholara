import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const isStaticWebRender = Platform.OS === 'web' && typeof window === 'undefined';

function isSecretSupabaseKey(key: string) {
  if (key.toLowerCase().startsWith('sb_secret_')) return true;
  if (!key.startsWith('eyJ')) return false;

  try {
    const payload = key.split('.')[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const claims = JSON.parse(globalThis.atob(padded)) as { role?: unknown };
    return claims.role === 'service_role' || claims.role === 'supabase_admin';
  } catch {
    return false;
  }
}

if (publishableKey && isSecretSupabaseKey(publishableKey)) {
  throw new Error('Refusing to start: a Supabase secret/service-role key cannot be used in an EXPO_PUBLIC variable.');
}

export const supabase: SupabaseClient | null = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: {
        ...(isStaticWebRender ? {} : { storage: AsyncStorage }),
        autoRefreshToken: !isStaticWebRender,
        persistSession: !isStaticWebRender,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

export const isSupabaseConfigured = Boolean(supabase);
