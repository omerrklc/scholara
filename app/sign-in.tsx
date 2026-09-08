import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BrandMark, Button, Field, MessageBanner, PasswordField, Screen, SectionTitle } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { colors, spacing } from '@/theme/tokens';

export default function SignInScreen() {
  const { height, width } = useWindowDimensions();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = Array.isArray(params.email) ? params.email[0] : params.email ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const valid = email.includes('@') && password.length >= 8;

  const signIn = async () => {
    if (!supabase || !valid) return;
    setLoading(true);
    setMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setLoading(false);
      setIsError(true);
      setMessage(error.message);
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
    if (!supabase || !email.includes('@')) {
      setIsError(true);
      setMessage('Enter your email address first.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setLoading(false);
    setIsError(Boolean(error));
    setMessage(error?.message ?? 'Password reset email sent.');
  };

  const compact = height < 720 || width < 380;

  return <Screen style={[styles.container, compact && styles.containerCompact]}>
    <BrandMark />
    <SectionTitle eyebrow="Welcome back" title="Continue your academic network." subtitle="Sign in securely with your Scholara account." />
    {message ? <MessageBanner message={message} tone={isError ? 'error' : 'success'} /> : null}
    <View style={styles.form}>
      <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@university.edu" value={email} onChangeText={setEmail} />
      <PasswordField label="Password" autoComplete="current-password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} />
      <Pressable accessibilityRole="button" onPress={() => void resetPassword()}><Text style={styles.forgot}>Forgot password?</Text></Pressable>
    </View>
    <Button label={loading ? 'Please wait…' : 'Sign in'} disabled={!valid || loading} onPress={() => void signIn()} />
    <Button label="Create a new account" variant="ghost" onPress={() => router.replace('/sign-up')} />
  </Screen>;
}

const styles = StyleSheet.create({ container: { gap: spacing.lg }, containerCompact: { gap: spacing.sm }, form: { gap: spacing.md }, forgot: { alignSelf: 'flex-end', color: colors.primary, fontWeight: '700' } });
