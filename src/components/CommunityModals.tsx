import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/LocalizedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafetySheet } from '@/components/SafetySheet';
import { Button, Card, Chip, Field, MessageBanner } from '@/components/ui';
import {
  createCommunityComment, createCommunityPost, deleteCommunityComment, fetchCommunityComments,
  type CommunityCategory, type CommunityComment, type CommunityPost,
} from '@/services/community';
import { buildCommentThread } from '@/services/communityThread';
import { colors, radius, spacing } from '@/theme/tokens';
import { useI18n } from '@/i18n';

const categories: { value: CommunityCategory; label: string }[] = [
  { value: 'research', label: 'Research' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'academic_life', label: 'Academic life' },
];

const dateLabel = (value: string, locale: string) => new Date(value).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return <View style={styles.header}><Text style={styles.title}>{title}</Text><Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={colors.ink} /></Pressable></View>;
}

export function CommunityComposerModal({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const [category, setCategory] = useState<CommunityCategory>('research');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const publish = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await createCommunityPost(category, body);
    setBusy(false);
    if (result) setError(result);
    else {
      onPublished();
      onClose();
    }
  };

  return <Modal animationType="slide" onRequestClose={onClose} visible>
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ModalHeader title="Create a community post" onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          {error ? <MessageBanner message={error} /> : null}
          <Text style={styles.label}>TOPIC</Text>
          <View style={styles.chips}>{categories.map((item) => <Chip key={item.value} label={item.label} selected={category === item.value} onPress={() => setCategory(item.value)} />)}</View>
          <Field autoFocus label="Your post" maxLength={2000} multiline placeholder="Ask a question, share an experience, or offer useful academic advice." value={body} onChangeText={setBody} />
          <Text style={styles.counter}>{body.length}/2000</Text>
          <Button label={busy ? 'Publishing…' : 'Publish post'} disabled={busy || body.trim().length < 10} onPress={() => void publish()} />
          <Text style={styles.note}>Posts are visible to signed-in Scholara researchers. Do not share confidential research or personal information.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

export function CommunityCommentsModal({ post, onClose, onChanged, onBlocked }: { post: CommunityPost; onClose: () => void; onChanged: () => void; onBlocked: (authorId: string) => void }) {
  const { locale, t } = useI18n();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommunityComment | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<CommunityComment | null>(null);
  const [safetyTarget, setSafetyTarget] = useState<CommunityComment | null>(null);
  const commentsScrollRef = useRef<ScrollView>(null);
  const revealNewestComment = useRef(false);
  const threadedComments = useMemo(() => buildCommentThread(comments, expandedThreads), [comments, expandedThreads]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await fetchCommunityComments(post.id);
    setComments(result.comments);
    setError(result.error ?? '');
    setLoading(false);
  }, [post.id]);

  useEffect(() => {
    let active = true;
    void fetchCommunityComments(post.id).then((result) => {
      if (!active) return;
      setComments(result.comments);
      setError(result.error ?? '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [post.id]);

  const send = async () => {
    if (!draft.trim() || busy) return;
    const parentCommentId = replyingTo?.id ?? null;
    const isThreadReply = Boolean(parentCommentId);
    setBusy(true);
    setError('');
    const result = await createCommunityComment(post.id, draft, replyingTo?.id ?? null);
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      setDraft('');
      if (parentCommentId) setExpandedThreads((current) => new Set(current).add(parentCommentId));
      setReplyingTo(null);
      Keyboard.dismiss();
      await load();
      if (!isThreadReply) {
        revealNewestComment.current = true;
        requestAnimationFrame(() => commentsScrollRef.current?.scrollToEnd({ animated: true }));
      }
      onChanged();
    }
  };

  const removeComment = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    const result = await deleteCommunityComment(deleteTarget.id);
    setBusy(false);
    if (result) setError(result);
    else {
      setComments((current) => current.filter((item) => item.id !== deleteTarget.id));
      if (replyingTo?.id === deleteTarget.id) setReplyingTo(null);
      setDeleteTarget(null);
      onChanged();
    }
  };

  return <Modal animationType="slide" onRequestClose={onClose} visible>
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ModalHeader title="Discussion" onClose={onClose} />
        <ScrollView
          contentContainerStyle={styles.commentsContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!revealNewestComment.current) return;
            revealNewestComment.current = false;
            commentsScrollRef.current?.scrollToEnd({ animated: true });
          }}
          ref={commentsScrollRef}
          style={styles.commentsScroll}
        >
          <View style={styles.postSummary}>
            <View style={styles.summaryHeader}><View style={styles.summaryAvatar}><Text style={styles.summaryAvatarText}>{initials(post.authorName)}</Text></View><View style={styles.commentIdentity}><Text style={styles.summaryAuthor}>{post.authorName}</Text><Text numberOfLines={1} style={styles.commentContext}>{post.authorStage}{post.authorUniversity ? ` · ${post.authorUniversity}` : ''} · {dateLabel(post.createdAt, locale)}</Text></View></View>
            <Text style={styles.summaryBody}>{post.body}</Text>
            <View style={styles.discussionLabel}><Ionicons name="chatbubbles-outline" size={16} color={colors.primary} /><Text style={styles.discussionLabelText}>{comments.length} {t(comments.length === 1 ? 'comment' : 'comments')}</Text></View>
          </View>
          {error ? <MessageBanner message={error} /> : null}
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          {!loading && comments.length === 0 ? <View style={styles.empty}><Ionicons name="chatbubble-ellipses-outline" size={38} color={colors.primary} /><Text style={styles.emptyTitle}>No replies yet</Text><Text style={styles.note}>Start a thoughtful academic discussion.</Text></View> : null}
          {threadedComments.map(({ comment, depth, replyCount }) => <View key={comment.id} style={[styles.comment, { marginLeft: Math.min(depth, 3) * 18 }]}>
            {depth > 0 ? <View style={styles.threadLine} /> : null}
            <View style={styles.commentMain}>
              <View style={styles.commentHeader}><View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{initials(comment.authorName)}</Text></View><View style={styles.commentIdentity}><Text style={styles.commentAuthor}>{comment.authorName}</Text><Text numberOfLines={1} style={styles.commentContext}>{comment.authorStage}{comment.authorUniversity ? ` · ${comment.authorUniversity}` : ''} · {dateLabel(comment.createdAt, locale)}</Text></View></View>
              <Text style={styles.commentBody}>{comment.body}</Text>
              <View style={styles.commentActions}>
                <Pressable accessibilityLabel={`Reply to ${comment.authorName}`} accessibilityRole="button" onPress={() => setReplyingTo(comment)} style={styles.commentAction}><Ionicons name="return-down-forward-outline" size={16} color={colors.inkMuted} /><Text style={styles.commentActionText}>Reply</Text></Pressable>
                <Pressable accessibilityLabel={comment.viewerOwns ? 'Delete your comment' : `Safety options for ${comment.authorName}`} accessibilityRole="button" onPress={() => comment.viewerOwns ? setDeleteTarget(comment) : setSafetyTarget(comment)} style={styles.commentAction}><Ionicons name={comment.viewerOwns ? 'trash-outline' : 'ellipsis-horizontal'} size={16} color={comment.viewerOwns ? colors.danger : colors.inkMuted} /><Text style={[styles.commentActionText, comment.viewerOwns && styles.deleteText]}>{comment.viewerOwns ? 'Delete' : 'More'}</Text></Pressable>
              </View>
              {replyCount > 0 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: expandedThreads.has(comment.id) }} onPress={() => setExpandedThreads((current) => { const next = new Set(current); if (next.has(comment.id)) next.delete(comment.id); else next.add(comment.id); return next; })} style={styles.repliesToggle}><View style={styles.repliesRail} /><Ionicons name={expandedThreads.has(comment.id) ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} /><Text style={styles.repliesToggleText}>{expandedThreads.has(comment.id) ? t('Hide replies') : `${replyCount} ${t(replyCount === 1 ? 'reply' : 'replies')}`}</Text></Pressable> : null}
            </View>
          </View>)}
        </ScrollView>
        <View style={styles.composer}>
          {replyingTo ? <View style={styles.replyingBanner}><View style={styles.replyingText}><Text style={styles.replyingEyebrow}>REPLYING TO</Text><Text numberOfLines={1} style={styles.replyingName}>{replyingTo.authorName}</Text></View><Pressable accessibilityLabel="Cancel reply" accessibilityRole="button" onPress={() => setReplyingTo(null)} style={styles.cancelReply}><Ionicons name="close" size={18} color={colors.inkMuted} /></Pressable></View> : null}
          <Field label={replyingTo ? 'Write a reply' : 'Join the discussion'} maxLength={1000} multiline placeholder={replyingTo ? `Reply to ${replyingTo.authorName}…` : 'Share a constructive thought…'} style={styles.replyInput} value={draft} onChangeText={setDraft} />
          <View style={styles.composerFooter}><Text style={styles.composerCounter}>{draft.length}/1000</Text><Pressable accessibilityRole="button" disabled={busy || !draft.trim()} onPress={() => void send()} style={({ pressed }) => [styles.sendButton, pressed && styles.sendPressed, (busy || !draft.trim()) && styles.sendDisabled]}><Ionicons name="arrow-up" size={20} color={colors.white} /><Text style={styles.sendText}>{busy ? 'Sending…' : 'Reply'}</Text></Pressable></View>
        </View>
      </KeyboardAvoidingView>
      {deleteTarget ? <View style={styles.confirmOverlay}><Card style={styles.confirmCard}><Text style={styles.confirmTitle}>Delete this reply?</Text><Text style={styles.note}>This cannot be undone.</Text><Button label={busy ? 'Deleting…' : 'Delete reply'} disabled={busy} onPress={() => void removeComment()} /><Button label="Cancel" variant="ghost" disabled={busy} onPress={() => setDeleteTarget(null)} /></Card></View> : null}
      {safetyTarget ? <SafetySheet targetId={safetyTarget.authorId} targetName={safetyTarget.authorName} source="community" contextPostId={post.id} contextCommentId={safetyTarget.id} onClose={() => setSafetyTarget(null)} onBlocked={() => { onBlocked(safetyTarget.authorId); if (replyingTo?.authorId === safetyTarget.authorId) setReplyingTo(null); setComments((current) => current.filter((item) => item.authorId !== safetyTarget.authorId)); }} /> : null}
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  title: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: '900' },
  close: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  modalContent: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  label: { color: colors.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  counter: { color: colors.inkMuted, fontSize: 10, textAlign: 'right', marginTop: -spacing.sm },
  note: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 },
  commentsScroll: { flex: 1 },
  commentsContent: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  postSummary: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryAvatar: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  summaryAvatarText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  summaryAuthor: { color: colors.ink, fontWeight: '900' },
  summaryBody: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  discussionLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingVertical: spacing.xs },
  discussionLabelText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  comment: { position: 'relative', flexDirection: 'row', paddingTop: spacing.md },
  threadLine: { width: 2, alignSelf: 'stretch', marginHorizontal: 8, borderRadius: 1, backgroundColor: '#C8D8D2' },
  commentMain: { flex: 1, minWidth: 0, gap: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  commentAvatar: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  commentAvatarText: { color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  commentIdentity: { flex: 1, minWidth: 0 },
  commentAuthor: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  commentContext: { color: colors.inkMuted, fontSize: 10 },
  commentBody: { color: colors.ink, fontSize: 14, lineHeight: 21, paddingLeft: 42 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingLeft: 34 },
  commentAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: radius.sm },
  commentActionText: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  deleteText: { color: colors.danger },
  repliesToggle: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingRight: spacing.sm },
  repliesRail: { width: 18, height: 2, borderRadius: 1, backgroundColor: '#A8CFC1' },
  repliesToggleText: { color: colors.primaryDark, fontSize: 11, fontWeight: '900' },
  composer: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  replyingBanner: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: colors.primarySoft },
  replyingText: { flex: 1, minWidth: 0 },
  replyingEyebrow: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  replyingName: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  cancelReply: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  replyInput: { minHeight: 78, maxHeight: 120 },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  composerCounter: { color: colors.inkMuted, fontSize: 10 },
  sendButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primary },
  sendPressed: { opacity: 0.75 },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  confirmOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(11, 31, 24, 0.45)' },
  confirmCard: { width: '100%', maxWidth: 420, gap: spacing.md },
  confirmTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
});
