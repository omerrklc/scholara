function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizedPath(path: string | null) {
  return (path ?? '').replace(/^\/+|\/+$/g, '');
}

export type ParsedAuthUrl = {
  scheme: string | null;
  hostname: string | null;
  path: string | null;
  queryParams?: Record<string, string | string[] | undefined> | null;
};

export function getAllowedAuthNext(value: string | string[] | undefined) {
  return singleParam(value) === '/update-password' ? '/update-password' as const : '/onboarding' as const;
}

export function consumeAuthCodeOnce(processedCodes: Set<string>, code: string) {
  if (processedCodes.has(code)) return false;
  processedCodes.add(code);
  return true;
}

export function parseAuthCallback(actual: ParsedAuthUrl, expected: ParsedAuthUrl) {
  const validCallback = actual.scheme === expected.scheme
    && actual.hostname === expected.hostname
    && normalizedPath(actual.path) === normalizedPath(expected.path);

  if (!validCallback) {
    return { code: null, nextRoute: '/onboarding' as const, error: 'Invalid authentication callback URL.' };
  }

  const error = singleParam(actual.queryParams?.error_description) ?? singleParam(actual.queryParams?.error);
  const nextRoute = getAllowedAuthNext(actual.queryParams?.next);
  if (error) return { code: null, nextRoute, error };

  const code = singleParam(actual.queryParams?.code);
  if (!code) return { code: null, nextRoute, error: 'The authentication code is missing or expired.' };

  return { code, nextRoute, error: null };
}
