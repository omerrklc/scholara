import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Text } from '@/components/LocalizedText';
import { Button, Card, Chip, Field, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import {
  fetchModerationReports,
  fetchModerationRole,
  moderateReportedAccount,
  removeReportedContent,
  reviewModerationReport,
  type BanDuration,
  type ModerationReport,
  type ModerationRole,
  type ModerationStatus,
} from '@/services/moderationAdmin';
import { useApp } from '@/state/AppProvider';
import { createThemedStyleSheet, colors, spacing } from '@/theme/tokens';
import { useI18n } from '@/i18n';

const filters: { label: string; value: ModerationStatus }[] = [
  { label: 'Open', value: 'open' },
  { label: 'Reviewing', value: 'reviewing' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Dismissed', value: 'dismissed' },
];

const banDurations: { label: string; value: BanDuration }[] = [
  { label: '1 day', value: '1_day' },
  { label: '1 week', value: '1_week' },
  { label: '1 month', value: '1_month' },
  { label: '1 year', value: '1_year' },
  { label: 'Permanent', value: 'permanent' },
];

const reasonLabels: Record<string, string> = {
  spam: 'Spam', harassment: 'Harassment', impersonation: 'Impersonation',
  inappropriate_content: 'Inappropriate content', privacy: 'Privacy', other: 'Other',
};

const sourceLabels: Record<string, string> = {
  discover: 'Discover', matches: 'Matches', chat: 'Chat', profile: 'Profile', community: 'Community',
};

const dateLabel = (value: string, locale: string) => new Date(value).toLocaleString(locale, {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function ModerationScreen() {
  const { locale, t } = useI18n();
  const { authReady, session } = useApp();
  const [role, setRole] = useState<ModerationRole | null>(null);
  const [status, setStatus] = useState<ModerationStatus>('open');
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [banDuration, setBanDuration] = useState<BanDuration>('1_week');
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
      setBanDuration('1_week');
      return;
    }
    setSelectedId(report.id);
    setNotes(report.reviewNotes);
    setBanDuration('1_week');
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

  const runEnforcement = async (report: ModerationReport, action: 'remove' | 'ban' | 'unban') => {
    if (saving) return;
    if (notes.trim().length < 5) {
      setError('Write a decision note of at least 5 characters before taking this action.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    const actionError = action === 'remove'
      ? await removeReportedContent(report.id, notes)
      : await moderateReportedAccount(report.id, action, notes, banDuration);
    setSaving(false);
    if (actionError) {
      setError(actionError);
      return;
    }
    setSelectedId('');
    setNotes('');
    const durationLabel = t(banDurations.find((option) => option.value === banDuration)?.label ?? 'selected period').toLocaleLowerCase(locale);
    setMessage(action === 'remove' ? 'The reported content was removed and the report was resolved.' : action === 'ban' ? t('The account was banned for {{duration}} and the report was resolved.', { duration: durationLabel }) : 'The account ban was lifted.');
    const result = await fetchModerationReports(status);
    setReports(result.reports);
    setError(result.error ?? '');
  };

  const confirmEnforcement = (report: ModerationReport, action: 'remove' | 'ban' | 'unban') => {
    const durationLabel = t(banDurations.find((option) => option.value === banDuration)?.label ?? 'the selected period').toLocaleLowerCase(locale);
    const copy = action === 'remove'
      ? { title: 'Remove reported content?', body: 'The post or reply will be permanently removed. The evidence snapshot and audit record will remain.', confirm: 'Remove content' }
      : action === 'ban'
        ? { title: `Ban this account for ${durationLabel.toLowerCase()}?`, body: 'The account will be hidden and blocked from signing in or creating interactions. Timed bans end automatically; an administrator can also lift any ban early.', confirm: 'Ban account' }
        : { title: 'Restore this account?', body: 'The account will be allowed to sign in and participate again.', confirm: 'Lift ban' };
    Alert.alert(copy.title, copy.body, [
      { text: 'Cancel', style: 'cancel' },
      { text: copy.confirm, style: action === 'unban' ? 'default' : 'destructive', onPress: () => void runEnforcement(report, action) },
    ]);
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
      <View style={styles.roleRow}><Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} /><Text style={styles.roleText}>{t('{{role}} access', { role: t(role === 'admin' ? 'Administrator' : 'Moderator') })}</Text></View>
      <View accessibilityRole="tablist" style={styles.filters}>{filters.map((filter) => <Chip key={filter.value} label={filter.label} selected={status === filter.value} onPress={() => { setSelectedId(''); setNotes(''); setBanDuration('1_week'); setStatus(filter.value); }} />)}</View>
      {reports.length === 0 ? <Card style={styles.center}><Ionicons name="checkmark-circle-outline" size={44} color={colors.primary} /><Text style={styles.emptyTitle}>{t('No {{status}} reports', { status: t(filters.find((item) => item.value === status)?.label ?? status).toLocaleLowerCase(locale) })}</Text><Text style={styles.emptyText}>Nothing needs attention in this queue.</Text></Card> : reports.map((report) => {
        const selected = selectedId === report.id;
        const decisionReady = notes.trim().length >= 5;
        return <Card key={report.id} style={styles.report}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: selected }} onPress={() => selectReport(report)} style={styles.reportHeader}>
            <View style={styles.reportTitleWrap}>
              <Text style={styles.reportName}>{report.reportedName}</Text>
              {report.reportedUsername ? <Text style={styles.username}>@{report.reportedUsername}</Text> : null}
              <Text style={styles.meta}>{t(sourceLabels[report.source] ?? report.source)} · {dateLabel(report.createdAt, locale)}</Text>
            </View>
            <Ionicons name={selected ? 'chevron-up' : 'chevron-down'} size={21} color={colors.inkMuted} />
          </Pressable>
          <View style={styles.reasonRow}>{report.reasons.map((reason) => <Chip key={reason} label={reasonLabels[reason] ?? reason} />)}</View>
          {report.details ? <LabeledText label="REPORT DETAILS" text={report.details} /> : null}
          {report.contentExcerpt ? <LabeledText label="REPORTED CONTENT SNAPSHOT" text={report.contentExcerpt} /> : null}
          {selected ? <View style={styles.review}>
            <Card style={styles.evidenceCard}>
              <View style={styles.evidenceTitle}><Ionicons name="analytics-outline" size={20} color={colors.primary} /><Text style={styles.evidenceHeading}>Evidence check</Text></View>
              <EvidenceRow label="Reports about this account (30 days)" value={`${report.targetReportCount30d}`} />
              <EvidenceRow label="Different reporters (30 days)" value={`${report.targetDistinctReporters30d}`} />
              <EvidenceRow label="Previously resolved reports (30 days)" value={`${report.targetResolvedCount30d}`} />
              <EvidenceRow label="Reports sent by this reporter (30 days)" value={`${report.reporterReportCount30d}`} />
              <EvidenceRow label="This reporter's dismissed reports" value={`${report.reporterDismissedCount30d}`} />
              <Text style={styles.guidance}>{report.source === 'chat'
                ? 'No direct message evidence is attached. Do not ban from this report alone; keep reviewing or dismiss it.'
                : report.targetDistinctReporters30d <= 1 && report.targetResolvedCount30d === 0
                  ? 'This is a single-source report with no confirmed history. Verify the snapshot and details before taking action.'
                  : 'Counts are context, not proof. Base the decision on the captured content and written report.'}</Text>
            </Card>
            <Field label="Private review notes" multiline maxLength={2000} value={notes} onChangeText={setNotes} placeholder="Record the evidence and reason for this decision." />
            <Text style={styles.counter}>{notes.length}/2000 · at least 5 characters for a final action</Text>
            {report.status !== 'reviewing' ? <Button label={saving ? 'Saving…' : 'Start review'} variant="secondary" disabled={saving} onPress={() => void updateReport(report.id, 'reviewing')} /> : null}
            {report.reportedContentExists ? <Button label={saving ? 'Saving…' : 'Remove reported content'} variant="danger" disabled={saving || !decisionReady} onPress={() => confirmEnforcement(report, 'remove')} /> : null}
            {role === 'admin' && report.reportedUserId && !report.accountBanned ? <View style={styles.banDuration}>
              <Text style={styles.label}>BAN DURATION</Text>
              <View accessibilityRole="radiogroup" style={styles.filters}>{banDurations.map((option) => <Chip key={option.value} label={option.label} selected={banDuration === option.value} onPress={() => setBanDuration(option.value)} />)}</View>
              <Text style={styles.durationHint}>Timed bans are lifted automatically. Permanent bans remain until an administrator lifts them.</Text>
            </View> : null}
            {role === 'admin' && report.reportedUserId && !report.accountBanned ? <Button label={saving ? 'Saving…' : 'Ban account'} variant="danger" disabled={saving || !decisionReady} onPress={() => confirmEnforcement(report, 'ban')} /> : null}
            {role === 'admin' && report.reportedUserId && report.accountBanned ? <Button label={saving ? 'Saving…' : 'Lift account ban'} variant="secondary" disabled={saving || !decisionReady} onPress={() => confirmEnforcement(report, 'unban')} /> : null}
            {report.status !== 'resolved' ? <Button label={saving ? 'Saving…' : 'Resolve without enforcement'} disabled={saving || !decisionReady} onPress={() => void updateReport(report.id, 'resolved')} /> : null}
            {report.status !== 'dismissed' ? <Button label={saving ? 'Saving…' : 'Dismiss as unsupported'} variant="secondary" disabled={saving || !decisionReady} onPress={() => void updateReport(report.id, 'dismissed')} /> : null}
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

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.evidenceRow}><Text style={styles.evidenceLabel}>{label}</Text><Text style={styles.evidenceValue}>{value}</Text></View>;
}

const styles = createThemedStyleSheet(() => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, back: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }, headerTitle: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' }, headerSpacer: { width: 42 }, center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 999, backgroundColor: colors.primarySoft }, roleText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, report: { gap: spacing.sm }, reportHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, reportTitleWrap: { flex: 1, minWidth: 0, gap: 2 }, reportName: { color: colors.ink, fontSize: 17, fontWeight: '900' }, username: { color: colors.primary, fontSize: 12, fontWeight: '700' }, meta: { color: colors.inkMuted, fontSize: 11 }, reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, labeledText: { gap: 4, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border }, label: { color: colors.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, body: { color: colors.ink, fontSize: 14, lineHeight: 20 }, review: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, banDuration: { gap: spacing.xs, padding: spacing.sm, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted }, durationHint: { color: colors.inkMuted, fontSize: 11, lineHeight: 16 }, evidenceCard: { gap: spacing.xs, backgroundColor: colors.surfaceMuted, shadowOpacity: 0, elevation: 0 }, evidenceTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }, evidenceHeading: { color: colors.ink, fontWeight: '900' }, evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, evidenceLabel: { flex: 1, minWidth: 0, color: colors.inkMuted, fontSize: 12 }, evidenceValue: { color: colors.ink, fontWeight: '900' }, guidance: { color: colors.primaryDark, fontSize: 12, lineHeight: 18, fontWeight: '700', paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border }, counter: { alignSelf: 'flex-end', color: colors.inkMuted, fontSize: 10, marginTop: -spacing.xs, textAlign: 'right' }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' }, emptyText: { color: colors.inkMuted, lineHeight: 20, textAlign: 'center' },
}));
