import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafetySheet } from '@/components/SafetySheet';
import { Button, Card, Chip, Field, MessageBanner } from '@/components/ui';
import {
  createCommunityComment, createCommunityPost, deleteCommunityComment, fetchCommunityComments,
  type CommunityCategory, type CommunityComment, type CommunityPost,
} from '@/services/community';
import { colors, radius, spacing } from '@/theme/tokens';

const categories: { value: CommunityCategory; label: string }[] = [
  { value: 'research', label: 'Research' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'academic_life', label: 'Academic life' },
];

const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

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
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CommunityComment | null>(null);
  const [safetyTarget, setSafetyTarget] = useState<CommunityComment | null>(null);

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
    setBusy(true);
    setError('');
    const result = await createCommunityComment(post.id, draft);
    setBusy(false);
    if (result) setError(result);
    else {
      setDraft('');
      await load();
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
      setDeleteTarget(null);
      onChanged();
    }
  };

  return <Modal animationType="slide" onRequestClose={onClose} visible>
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ModalHeader title="Discussion" onClose={onClose} />
        <ScrollView contentContainerStyle={styles.commentsContent} keyboardShouldPersistTaps="handled" style={styles.commentsScroll}>
          <Card style={styles.postSummary}><Text style={styles.summaryAuthor}>{post.authorName}</Text><Text style={styles.summaryBody}>{post.body}</Text></Card>
          {error ? <MessageBanner message={error} /> : null}
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          {!loading && comments.length === 0 ? <View style={styles.empty}><Ionicons name="chatbubble-ellipses-outline" size={38} color={colors.primary} /><Text style={styles.emptyTitle}>No replies yet</Text><Text style={styles.note}>Start a thoughtful academic discussion.</Text></View> : null}
          {comments.map((comment) => <View key={comment.id} style={styles.comment}>
            <View style={styles.commentHeader}><View style={styles.commentIdentity}><Text style={styles.commentAuthor}>{comment.authorName}</Text><Text style={styles.commentContext}>{comment.authorStage}{comment.authorUniversity ? ` · ${comment.authorUniversity}` : ''} · {dateLabel(comment.createdAt)}</Text></View><Pressable accessibilityLabel={comment.viewerOwns ? 'Delete your comment' : `Safety options for ${comment.authorName}`} accessibilityRole="button" onPress={() => comment.viewerOwns ? setDeleteTarget(comment) : setSafetyTarget(comment)} style={styles.more}><Ionicons name={comment.viewerOwns ? 'trash-outline' : 'ellipsis-horizontal'} size={19} color={comment.viewerOwns ? colors.danger : colors.inkMuted} /></Pressable></View>
            <Text style={styles.commentBody}>{comment.body}</Text>
          </View>)}
        </ScrollView>
        <View style={styles.composer}><Field label="Add a reply" maxLength={1000} multiline placeholder="Write a constructive reply…" value={draft} onChangeText={setDraft} /><Text style={styles.counter}>{draft.length}/1000</Text><Button label={busy ? 'Sending…' : 'Reply'} disabled={busy || !draft.trim()} onPress={() => void send()} /></View>
      </KeyboardAvoidingView>
      {deleteTarget ? <View style={styles.confirmOverlay}><Card style={styles.confirmCard}><Text style={styles.confirmTitle}>Delete this reply?</Text><Text style={styles.note}>This cannot be undone.</Text><Button label={busy ? 'Deleting…' : 'Delete reply'} disabled={busy} onPress={() => void removeComment()} /><Button label="Cancel" variant="ghost" disabled={busy} onPress={() => setDeleteTarget(null)} /></Card></View> : null}
      {safetyTarget ? <SafetySheet targetId={safetyTarget.authorId} targetName={safetyTarget.authorName} source="community" contextPostId={post.id} contextCommentId={safetyTarget.id} onClose={() => setSafetyTarget(null)} onBlocked={() => { onBlocked(safetyTarget.authorId); setComments((current) => current.filter((item) => item.authorId !== safetyTarget.authorId)); }} /> : null}
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }, title: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: '900' }, close: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }, modalContent: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: spacing.lg, gap: spacing.md }, label: { color: colors.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, counter: { color: colors.inkMuted, fontSize: 10, textAlign: 'right', marginTop: -spacing.sm }, note: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 }, commentsScroll: { flex: 1 }, commentsContent: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: spacing.md, gap: spacing.md }, postSummary: { gap: spacing.xs, backgroundColor: colors.primarySoft }, summaryAuthor: { color: colors.primaryDark, fontWeight: '900' }, summaryBody: { color: colors.ink, lineHeight: 20 }, empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg }, emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, comment: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, commentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, commentIdentity: { flex: 1, minWidth: 0 }, commentAuthor: { color: colors.ink, fontWeight: '800' }, commentContext: { color: colors.inkMuted, fontSize: 10 }, more: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, commentBody: { color: colors.ink, lineHeight: 20 }, composer: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: spacing.xs, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }, confirmOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(11, 31, 24, 0.45)' }, confirmCard: { width: '100%', maxWidth: 420, gap: spacing.md }, confirmTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
});
