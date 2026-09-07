import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Screen, SectionTitle } from '@/components/ui';
import { researchers } from '@/data/mock';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

export default function MatchesScreen() {
  const { connected } = useApp();
  const pending = researchers.filter((person) => connected.includes(person.id));
  return <Screen>
    <SectionTitle eyebrow="Connections" title="Mutual interest, meaningful conversations." subtitle="A conversation opens only after both researchers choose to connect." />
    {pending.length === 0 ? <Card style={styles.empty}><Ionicons name="git-compare-outline" size={42} color={colors.primary} /><Text style={styles.emptyTitle}>No connection requests yet</Text><Text style={styles.emptyText}>When you tap Connect in Discover, your request will appear here while you wait for a mutual match.</Text></Card> : pending.map((person) => <Card key={person.id} style={styles.match}><View style={[styles.avatar, { backgroundColor: person.color }]}><Text style={styles.initials}>{person.initials}</Text></View><View style={styles.detail}><Text style={styles.name}>{person.name}</Text><Text style={styles.meta}>{person.score}% research match · Request sent</Text></View><Ionicons name="time-outline" size={21} color={colors.accent} /></Card>)}
    <Text style={styles.sectionLabel}>RECENT MATCHES</Text>
    <Card style={styles.match}><View style={[styles.avatar, { backgroundColor: '#486D62' }]}><Text style={styles.initials}>ER</Text></View><View style={styles.detail}><Text style={styles.name}>Emilia Reyes</Text><Text style={styles.meta}>Matched today · Urban Analytics</Text></View><Ionicons name="checkmark-circle" size={22} color={colors.primary} /></Card>
  </Screen>;
}

const styles = StyleSheet.create({ empty: { alignItems: 'center', gap: 10, paddingVertical: spacing.xl }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' }, emptyText: { color: colors.inkMuted, textAlign: 'center', lineHeight: 21 }, sectionLabel: { color: colors.inkMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '800', marginTop: spacing.sm }, match: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, initials: { color: colors.white, fontWeight: '900' }, detail: { flex: 1, gap: 3 }, name: { color: colors.ink, fontWeight: '800', fontSize: 16 }, meta: { color: colors.inkMuted, fontSize: 12 } });
