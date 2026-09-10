# Scholara security setup

Repository protections are only half of the authentication setup. Before a public beta, complete these project-level settings in Supabase.

## Bot and abuse protection

1. In **Authentication → Bot and Abuse Protection**, configure Cloudflare Turnstile or hCaptcha.
2. Add the provider's **secret key** only in Supabase. Never place it in an `EXPO_PUBLIC_` variable.
3. Add the public site key to the app only after the mobile CAPTCHA component has been selected and tested in an Expo development build.
4. Do not enable CAPTCHA in production until sign-up, sign-in, and password-reset requests all send a valid `captchaToken`; otherwise those flows will stop working.

Reference: https://supabase.com/docs/guides/auth/auth-captcha

## Rate limits and email

1. Review **Authentication → Rate Limits** before inviting external testers.
2. Keep at least the default per-user 60-second signup-confirmation and password-reset cooldowns.
3. Configure custom SMTP before raising the project-wide email limit.
4. Monitor Auth audit logs for repeated failures and `429` responses.

Reference: https://supabase.com/docs/guides/auth/rate-limits

## Password policy

1. Set the minimum password length to at least 12 characters before public launch.
2. Enable leaked-password protection when it is available for the project plan.
3. Keep email confirmation enabled.

Reference: https://supabase.com/docs/guides/auth/password-security

## Password reset callback contract

The app sends recovery links to `auth/callback?next=/update-password`. The PKCE callback work must allowlist only `/update-password` for this parameter, exchange the one-time code, and then navigate there. Never navigate to an arbitrary `next` value.

## Automated checks

- `pnpm test` runs client security regression tests.
- `supabase test db` runs pgTAP database tests when the local Supabase stack is available.
- Type checking, linting, and an Expo export should also pass before merging.
