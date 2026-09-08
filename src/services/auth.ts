import * as Linking from 'expo-linking';

export const getAuthRedirectUrl = () => Linking.createURL('auth/callback');

function readParams(section: string | undefined) {
  const values: Record<string, string> = {};
  section?.split('&').forEach((pair) => {
    const [rawKey, ...rawValue] = pair.split('=');
    if (!rawKey) return;
    values[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.join('=').replace(/\+/g, ' '));
  });
  return values;
}

export function getSessionTokensFromUrl(url: string) {
  const query = url.split('?')[1]?.split('#')[0];
  const fragment = url.split('#')[1];
  const params = { ...readParams(query), ...readParams(fragment) };

  if (params.error || params.error_description) {
    return { error: params.error_description ?? params.error, accessToken: null, refreshToken: null };
  }

  return {
    error: null,
    accessToken: params.access_token ?? null,
    refreshToken: params.refresh_token ?? null,
  };
}
