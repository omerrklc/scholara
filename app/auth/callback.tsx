import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BrandMark, Button, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import { getSessionTokensFromUrl } from '@/services/auth';
import { supabase } from '@/services/supabase';
import { colors, spacing } from '@/theme/tokens';

export default function AuthCallbackScreen() {
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const completeVerification = async (url: string | null) => {
      if (!active) return;
      if (!supabase || !url) {
        setError('Doğrulama bağlantısı açılamadı. Giriş ekranından devam edebilirsin.');
        return;
      }

      const tokens = getSessionTokensFromUrl(url);
      if (tokens.error) {
        setError(tokens.error);
        return;
      }
      if (!tokens.accessToken || !tokens.refreshToken) {
        setError('E-posta doğrulandı. Devam etmek için giriş yap.');
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      router.replace('/onboarding');
    };

    void Linking.getInitialURL().then(completeVerification);
    const listener = Linking.addEventListener('url', ({ url }) => void completeVerification(url));
    return () => {
      active = false;
      listener.remove();
    };
  }, []);

  return <Screen style={styles.container}>
    <BrandMark />
    {!error ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><SectionTitle eyebrow="E-posta doğrulandı" title="Scholara hesabın hazırlanıyor…" /></View> : <>
      <SectionTitle eyebrow="Doğrulama tamamlandı" title="Scholara'ya geri dön." />
      <MessageBanner message={error} tone="info" />
      <Button label="Giriş ekranına git" onPress={() => router.replace('/sign-in')} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({ container: { gap: spacing.lg }, center: { flex: 1, justifyContent: 'center', gap: spacing.xl } });
