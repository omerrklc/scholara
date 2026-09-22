import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/LocalizedText';
import { BrandMark, Button, Card, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import { getAuthRedirectUrl } from '@/services/auth';
import { publicAuthError } from '@/services/authErrors';
import { supabase } from '@/services/supabase';
import { colors, spacing } from '@/theme/tokens';
import { useI18n } from '@/i18n';

export default function VerifyEmailScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const email = Array.isArray(params.email) ? params.email[0] : params.email ?? '';
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    if (!supabase || !email || sending || cooldown > 0) return;
    setSending(true);
    setMessage('');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    setSending(false);
    setIsError(Boolean(error));
    setMessage(error ? publicAuthError(error, 'resend') : 'A new verification email was sent.');
    if (!error) setCooldown(60);
  };

  return <Screen style={styles.container}>
    <BrandMark />
    <View style={styles.iconWrap}><Ionicons name="mail-unread-outline" size={48} color={colors.primary} /></View>
    <SectionTitle eyebrow="One step left" title="Verify that this email address belongs to you." subtitle={t('Open the link we sent to {{email}}, then return to Scholara.', { email: email || t('your email address') })} />
    <Card style={styles.note}>
      <Text style={styles.noteTitle}>Did you see a localhost error on your computer?</Text>
      <Text style={styles.noteText}>Verification probably completed. Return here and use the continue button below.</Text>
    </Card>
    {message ? <MessageBanner message={message} tone={isError ? 'error' : 'success'} /> : null}
    <View style={styles.actions}>
      <Button label="Open email app" onPress={() => void Linking.openURL('mailto:')} />
      <Button label="I verified my email, continue" variant="secondary" onPress={() => router.replace({ pathname: '/sign-in', params: { email } })} />
      <Button label={sending ? 'Sending…' : cooldown > 0 ? t('Resend in {{seconds}}s', { seconds: cooldown }) : 'Resend email'} variant="ghost" disabled={sending || !email || cooldown > 0} onPress={() => void resend()} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  note: { gap: spacing.xs },
  noteTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  noteText: { color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  actions: { gap: spacing.sm, marginTop: 'auto' },
});
