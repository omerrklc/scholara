import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import { fetchConversationSummaries, type ConversationSummary } from '@/services/messaging';
import { colors, spacing } from '@/theme/tokens';

const avatarColors = ['#486D62', '#6A7694', '#7A6551', '#70658B'];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
const colorFor = (id: string) => avatarColors[id.charCodeAt(0) % avatarColors.length];
const messageTime = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await fetchConversationSummaries();
    setConversations(result.conversations);
    setError(result.error ?? '');
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <Screen>
    <SectionTitle eyebrow="Messages" title="Continue the conversation." subtitle="Private messaging is available only after a mutual match." />
    {loading ? <Card style={styles.empty}><ActivityIndicator color={colors.primary} /><Text style={styles.emptyText}>Loading conversations…</Text></Card> : null}
    {!loading && error ? <><MessageBanner message={error} /><Button label="Try again" variant="secondary" onPress={() => void load()} /></> : null}
    {!loading && !error && conversations.length === 0 ? <Card style={styles.empty}><Ionicons name="chatbubbles-outline" size={44} color={colors.primary} /><Text style={styles.emptyTitle}>No conversations yet</Text><Text style={styles.emptyText}>Create a mutual match first. Your new conversation will then appear here.</Text></Card> : null}
    {!loading && !error ? conversations.map((item) => <Pressable accessibilityRole="button" key={item.otherUserId} onPress={() => router.push({ pathname: '/chat/[userId]', params: { userId: item.otherUserId } })}><Card style={styles.item}><View style={[styles.avatar, { backgroundColor: colorFor(item.otherUserId) }]}><Text style={styles.initials}>{initials(item.name)}</Text></View><View style={styles.detail}><Text numberOfLines={1} style={styles.name}>{item.name}</Text><Text numberOfLines={1} style={[styles.message, item.unreadCount > 0 && styles.unread]}>{item.lastMessage ?? 'Matched — say hello!'}</Text></View><View style={styles.right}><Text style={styles.time}>{messageTime(item.lastMessageAt)}</Text>{item.unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(item.unreadCount, 99)}</Text></View> : <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />}</View></Card></Pressable>) : null}
    <View style={styles.security}><Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} /><Text style={styles.securityText}>Only you and your matched researcher can read this conversation.</Text></View>
  </Screen>;
}

const styles = StyleSheet.create({ item: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, initials: { color: colors.white, fontWeight: '900' }, detail: { flex: 1, minWidth: 0, gap: 4 }, name: { color: colors.ink, fontWeight: '800', fontSize: 16 }, message: { color: colors.inkMuted }, unread: { color: colors.ink, fontWeight: '700' }, right: { alignItems: 'flex-end', gap: 6 }, time: { color: colors.inkMuted, fontSize: 11 }, badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: colors.white, fontWeight: '800', fontSize: 11 }, empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' }, emptyText: { color: colors.inkMuted, textAlign: 'center', lineHeight: 21 }, security: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: colors.primarySoft, borderRadius: 16 }, securityText: { flex: 1, color: colors.primaryDark, fontSize: 12, lineHeight: 17 } });
