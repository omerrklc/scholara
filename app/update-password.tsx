import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BrandMark, Button, MessageBanner, PasswordField, Screen, SectionTitle } from '@/components/ui';
import { publicAuthError } from '@/services/authErrors';
import { supabase } from '@/services/supabase';
import { spacing } from '@/theme/tokens';

export default function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const valid = password.length >= 12 && password === confirmation;

  const updatePassword = async () => {
    if (!supabase || !valid || loading) return;
    setLoading(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(publicAuthError(updateError, 'password-update'));
      return;
    }

    await supabase.auth.signOut({ scope: 'global' });
    setLoading(false);
    router.replace({ pathname: '/sign-in', params: { passwordUpdated: '1' } });
  };

  return <Screen style={styles.container}>
    <BrandMark />
    <SectionTitle eyebrow="Account security" title="Create a new password." subtitle="Use at least 12 characters and avoid passwords you use elsewhere." />
    {error ? <MessageBanner message={error} /> : null}
    <View style={styles.form}>
      <PasswordField label="New password" autoComplete="new-password" maxLength={128} value={password} onChangeText={setPassword} />
      <PasswordField label="Confirm new password" autoComplete="new-password" maxLength={128} value={confirmation} onChangeText={setConfirmation} />
    </View>
    {confirmation && password !== confirmation ? <MessageBanner message="Passwords do not match." tone="info" /> : null}
    <Button label={loading ? 'Updating password…' : 'Update password'} disabled={!valid || loading} onPress={() => void updatePassword()} />
  </Screen>;
}

const styles = StyleSheet.create({ container: { gap: spacing.lg }, form: { gap: spacing.md } });
