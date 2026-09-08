import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BrandMark, Button, Card, Screen } from '@/components/ui';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

export default function WelcomeScreen() {
  const { height, width } = useWindowDimensions();
  const { authReady, session, onboardingComplete, profileLoading } = useApp();
  const compact = height < 820 || width < 380;

  useEffect(() => {
    if (!authReady || profileLoading || !session) return;
    router.replace(onboardingComplete ? '/(tabs)/discover' : '/onboarding');
  }, [authReady, onboardingComplete, profileLoading, session]);

  if (!authReady || profileLoading || session) {
    return <Screen scroll={false} style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></Screen>;
  }

  return <Screen style={[styles.container, compact && styles.containerCompact]}>
    <BrandMark />
    <View style={[styles.hero, compact && styles.heroCompact]}>
      <View style={[styles.orbit, compact && styles.orbitCompact]}>
        <View style={[styles.dot, styles.dotOne]} /><View style={[styles.dot, styles.dotTwo]} />
        <Text style={styles.orbitGlyph}>S</Text>
      </View>
      <Text style={styles.kicker}>YOUR ACADEMIC WORLD, BEYOND YOUR UNIVERSITY</Text>
      <Text style={[styles.headline, compact && styles.headlineCompact]}>Meet the researchers you should know.</Text>
      <Text style={styles.body}>Find people who share your research, understand where you are going, and can help you feel at home there.</Text>
    </View>
    <Card style={[styles.valueCard, compact && styles.valueCardCompact]}>
      <View style={styles.value}><View style={styles.valueDot} /><Text style={styles.valueText}>Research-based matches</Text></View>
      <View style={styles.value}><View style={styles.valueDot} /><Text style={styles.valueText}>Relocation connections</Text></View>
      <View style={styles.value}><View style={styles.valueDot} /><Text style={styles.valueText}>Early-career community</Text></View>
    </Card>
    <View style={styles.actions}>
      <Button label="Create account" onPress={() => router.push('/sign-up')} />
      <Button label="Sign in" variant="secondary" onPress={() => router.push('/sign-in')} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center' },
  container: { minHeight: '100%', justifyContent: 'space-between', paddingTop: spacing.md, paddingBottom: spacing.xl }, containerCompact: { gap: spacing.md, paddingBottom: spacing.sm }, hero: { alignItems: 'center', gap: 14 }, heroCompact: { gap: 9 }, orbit: { width: 116, height: 116, borderRadius: 58, borderWidth: 1, borderColor: '#B8D7CB', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, orbitCompact: { width: 76, height: 76, borderRadius: 38 }, orbitGlyph: { color: colors.primary, fontSize: 48, fontWeight: '900', letterSpacing: -3 }, dot: { position: 'absolute', width: 13, height: 13, borderRadius: 7, backgroundColor: colors.accent }, dotOne: { top: 8, right: 17 }, dotTwo: { bottom: 11, left: 10, backgroundColor: '#7C6D9B' }, kicker: { color: colors.primary, fontWeight: '800', fontSize: 11, letterSpacing: 1.3, textAlign: 'center' }, headline: { color: colors.ink, fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -1.5, textAlign: 'center', maxWidth: '100%' }, headlineCompact: { fontSize: 29, lineHeight: 33 }, body: { color: colors.inkMuted, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 420 }, valueCard: { gap: 12, marginVertical: spacing.md }, valueCardCompact: { gap: 8, marginVertical: 0, paddingVertical: 12 }, value: { flexDirection: 'row', alignItems: 'center', gap: 10 }, valueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }, valueText: { color: colors.ink, fontWeight: '600', fontSize: 14 }, actions: { gap: 8 },
});
