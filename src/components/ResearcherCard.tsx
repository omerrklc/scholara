import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Researcher } from '@/types/domain';
import type { ConnectionState } from '@/services/connections';
import { Button, Card, Chip } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export function ResearcherCard({ person, saved, connectionState, saving = false, connecting = false, onPass, onSave, onConnect }: { person: Researcher; saved: boolean; connectionState?: ConnectionState; saving?: boolean; connecting?: boolean; onPass: () => void; onSave: () => void; onConnect: () => void }) {
  const connectLabel = connecting ? 'Connecting…' : connectionState === 'matched' ? 'Matched' : connectionState === 'sent' ? 'Request sent' : connectionState === 'received' ? 'Connect back' : 'Connect';
  const connectDisabled = connecting || connectionState === 'sent' || connectionState === 'matched';

  return <Card style={styles.card}>
    <View style={styles.personRow}>
      <View style={[styles.avatar, { backgroundColor: person.color }]}><Text style={styles.initials}>{person.initials}</Text></View>
      <View style={styles.identity}><Text style={styles.name}>{person.name}</Text><Text style={styles.meta}>{person.stage}</Text><Text style={styles.meta}>{person.university}</Text></View>
      <View style={styles.score}><Text style={styles.scoreNumber}>{person.score}%</Text><Text style={styles.scoreLabel}>MATCH</Text></View>
    </View>
    <View style={styles.locationRow}><Ionicons name="location-outline" size={16} color={colors.inkMuted} /><Text style={styles.location}>{person.location}</Text></View>
    {person.destination && <View style={styles.moving}><Ionicons name="airplane-outline" size={17} color={colors.primary} /><Text style={styles.movingText}>Moving to {person.destination}{person.arrival ? ` · ${person.arrival}` : ''}</Text></View>}
    <View style={styles.tags}>{person.tags.map((tag) => <Chip key={tag} label={tag} />)}</View>
    <Text style={styles.research}>{person.research}</Text>
    <View style={styles.matchReason}><Text style={styles.reasonLabel}>WHY YOU MATCH</Text><Text style={styles.reason}>{person.reason}</Text></View>
    <Text style={styles.intent}>{person.intent}</Text>
    <View style={styles.actions}>
      <Pressable accessibilityLabel="Pass" onPress={onPass} style={styles.roundButton}><Ionicons name="close" size={24} color={colors.inkMuted} /></Pressable>
      <Pressable accessibilityLabel={saved ? 'Remove saved profile' : 'Save profile'} disabled={saving} onPress={onSave} style={[styles.roundButton, saved && styles.saved, saving && styles.busy]}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? colors.primary : colors.inkMuted} /></Pressable>
      <View style={styles.connect}><Button label={connectLabel} disabled={connectDisabled} onPress={onConnect} /></View>
    </View>
  </Card>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: 20 }, personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, initials: { color: colors.white, fontSize: 19, fontWeight: '800' }, identity: { flex: 1, minWidth: 0, gap: 2 }, name: { color: colors.ink, fontSize: 20, fontWeight: '800' }, meta: { color: colors.inkMuted, fontSize: 13 }, score: { flexShrink: 0, alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 10 }, scoreNumber: { color: colors.primaryDark, fontSize: 18, fontWeight: '900' }, scoreLabel: { color: colors.primary, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, location: { color: colors.inkMuted, fontSize: 13 }, moving: { flexDirection: 'row', gap: 8, padding: 11, backgroundColor: colors.primarySoft, borderRadius: radius.md }, movingText: { flex: 1, color: colors.primaryDark, fontWeight: '700', fontSize: 13 }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, research: { color: colors.ink, fontSize: 16, lineHeight: 24 }, matchReason: { backgroundColor: '#F7F1E4', borderRadius: radius.md, padding: 14, gap: 5 }, reasonLabel: { color: '#8D651B', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, reason: { color: colors.ink, fontSize: 14, lineHeight: 20 }, intent: { color: colors.inkMuted, fontSize: 13, fontWeight: '600' }, actions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, roundButton: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, saved: { backgroundColor: colors.primarySoft, borderColor: '#A8CFC1' }, busy: { opacity: 0.5 }, connect: { flex: 1 },
});
