import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BrandMark, Button, Card, Screen } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

export default function WelcomeScreen() {
  return <Screen scroll={false} style={styles.container}>
    <BrandMark />
    <View style={styles.hero}>
      <View style={styles.orbit}>
        <View style={[styles.dot, styles.dotOne]} /><View style={[styles.dot, styles.dotTwo]} />
        <Text style={styles.orbitGlyph}>S</Text>
      </View>
      <Text style={styles.kicker}>YOUR ACADEMIC WORLD, BEYOND YOUR UNIVERSITY</Text>
      <Text style={styles.headline}>Meet the researchers you should know.</Text>
      <Text style={styles.body}>Find people who share your research, understand where you are going, and can help you feel at home there.</Text>
    </View>
    <Card style={styles.valueCard}>
      <View style={styles.value}><View style={styles.valueDot} /><Text style={styles.valueText}>Research-based matches</Text></View>
      <View style={styles.value}><View style={styles.valueDot} /><Text style={styles.valueText}>Relocation connections</Text></View>
      <View style={styles.value}><View style={styles.valueDot} /><Text style={styles.valueText}>Early-career community</Text></View>
    </Card>
    <View style={styles.actions}>
      <Button label="Create account" onPress={() => router.push('/onboarding')} />
      <Button label="Sign in" variant="secondary" onPress={() => router.push('/sign-in')} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between', paddingTop: spacing.md, paddingBottom: spacing.xl }, hero: { alignItems: 'center', gap: 14 }, orbit: { width: 116, height: 116, borderRadius: 58, borderWidth: 1, borderColor: '#B8D7CB', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, orbitGlyph: { color: colors.primary, fontSize: 48, fontWeight: '900', letterSpacing: -3 }, dot: { position: 'absolute', width: 13, height: 13, borderRadius: 7, backgroundColor: colors.accent }, dotOne: { top: 8, right: 17 }, dotTwo: { bottom: 11, left: 10, backgroundColor: '#7C6D9B' }, kicker: { color: colors.primary, fontWeight: '800', fontSize: 11, letterSpacing: 1.3, textAlign: 'center' }, headline: { color: colors.ink, fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -1.5, textAlign: 'center', maxWidth: '100%' }, body: { color: colors.inkMuted, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 420 }, valueCard: { gap: 12, marginVertical: spacing.md }, value: { flexDirection: 'row', alignItems: 'center', gap: 10 }, valueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }, valueText: { color: colors.ink, fontWeight: '600', fontSize: 14 }, actions: { gap: 10 },
});
