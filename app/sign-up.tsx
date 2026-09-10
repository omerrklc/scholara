import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { BrandMark, Button, Field, MessageBanner, PasswordField, Screen, SectionTitle } from '@/components/ui';
import { getAuthRedirectUrl } from '@/services/auth';
import { publicAuthError } from '@/services/authErrors';
import { supabase } from '@/services/supabase';
import { spacing } from '@/theme/tokens';

export default function SignUpScreen() {
  const { height, width } = useWindowDimensions();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const valid = fullName.trim().length >= 2 && email.includes('@') && password.length >= 12;

  const signUp = async () => {
    if (!supabase || !valid) return;
    setLoading(true);
    setError('');
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(publicAuthError(signUpError, 'sign-up'));
      return;
    }
    if (data.session) {
      router.replace('/onboarding');
      return;
    }
    router.replace({ pathname: '/verify-email', params: { email: email.trim().toLowerCase() } });
  };

  const compact = height < 760 || width < 380;

  return <Screen style={[styles.container, compact && styles.containerCompact]}>
    <BrandMark />
    <SectionTitle eyebrow="Create account" title="Start with your academic identity." subtitle="Use an email address you can access. University verification will be added later." />
    {error ? <MessageBanner message={error} /> : null}
    <View style={styles.form}>
      <Field label="Full name" autoComplete="name" maxLength={100} placeholder="Your full name" value={fullName} onChangeText={setFullName} />
      <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" maxLength={320} placeholder="you@university.edu" value={email} onChangeText={setEmail} />
      <PasswordField label="Password" autoComplete="new-password" maxLength={128} placeholder="At least 12 characters" value={password} onChangeText={setPassword} />
    </View>
    <Button label={loading ? 'Creating account…' : 'Create account'} disabled={!valid || loading} onPress={() => void signUp()} />
    <Button label="I already have an account" variant="ghost" onPress={() => router.replace('/sign-in')} />
  </Screen>;
}

const styles = StyleSheet.create({ container: { gap: spacing.lg }, containerCompact: { gap: spacing.sm }, form: { gap: spacing.md } });
