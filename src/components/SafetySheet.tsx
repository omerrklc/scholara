import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { blockUser, reportCommunityComment, reportCommunityPost, reportUser, type ReportReason, type SafetySource } from '@/services/moderation';
import { Button, Chip, Field, MessageBanner } from '@/components/ui';
import { colors, radius, shadow, spacing } from '@/theme/tokens';

const reasons: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'privacy', label: 'Privacy concern' },
  { value: 'other', label: 'Other' },
];

export function SafetySheet({ targetId, targetName, source, contextPostId, contextCommentId, onClose, onBlocked }: { targetId: string; targetName: string; source: SafetySource; contextPostId?: string; contextCommentId?: string; onClose: () => void; onBlocked: () => void }) {
  const [selectedReasons, setSelectedReasons] = useState<ReportReason[]>([]);
  const [details, setDetails] = useState('');
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reported, setReported] = useState(false);

  const submitReport = async () => {
    if (!selectedReasons.length || busy) return;
    setBusy(true);
    setError('');
    const result = source === 'community' && contextCommentId
      ? await reportCommunityComment(contextCommentId, selectedReasons, details)
      : source === 'community' && contextPostId
        ? await reportCommunityPost(contextPostId, selectedReasons, details)
        : await reportUser(targetId, selectedReasons, details, source);
    setBusy(false);
    if (result) setError(result);
    else setReported(true);
  };

  const confirmBlock = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await blockUser(targetId);
    setBusy(false);
    if (result) setError(result);
    else {
      onBlocked();
      onClose();
    }
  };

  return <Modal animationType="slide" onRequestClose={onClose} transparent visible>
    <SafeAreaView style={styles.overlay}>
      <Pressable accessibilityLabel="Close safety options" onPress={onClose} style={styles.backdrop} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <View style={styles.sheet}>
          <View style={styles.header}><View><Text style={styles.eyebrow}>TRUST & SAFETY</Text><Text numberOfLines={1} style={styles.title}>{targetName}</Text></View><Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={colors.ink} /></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              {error ? <MessageBanner message={error} /> : null}
              {reported ? <><MessageBanner tone="success" message="Thank you. Your report was submitted privately for review." /><Text style={styles.note}>Reporting does not automatically block this user.</Text></> : <>
                <Text style={styles.sectionTitle}>Report user</Text>
                <Text style={styles.note}>Choose every reason that applies. Reports are not shown to the reported user.</Text>
                <View style={styles.reasons}>{reasons.map((item) => {
                  const selected = selectedReasons.includes(item.value);
                  return <Chip key={item.value} label={item.label} selected={selected} onPress={() => setSelectedReasons((current) => selected ? current.filter((value) => value !== item.value) : [...current, item.value])} />;
                })}</View>
                <Field label="Additional details (optional)" maxLength={1000} multiline value={details} onChangeText={setDetails} placeholder="Share only information needed to review this report." />
                <Text style={styles.counter}>{details.length}/1000</Text>
                <Button label={busy ? 'Submitting…' : 'Submit report'} disabled={!selectedReasons.length || busy} onPress={() => void submitReport()} />
              </>}
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Block user</Text>
              <Text style={styles.note}>You will disappear from each other’s Discover, Matches and Messages. Your existing conversation is kept securely but neither of you can access it while blocked.</Text>
              {confirmingBlock ? <View style={styles.confirm}><Text style={styles.confirmText}>Block {targetName}? This also removes the match.</Text><Button label={busy ? 'Blocking…' : 'Yes, block user'} disabled={busy} onPress={() => void confirmBlock()} /><Button label="Cancel" variant="ghost" disabled={busy} onPress={() => setConfirmingBlock(false)} /></View> : <Button label="Block user" variant="secondary" onPress={() => setConfirmingBlock(true)} />}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' }, backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11, 31, 24, 0.45)' }, keyboard: { maxHeight: '92%' }, sheet: { maxHeight: '100%', backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.md, ...shadow }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }, eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, title: { color: colors.ink, fontSize: 20, fontWeight: '800', maxWidth: 280 }, close: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }, content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, note: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 }, reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, counter: { color: colors.inkMuted, fontSize: 10, textAlign: 'right', marginTop: -spacing.sm }, divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }, confirm: { gap: spacing.sm, padding: spacing.md, backgroundColor: '#FBECEC', borderRadius: radius.md }, confirmText: { color: colors.danger, fontWeight: '700', lineHeight: 20 },
});
