type AuthAction = 'sign-in' | 'sign-up' | 'resend' | 'password-reset' | 'password-update';

const fallback: Record<AuthAction, string> = {
  'sign-in': 'Email or password is incorrect.',
  'sign-up': 'Your account could not be created. Please check your details and try again.',
  resend: 'The verification email could not be sent. Please wait and try again.',
  'password-reset': 'The reset request could not be completed. Please wait and try again.',
  'password-update': 'Your password could not be updated. Please try again.',
};

export function publicAuthError(error: { message?: string; status?: number } | null, action: AuthAction) {
  const message = error?.message?.toLowerCase() ?? '';
  if (error?.status === 429 || message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Connection problem. Check your internet and try again.';
  }
  if (action === 'password-update' && message.includes('same password')) {
    return 'Choose a password you have not used before.';
  }
  return fallback[action];
}
