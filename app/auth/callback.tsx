import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BrandMark, Button, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import { consumeAuthCodeOnce } from '@/services/authCallback';
import { getAuthCodeFromUrl } from '@/services/auth';
import { supabase } from '@/services/supabase';
import { colors, spacing } from '@/theme/tokens';

export default function AuthCallbackScreen() {
  const [error, setError] = useState('');
  const processedCodes = useRef(new Set<string>());

  useEffect(() => {
    let active = true;

    const completeVerification = async (url: string | null) => {
      if (!active) return;
      if (!supabase || !url) {
        setError('Doğrulama bağlantısı açılamadı. Giriş ekranından devam edebilirsin.');
        return;
      }
      const callback = getAuthCodeFromUrl(url);
      if (callback.error || !callback.code) {
        setError('Doğrulama bağlantısı geçersiz veya süresi dolmuş. Yeni bir bağlantı isteyebilirsin.');
        return;
      }
      if (!consumeAuthCodeOnce(processedCodes.current, callback.code)) return;

      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(callback.code);
      if (!active) return;
      if (sessionError) {
        setError('Bu doğrulama bağlantısı geçersiz, süresi dolmuş veya daha önce kullanılmış. Yeni bir bağlantı isteyebilirsin.');
        return;
      }
      router.replace(callback.nextRoute);
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
