import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandMark, Button, Card, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import { getAuthRedirectUrl } from '@/services/auth';
import { supabase } from '@/services/supabase';
import { colors, spacing } from '@/theme/tokens';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const email = Array.isArray(params.email) ? params.email[0] : params.email ?? '';
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const resend = async () => {
    if (!supabase || !email || sending) return;
    setSending(true);
    setMessage('');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    setSending(false);
    setIsError(Boolean(error));
    setMessage(error?.message ?? 'Yeni doğrulama e-postası gönderildi.');
  };

  return <Screen style={styles.container}>
    <BrandMark />
    <View style={styles.iconWrap}><Ionicons name="mail-unread-outline" size={48} color={colors.primary} /></View>
    <SectionTitle eyebrow="Bir adım kaldı" title="E-posta adresinin sana ait olduğunu doğrula." subtitle={`${email || 'E-posta adresine'} gönderdiğimiz bağlantıya dokun. Ardından Scholara'ya geri dön.`} />
    <Card style={styles.note}>
      <Text style={styles.noteTitle}>Bilgisayarda localhost hatası mı gördün?</Text>
      <Text style={styles.noteText}>Doğrulama büyük olasılıkla tamamlandı. Bu ekrana dönüp aşağıdaki devam düğmesine basabilirsin.</Text>
    </Card>
    {message ? <MessageBanner message={message} tone={isError ? 'error' : 'success'} /> : null}
    <View style={styles.actions}>
      <Button label="E-posta uygulamasını aç" onPress={() => void Linking.openURL('mailto:')} />
      <Button label="E-postayı onayladım, devam et" variant="secondary" onPress={() => router.replace({ pathname: '/sign-in', params: { email } })} />
      <Button label={sending ? 'Gönderiliyor…' : 'E-postayı yeniden gönder'} variant="ghost" disabled={sending || !email} onPress={() => void resend()} />
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
