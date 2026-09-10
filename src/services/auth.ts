import * as Linking from 'expo-linking';

export const getAuthRedirectUrl = () => Linking.createURL('auth/callback');

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizedPath(path: string | null) {
  return (path ?? '').replace(/^\/+|\/+$/g, '');
}

export function getAuthCodeFromUrl(url: string) {
  const expected = Linking.parse(getAuthRedirectUrl());
  const actual = Linking.parse(url);
  const validCallback = actual.scheme === expected.scheme
    && actual.hostname === expected.hostname
    && normalizedPath(actual.path) === normalizedPath(expected.path);

  if (!validCallback) {
    return { code: null, error: 'Invalid authentication callback URL.' };
  }

  const error = singleParam(actual.queryParams?.error_description) ?? singleParam(actual.queryParams?.error);
  if (error) return { code: null, error };

  const code = singleParam(actual.queryParams?.code);
  if (!code) return { code: null, error: 'The authentication code is missing or expired.' };

  return { code, error: null };
}
