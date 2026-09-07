import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Screen, SectionTitle } from '@/components/ui';
import { colors } from '@/theme/tokens';

const conversations = [
  { initials: 'ER', name: 'Emilia Reyes', message: 'The dataset link is perfect—thank you!', time: '14:28', unread: true, color: '#486D62' },
  { initials: 'JB', name: 'Jonas Berg', message: 'See you at the methods workshop.', time: 'Yesterday', unread: false, color: '#6A7694' },
];

export default function MessagesScreen() {
  return <Screen>
    <SectionTitle eyebrow="Messages" title="Continue the conversation." subtitle="Private messaging stays free after a mutual match." />
    {conversations.map((item) => <Card key={item.name} style={styles.item}><View style={[styles.avatar, { backgroundColor: item.color }]}><Text style={styles.initials}>{item.initials}</Text></View><View style={styles.detail}><Text style={styles.name}>{item.name}</Text><Text numberOfLines={1} style={[styles.message, item.unread && styles.unread]}>{item.message}</Text></View><View style={styles.right}><Text style={styles.time}>{item.time}</Text>{item.unread && <View style={styles.badge}><Text style={styles.badgeText}>1</Text></View>}</View></Card>)}
    <View style={styles.security}><Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} /><Text style={styles.securityText}>Report and block controls will be available inside every conversation and profile.</Text></View>
  </Screen>;
}

const styles = StyleSheet.create({ item: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, initials: { color: colors.white, fontWeight: '900' }, detail: { flex: 1, gap: 4 }, name: { color: colors.ink, fontWeight: '800', fontSize: 16 }, message: { color: colors.inkMuted }, unread: { color: colors.ink, fontWeight: '700' }, right: { alignItems: 'flex-end', gap: 6 }, time: { color: colors.inkMuted, fontSize: 11 }, badge: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: colors.white, fontWeight: '800', fontSize: 11 }, security: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: colors.primarySoft, borderRadius: 16 }, securityText: { flex: 1, color: colors.primaryDark, fontSize: 12, lineHeight: 17 } });
