import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandMark, Button, Field, Screen, SectionTitle } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const valid = email.includes('@') && password.length >= 6;
  return <Screen style={styles.container}>
    <BrandMark />
    <SectionTitle eyebrow="Welcome back" title="Continue your academic network." subtitle="Phase 1 uses a local demo session. Supabase authentication plugs into this screen in the next phase." />
    <View style={styles.form}><Field label="Email" autoCapitalize="none" keyboardType="email-address" placeholder="you@university.edu" value={email} onChangeText={setEmail} /><Field label="Password" secureTextEntry placeholder="At least 6 characters" value={password} onChangeText={setPassword} /><Text style={styles.forgot}>Forgot password?</Text></View>
    <Button label="Sign in" disabled={!valid} onPress={() => router.replace('/(tabs)/discover')} />
    <Button label="Create a new profile" variant="ghost" onPress={() => router.replace('/onboarding')} />
  </Screen>;
}

const styles = StyleSheet.create({ container: { gap: spacing.xl }, form: { gap: spacing.md }, forgot: { alignSelf: 'flex-end', color: colors.primary, fontWeight: '700' } });
