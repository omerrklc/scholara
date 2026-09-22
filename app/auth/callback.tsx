import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BrandMark, Button, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import { consumeAuthCodeOnce } from '@/services/authCallback';
import { getAuthCodeFromUrl } from '@/services/auth';
import { supabase } from '@/services/supabase';
import { createThemedStyleSheet, colors, spacing } from '@/theme/tokens';

export default function AuthCallbackScreen() {
  const [error, setError] = useState('');
  const processedCodes = useRef(new Set<string>());

  useEffect(() => {
    let active = true;

    const completeVerification = async (url: string | null) => {
      if (!active) return;
      if (!supabase || !url) {
        setError('The verification link could not be opened. You can continue from the sign-in screen.');
        return;
      }
      const callback = getAuthCodeFromUrl(url);
      if (callback.error || !callback.code) {
        setError('The verification link is invalid or expired. You can request a new link.');
        return;
      }
      if (!consumeAuthCodeOnce(processedCodes.current, callback.code)) return;

      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(callback.code);
      if (!active) return;
      if (sessionError) {
        setError('This verification link is invalid, expired, or already used. You can request a new link.');
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
    {!error ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><SectionTitle eyebrow="Email verified" title="Preparing your Scholara account…" /></View> : <>
      <SectionTitle eyebrow="Verification finished" title="Return to Scholara." />
      <MessageBanner message={error} tone="info" />
      <Button label="Go to sign in" onPress={() => router.replace('/sign-in')} />
    </>}
  </Screen>;
}

const styles = createThemedStyleSheet(() => ({ container: { gap: spacing.lg }, center: { flex: 1, justifyContent: 'center', gap: spacing.xl } }));
