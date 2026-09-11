import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityCommentsModal, CommunityComposerModal } from '@/components/CommunityModals';
import { SafetySheet } from '@/components/SafetySheet';
import { Button, Card, Chip, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import { deleteCommunityPost, fetchCommunityPosts, toggleCommunityHelpful, type CommunityCategory, type CommunityPost } from '@/services/community';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

type FeedFilter = CommunityCategory | 'all';

const filters: { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'For you' },
  { value: 'research', label: 'Research' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'academic_life', label: 'Academic life' },
];

const categoryLabel: Record<CommunityCategory, string> = {
  research: 'Research', relocation: 'Relocation', academic_life: 'Academic life',
};

const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

export default function CommunityScreen() {
  const { onboardingComplete } = useApp();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [commentsPost, setCommentsPost] = useState<CommunityPost | null>(null);
  const [safetyPost, setSafetyPost] = useState<CommunityPost | null>(null);
  const [deletePost, setDeletePost] = useState<CommunityPost | null>(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await fetchCommunityPosts(filter === 'all' ? null : filter);
    setPosts(result.posts);
    setError(result.error ?? '');
    setLoading(false);
  }, [filter]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const markHelpful = async (post: CommunityPost) => {
    if (busyId) return;
    setBusyId(post.id);
    setError('');
    const result = await toggleCommunityHelpful(post.id);
    setBusyId('');
    if (result.error || result.helpful === null) setError(result.error ?? 'Your helpful vote could not be updated.');
    else setPosts((current) => current.map((item) => item.id === post.id ? {
      ...item,
      viewerHelpful: result.helpful as boolean,
      helpfulCount: Math.max(0, item.helpfulCount + (result.helpful ? 1 : -1)),
    } : item));
  };

  const removePost = async () => {
    if (!deletePost || busyId) return;
    setBusyId(deletePost.id);
    setError('');
    const result = await deleteCommunityPost(deletePost.id);
    setBusyId('');
    if (result) setError(result);
    else {
      setPosts((current) => current.filter((item) => item.id !== deletePost.id));
      setDeletePost(null);
      setMessage('Your post was deleted.');
    }
  };

  const removeBlockedAuthor = (authorId: string) => {
    setPosts((current) => current.filter((post) => post.authorId !== authorId));
    if (commentsPost?.authorId === authorId) setCommentsPost(null);
    void load();
  };

  const header = <View style={styles.header}>
    <SectionTitle eyebrow="Community" title="Questions travel farther together." subtitle="Learn from people who are living the same academic moments." />
    <View style={styles.filters}>{filters.map((item) => <Chip key={item.value} label={item.label} selected={filter === item.value} onPress={() => setFilter(item.value)} />)}</View>
    {message ? <MessageBanner message={message} tone="success" /> : null}
    {error ? <MessageBanner message={error} /> : null}
    <Pressable accessibilityLabel="Create a community post" accessibilityRole="button" disabled={!onboardingComplete} onPress={() => { setMessage(''); setShowComposer(true); }} style={({ pressed }) => [styles.prompt, pressed && styles.pressed, !onboardingComplete && styles.disabled]}><Ionicons name="create-outline" size={22} color={colors.primary} /><Text style={styles.promptText}>{onboardingComplete ? 'Ask the research community…' : 'Complete your profile before posting'}</Text></Pressable>
  </View>;

  return <Screen scroll={false} style={styles.screen}>
    <FlatList
      contentContainerStyle={[styles.list, posts.length === 0 && !loading && styles.emptyList]}
      data={posts}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={loading ? <Card style={styles.empty}><ActivityIndicator color={colors.primary} /><Text style={styles.emptyText}>Loading community posts…</Text></Card> : <Card style={styles.empty}><Ionicons name="people-outline" size={42} color={colors.primary} /><Text style={styles.emptyTitle}>No posts here yet</Text><Text style={styles.emptyText}>Start the first academic conversation in this topic.</Text></Card>}
      onRefresh={() => void load()}
      refreshing={loading}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => <Card style={styles.post}>
        <View style={styles.postHeader}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(item.authorName)}</Text></View>
          <View style={styles.postIdentity}><Text style={styles.author}>{item.authorName}</Text><Text numberOfLines={1} style={styles.context}>{item.authorStage}{item.authorUniversity ? ` · ${item.authorUniversity}` : ''} · {dateLabel(item.createdAt)}</Text></View>
          <Pressable accessibilityLabel={item.viewerOwns ? 'Delete your post' : `Safety options for ${item.authorName}`} accessibilityRole="button" onPress={() => item.viewerOwns ? setDeletePost(item) : setSafetyPost(item)} style={styles.more}><Ionicons name={item.viewerOwns ? 'trash-outline' : 'ellipsis-horizontal'} size={20} color={item.viewerOwns ? colors.danger : colors.inkMuted} /></Pressable>
        </View>
        <View style={styles.topic}><Chip label={categoryLabel[item.category]} /></View>
        <Text style={styles.body}>{item.body}</Text>
        <View style={styles.stats}>
          <Pressable accessibilityLabel={`Open ${item.replyCount} replies`} accessibilityRole="button" onPress={() => setCommentsPost(item)} style={styles.statButton}><Ionicons name="chatbubble-outline" size={17} color={colors.inkMuted} /><Text style={styles.stat}>{item.replyCount} replies</Text></Pressable>
          <Pressable accessibilityLabel={item.viewerHelpful ? 'Remove helpful vote' : 'Mark as helpful'} accessibilityRole="button" disabled={busyId === item.id} onPress={() => void markHelpful(item)} style={[styles.statButton, item.viewerHelpful && styles.helpful]}><Ionicons name={item.viewerHelpful ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={18} color={item.viewerHelpful ? colors.primary : colors.inkMuted} /><Text style={[styles.stat, item.viewerHelpful && styles.helpfulText]}>{item.helpfulCount} helpful</Text></Pressable>
        </View>
      </Card>}
    />
    {showComposer ? <CommunityComposerModal onClose={() => setShowComposer(false)} onPublished={() => { setMessage('Your post is now live.'); void load(); }} /> : null}
    {commentsPost ? <CommunityCommentsModal post={commentsPost} onClose={() => setCommentsPost(null)} onChanged={() => void load()} onBlocked={removeBlockedAuthor} /> : null}
    {safetyPost ? <SafetySheet targetId={safetyPost.authorId} targetName={safetyPost.authorName} source="community" contextPostId={safetyPost.id} onClose={() => setSafetyPost(null)} onBlocked={() => removeBlockedAuthor(safetyPost.authorId)} /> : null}
    <Modal animationType="fade" onRequestClose={() => setDeletePost(null)} transparent visible={Boolean(deletePost)}>
      <SafeAreaView style={styles.confirmOverlay}><Card style={styles.confirmCard}><Text style={styles.confirmTitle}>Delete this post?</Text><Text style={styles.emptyText}>Its replies and helpful votes will also be removed. This cannot be undone.</Text><Button label={busyId ? 'Deleting…' : 'Delete post'} disabled={Boolean(busyId)} onPress={() => void removePost()} /><Button label="Cancel" variant="ghost" disabled={Boolean(busyId)} onPress={() => setDeletePost(null)} /></Card></SafeAreaView>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 }, list: { gap: spacing.md, paddingBottom: spacing.xl }, emptyList: { flexGrow: 1 }, header: { gap: spacing.md, marginBottom: spacing.md }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, prompt: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.surface }, promptText: { flex: 1, color: colors.inkMuted }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 }, empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' }, emptyText: { color: colors.inkMuted, textAlign: 'center', lineHeight: 20 }, post: { gap: spacing.md, marginBottom: spacing.md }, postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.primaryDark, fontWeight: '900' }, postIdentity: { flex: 1, minWidth: 0 }, author: { color: colors.ink, fontWeight: '800' }, context: { color: colors.inkMuted, fontSize: 10 }, more: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }, topic: { alignItems: 'flex-start' }, body: { color: colors.ink, fontSize: 15, lineHeight: 22 }, stats: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, statButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 13 }, stat: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' }, helpful: { backgroundColor: colors.primarySoft }, helpfulText: { color: colors.primaryDark }, confirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(11, 31, 24, 0.45)' }, confirmCard: { width: '100%', maxWidth: 420, gap: spacing.md }, confirmTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
});
