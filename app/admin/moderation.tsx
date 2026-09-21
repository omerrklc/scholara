import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Field, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import {
  fetchModerationReports,
  fetchModerationRole,
  reviewModerationReport,
  type ModerationReport,
  type ModerationRole,
  type ModerationStatus,
} from '@/services/moderationAdmin';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

const filters: { label: string; value: ModerationStatus }[] = [
  { label: 'Open', value: 'open' },
  { label: 'Reviewing', value: 'reviewing' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Dismissed', value: 'dismissed' },
];

const reasonLabels: Record<string, string> = {
  spam: 'Spam', harassment: 'Harassment', impersonation: 'Impersonation',
  inappropriate_content: 'Inappropriate content', privacy: 'Privacy', other: 'Other',
};

const sourceLabels: Record<string, string> = {
  discover: 'Discover', matches: 'Matches', chat: 'Chat', profile: 'Profile', community: 'Community',
};

const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function ModerationScreen() {
  const { authReady, session } = useApp();
  const [role, setRole] = useState<ModerationRole | null>(null);
  const [status, setStatus] = useState<ModerationStatus>('open');
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');
    const access = await fetchModerationRole();
    setRole(access.role);
    if (access.error) {
      setReports([]);
      setError(access.error);
      setLoading(false);
      return;
    }
    if (!access.role) {
      setReports([]);
      setLoading(false);
      return;
    }
    const result = await fetchModerationReports(status);
    setReports(result.reports);
    setError(result.error ?? '');
    setLoading(false);
  }, [status]);

  useFocusEffect(useCallback(() => { if (session) void load(); }, [load, session]));

  const selectReport = (report: ModerationReport) => {
    if (selectedId === report.id) {
      setSelectedId('');
      setNotes('');
      return;
    }
    setSelectedId(report.id);
    setNotes(report.reviewNotes);
    setMessage('');
  };

  const updateReport = async (reportId: string, nextStatus: ModerationStatus) => {
    if (saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    const updateError = await reviewModerationReport(reportId, nextStatus, notes);
    setSaving(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    setSelectedId('');
    setNotes('');
    setMessage('The moderation decision was recorded.');
    const result = await fetchModerationReports(status);
    setReports(result.reports);
    setError(result.error ?? '');
  };

  if (!authReady) return <Screen scroll={false} style={styles.center}><ActivityIndicator color={colors.primary} /></Screen>;
  if (!session) return <Redirect href="/sign-in" />;

  return <Screen>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>Moderation</Text>
      <View style={styles.headerSpacer} />
    </View>
    <SectionTitle eyebrow="Trust & safety" title="Review private reports." subtitle="Access and every decision are enforced and recorded by the server." />
    {error ? <MessageBanner message={error} /> : null}
    {message ? <MessageBanner message={message} tone="success" /> : null}
    {loading ? <ActivityIndicator color={colors.primary} size="large" /> : !role ? <Card style={styles.center}>
      <Ionicons name="lock-closed-outline" size={42} color={colors.inkMuted} />
      <Text style={styles.emptyTitle}>Moderation access required</Text>
      <Text style={styles.emptyText}>This account cannot view or change private reports.</Text>
      <Button label="Go back" variant="secondary" onPress={() => router.back()} />
    </Card> : <>
      <View style={styles.roleRow}><Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} /><Text style={styles.roleText}>{role === 'admin' ? 'Administrator' : 'Moderator'} access</Text></View>
      <View accessibilityRole="tablist" style={styles.filters}>{filters.map((filter) => <Chip key={filter.value} label={filter.label} selected={status === filter.value} onPress={() => { setSelectedId(''); setNotes(''); setStatus(filter.value); }} />)}</View>
      {reports.length === 0 ? <Card style={styles.center}><Ionicons name="checkmark-circle-outline" size={44} color={colors.primary} /><Text style={styles.emptyTitle}>No {status} reports</Text><Text style={styles.emptyText}>Nothing needs attention in this queue.</Text></Card> : reports.map((report) => {
        const selected = selectedId === report.id;
        return <Card key={report.id} style={styles.report}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: selected }} onPress={() => selectReport(report)} style={styles.reportHeader}>
            <View style={styles.reportTitleWrap}>
              <Text style={styles.reportName}>{report.reportedName}</Text>
              {report.reportedUsername ? <Text style={styles.username}>@{report.reportedUsername}</Text> : null}
              <Text style={styles.meta}>{sourceLabels[report.source] ?? report.source} · {dateLabel(report.createdAt)}</Text>
            </View>
            <Ionicons name={selected ? 'chevron-up' : 'chevron-down'} size={21} color={colors.inkMuted} />
          </Pressable>
          <View style={styles.reasonRow}>{report.reasons.map((reason) => <Chip key={reason} label={reasonLabels[reason] ?? reason} />)}</View>
          {report.details ? <LabeledText label="REPORT DETAILS" text={report.details} /> : null}
          {report.contentExcerpt ? <LabeledText label="REPORTED CONTENT SNAPSHOT" text={report.contentExcerpt} /> : null}
          {selected ? <View style={styles.review}>
            <Field label="Private review notes" multiline maxLength={2000} value={notes} onChangeText={setNotes} placeholder="Record the reason for this decision." />
            <Text style={styles.counter}>{notes.length}/2000</Text>
            {report.status !== 'reviewing' ? <Button label={saving ? 'Saving…' : 'Start review'} variant="secondary" disabled={saving} onPress={() => void updateReport(report.id, 'reviewing')} /> : null}
            {report.status !== 'resolved' ? <Button label={saving ? 'Saving…' : 'Resolve report'} disabled={saving} onPress={() => void updateReport(report.id, 'resolved')} /> : null}
            {report.status !== 'dismissed' ? <Button label={saving ? 'Saving…' : 'Dismiss report'} variant="secondary" disabled={saving} onPress={() => void updateReport(report.id, 'dismissed')} /> : null}
          </View> : null}
        </Card>;
      })}
      <Button label="Refresh reports" variant="ghost" disabled={loading || saving} onPress={() => void load()} />
    </>}
  </Screen>;
}

function LabeledText({ label, text }: { label: string; text: string }) {
  return <View style={styles.labeledText}><Text style={styles.label}>{label}</Text><Text style={styles.body}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, back: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }, headerTitle: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' }, headerSpacer: { width: 42 }, center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 999, backgroundColor: colors.primarySoft }, roleText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, report: { gap: spacing.sm }, reportHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, reportTitleWrap: { flex: 1, minWidth: 0, gap: 2 }, reportName: { color: colors.ink, fontSize: 17, fontWeight: '900' }, username: { color: colors.primary, fontSize: 12, fontWeight: '700' }, meta: { color: colors.inkMuted, fontSize: 11 }, reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, labeledText: { gap: 4, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border }, label: { color: colors.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, body: { color: colors.ink, fontSize: 14, lineHeight: 20 }, review: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, counter: { alignSelf: 'flex-end', color: colors.inkMuted, fontSize: 10, marginTop: -spacing.xs }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' }, emptyText: { color: colors.inkMuted, lineHeight: 20, textAlign: 'center' },
});

