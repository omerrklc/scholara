import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BrandMark, Button, Field, MessageBanner, PasswordField, Screen, SectionTitle } from '@/components/ui';
import { publicAuthError } from '@/services/authErrors';
import { getPasswordResetRedirectUrl } from '@/services/passwordReset';
import { supabase } from '@/services/supabase';
import { colors, spacing } from '@/theme/tokens';

export default function SignInScreen() {
  const { height, width } = useWindowDimensions();
  const params = useLocalSearchParams<{ email?: string | string[]; passwordUpdated?: string | string[] }>();
  const initialEmail = Array.isArray(params.email) ? params.email[0] : params.email ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordUpdated = (Array.isArray(params.passwordUpdated) ? params.passwordUpdated[0] : params.passwordUpdated) === '1';
  const [message, setMessage] = useState(passwordUpdated ? 'Password updated. Sign in with your new password.' : '');
  const [isError, setIsError] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const valid = email.includes('@') && password.length >= 8;

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setTimeout(() => setResetCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resetCooldown]);

  const signIn = async () => {
    if (!supabase || !valid) return;
    setLoading(true);
    setMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setLoading(false);
      setIsError(true);
      setMessage(publicAuthError(error, 'sign-in'));
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', data.user.id)
      .maybeSingle();
    setLoading(false);
    if (profileError) {
      setIsError(true);
      setMessage('The database setup is not complete yet. Apply the Phase 2 migration in Supabase.');
      return;
    }
    router.replace(profileData?.onboarding_completed ? '/(tabs)/discover' : '/onboarding');
  };

  const resetPassword = async () => {
    if (!supabase || resetCooldown > 0) return;
    if (!email.includes('@')) {
      setIsError(true);
      setMessage('Enter your email address first.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    setLoading(false);
    setResetCooldown(60);
    if (error?.status === 429) {
      setIsError(true);
      setMessage(publicAuthError(error, 'password-reset'));
      return;
    }
    setIsError(false);
    setMessage('If an account exists for this email, a password reset link has been sent.');
  };

  const compact = height < 720 || width < 380;

  return <Screen style={[styles.container, compact && styles.containerCompact]}>
    <BrandMark />
    <SectionTitle eyebrow="Welcome back" title="Continue your academic network." subtitle="Sign in securely with your Scholara account." />
    {message ? <MessageBanner message={message} tone={isError ? 'error' : 'success'} /> : null}
    <View style={styles.form}>
      <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" maxLength={320} placeholder="you@university.edu" value={email} onChangeText={setEmail} />
      <PasswordField label="Password" autoComplete="current-password" maxLength={128} placeholder="Your password" value={password} onChangeText={setPassword} />
      <Pressable accessibilityRole="button" disabled={resetCooldown > 0} onPress={() => void resetPassword()}><Text style={[styles.forgot, resetCooldown > 0 && styles.forgotDisabled]}>{resetCooldown > 0 ? `Try reset again in ${resetCooldown}s` : 'Forgot password?'}</Text></Pressable>
    </View>
    <Button label={loading ? 'Please wait…' : 'Sign in'} disabled={!valid || loading} onPress={() => void signIn()} />
    <Button label="Create a new account" variant="ghost" onPress={() => router.replace('/sign-up')} />
  </Screen>;
}

const styles = StyleSheet.create({ container: { gap: spacing.lg }, containerCompact: { gap: spacing.sm }, form: { gap: spacing.md }, forgot: { alignSelf: 'flex-end', color: colors.primary, fontWeight: '700' }, forgotDisabled: { color: colors.inkMuted } });
