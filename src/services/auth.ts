import * as Linking from 'expo-linking';
import { parseAuthCallback } from '@/services/authCallback';

export const getAuthRedirectUrl = () => Linking.createURL('auth/callback');

export function getAuthCodeFromUrl(url: string) {
  return parseAuthCallback(Linking.parse(url), Linking.parse(getAuthRedirectUrl()));
}
