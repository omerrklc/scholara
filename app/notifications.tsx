import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/LocalizedText';
import { Card, MessageBanner, Screen } from '@/components/ui';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem, type NotificationKind } from '@/services/notifications';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

const labels: Record<NotificationKind, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  connection_request: { title: 'wants to connect with you', icon: 'person-add-outline' },
  match: { title: 'is now an academic match', icon: 'git-compare-outline' },
  message: { title: 'sent you a message', icon: 'chatbubble-outline' },
  community_comment: { title: 'commented on your community post', icon: 'chatbox-ellipses-outline' },
  community_helpful: { title: 'found your community post helpful', icon: 'arrow-up-circle-outline' },
};

const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase()).join('') || 'S';
const timeLabel = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function NotificationsScreen() {
  const { authReady, refreshNotifications, session, unreadNotifications } = useApp();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await fetchNotifications();
    setItems(result.notifications);
    setError(result.error ?? '');
    setLoading(false);
    void refreshNotifications();
  }, [refreshNotifications]);

  useFocusEffect(useCallback(() => {
    if (!session) return;
    // Keep an open notification list in sync with realtime unread-count changes.
    void unreadNotifications;
    void load();
  }, [load, session, unreadNotifications]));

  const openNotification = async (item: NotificationItem) => {
    if (!item.readAt) {
      const updateError = await markNotificationRead(item.id);
      if (!updateError) {
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, readAt: new Date().toISOString() } : candidate));
        void refreshNotifications();
      }
    }

    if (item.kind === 'message' && item.actorId) {
      router.push({ pathname: '/chat/[userId]', params: { userId: item.actorId } });
    } else if ((item.kind === 'connection_request' || item.kind === 'match') && item.actorId) {
      router.push({ pathname: '/researcher/[userId]', params: { userId: item.actorId, mode: 'research' } });
    } else if (item.kind === 'community_comment' || item.kind === 'community_helpful') {
      router.push('/(tabs)/community');
    }
  };

  const markAll = async () => {
    const result = await markAllNotificationsRead();
    if (result) {
      setError(result);
      return;
    }
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    void refreshNotifications();
  };

  const loadMore = async () => {
    if (loadingMore || items.length < 30) return;
    setLoadingMore(true);
    const result = await fetchNotifications(items.at(-1)?.createdAt);
    setLoadingMore(false);
    if (result.error) setError(result.error);
    else setItems((current) => [...current, ...result.notifications.filter((item) => !current.some((existing) => existing.id === item.id))]);
  };

  if (!authReady) return <Screen scroll={false} style={styles.center}><ActivityIndicator color={colors.primary} /></Screen>;
  if (!session) return <Redirect href="/sign-in" />;

  return <Screen scroll={false} style={styles.screen}>
    <View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.ink} /></Pressable><View style={styles.headerText}><Text style={styles.title}>Notifications</Text><Text style={styles.subtitle}>Your academic activity in one place</Text></View>{items.some((item) => !item.readAt) ? <Pressable accessibilityLabel="Mark all notifications as read" accessibilityRole="button" onPress={() => void markAll()} style={styles.markAll}><Text style={styles.markAllText}>Read all</Text></Pressable> : <View style={styles.markPlaceholder} />}</View>
    {error ? <MessageBanner message={error} /> : null}
    <FlatList
      contentContainerStyle={[styles.list, !loading && items.length === 0 && styles.emptyList]}
      data={items}
      keyExtractor={(item) => item.id}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.3}
      onRefresh={() => void load()}
      refreshing={loading}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => <Pressable accessibilityLabel={`${item.actorName} ${labels[item.kind].title}`} accessibilityRole="button" onPress={() => void openNotification(item)}><Card style={[styles.item, !item.readAt && styles.unread]}><View style={styles.avatar}>{item.actorAvatarUrl ? <Image accessibilityLabel={`${item.actorName} profile photo`} source={{ uri: item.actorAvatarUrl }} style={styles.avatarImage} /> : <Text style={styles.initials}>{initials(item.actorName)}</Text>}</View><View style={styles.content}><Text style={styles.body}><Text style={styles.actor}>{item.actorName}</Text> {labels[item.kind].title}.</Text><Text style={styles.time}>{timeLabel(item.createdAt)}</Text></View><View style={styles.kindIcon}><Ionicons name={labels[item.kind].icon} size={19} color={colors.primary} /></View>{!item.readAt ? <View accessibilityLabel="Unread" style={styles.dot} /> : null}</Card></Pressable>}
      ListEmptyComponent={!loading ? <Card style={styles.center}><Ionicons name="notifications-outline" size={46} color={colors.primary} /><Text style={styles.emptyTitle}>You are all caught up</Text><Text style={styles.emptyText}>New matches, messages and community activity will appear here.</Text></Card> : null}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoader} /> : null}
    />
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: spacing.sm }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, back: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }, headerText: { flex: 1, minWidth: 0 }, title: { color: colors.ink, fontSize: 20, fontWeight: '900' }, subtitle: { color: colors.inkMuted, fontSize: 11 }, markAll: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm }, markAllText: { color: colors.primary, fontSize: 12, fontWeight: '800' }, markPlaceholder: { width: 56 }, list: { gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xl }, emptyList: { flexGrow: 1, justifyContent: 'center' }, item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm }, unread: { backgroundColor: colors.primarySoft, borderColor: '#A8CFC1' }, avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, initials: { color: colors.white, fontWeight: '900' }, content: { flex: 1, minWidth: 0, gap: 4 }, body: { color: colors.ink, fontSize: 13, lineHeight: 18 }, actor: { fontWeight: '900' }, time: { color: colors.inkMuted, fontSize: 10 }, kindIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger }, center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' }, emptyText: { color: colors.inkMuted, textAlign: 'center', lineHeight: 20 }, footerLoader: { padding: spacing.md },
});
