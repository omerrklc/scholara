import * as Linking from 'expo-linking';

// The PKCE callback implementation must allowlist this exact next route.
export const getPasswordResetRedirectUrl = () => Linking.createURL('auth/callback', {
  queryParams: { next: '/update-password' },
});
