import { Ionicons } from '@expo/vector-icons';
import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, MessageBanner, PasswordField, Screen, SectionTitle } from '@/components/ui';
import {
  acceptCurrentLegalDocuments, createDataExportRequest, defaultAccountSettings, fetchAccountSettings,
  permanentlyDeleteAccount, updateNotificationPreferences, updatePrivacyPreferences,
  type LegalDocumentKey, type NotificationPreferences,
} from '@/services/accountSettings';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

const legalLabels: Record<LegalDocumentKey, string> = {
  terms: 'Terms of Service', privacy: 'Privacy Notice', community_guidelines: 'Community Guidelines',
};

export default function SettingsScreen() {
  const { profile, session, updateProfile } = useApp();
  const [notifications, setNotifications] = useState(defaultAccountSettings.notifications);
  const [privacy, setPrivacy] = useState(defaultAccountSettings.privacy);
  const [legal, setLegal] = useState(defaultAccountSettings.legal);
  const [latestExport, setLatestExport] = useState(defaultAccountSettings.latestExport);
  const [acceptedChecked, setAcceptedChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAccountSettings();
    if (result.settings) {
      setNotifications(result.settings.notifications);
      setPrivacy(result.settings.privacy);
      setLegal(result.settings.legal);
      setLatestExport(result.settings.latestExport);
    }
    setMessage(result.error ? { text: result.error, error: true } : null);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const saveNotifications = async () => {
    setSaving('notifications'); setMessage(null);
    const error = await updateNotificationPreferences(notifications);
    setSaving(''); setMessage({ text: error ?? 'Notification preferences saved.', error: Boolean(error) });
  };
  const savePrivacy = async () => {
    setSaving('privacy'); setMessage(null);
    const error = await updatePrivacyPreferences(privacy);
    if (!error) updateProfile({ ...profile, showCurrentLocation: privacy.currentLocation,
      showRelocationDestination: privacy.relocationDestination, showRelocationDate: privacy.relocationDate });
    setSaving(''); setMessage({ text: error ?? 'Privacy preferences saved.', error: Boolean(error) });
  };
  const acceptLegal = async () => {
    setSaving('legal'); setMessage(null);
    const error = await acceptCurrentLegalDocuments();
    setSaving('');
    if (!error) {
      setAcceptedChecked(false);
      await load();
    }
    setMessage({ text: error ?? 'Your acceptance was recorded.', error: Boolean(error) });
  };
  const requestExport = async () => {
    setSaving('export'); setMessage(null);
    const result = await createDataExportRequest();
    setSaving('');
    if (result.id) await load();
    setMessage({ text: result.error ?? 'Your data export request is queued.', error: Boolean(result.error) });
  };
  const allAccepted = Object.values(legal).every((document) => document.accepted);

  return <>
    <Screen>
      <View style={styles.header}><Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} color={colors.ink} /></Pressable><Text style={styles.headerTitle}>Settings</Text><View style={styles.headerSpacer} /></View>
      <SectionTitle eyebrow="Account controls" title="Privacy, notifications and your data." subtitle="Changes are stored securely with your Scholara account." />
      {message ? <MessageBanner message={message.text} tone={message.error ? 'error' : 'success'} /> : null}
      {loading ? <ActivityIndicator color={colors.primary} size="large" /> : <>
        <SettingsCard title="PRIVACY" icon="lock-closed-outline">
          <ToggleRow label="Show current city" detail="Other researchers can see your current city and country." value={privacy.currentLocation} onChange={(value) => setPrivacy((current) => ({ ...current, currentLocation: value }))} />
          <ToggleRow label="Show moving destination" detail="Only applies when you are planning a move." value={privacy.relocationDestination} disabled={!profile.isRelocating} onChange={(value) => setPrivacy((current) => ({ ...current, relocationDestination: value }))} />
          <ToggleRow label="Show expected moving date" detail="Your date remains private unless enabled." value={privacy.relocationDate} disabled={!profile.isRelocating} onChange={(value) => setPrivacy((current) => ({ ...current, relocationDate: value }))} />
          <Button label={saving === 'privacy' ? 'Saving…' : 'Save privacy choices'} disabled={Boolean(saving)} onPress={() => void savePrivacy()} />
        </SettingsCard>

        <SettingsCard title="NOTIFICATIONS" icon="notifications-outline">
          <ToggleRow label="Matches" detail="New connection requests and mutual matches." value={notifications.matches} onChange={(value) => changeNotification(setNotifications, 'matches', value)} />
          <ToggleRow label="Messages" detail="New messages from matched researchers." value={notifications.messages} onChange={(value) => changeNotification(setNotifications, 'messages', value)} />
          <ToggleRow label="Community" detail="Replies and helpful reactions." value={notifications.community} onChange={(value) => changeNotification(setNotifications, 'community', value)} />
          <ToggleRow label="Product updates" detail="Occasional feature and research updates." value={notifications.productUpdates} onChange={(value) => changeNotification(setNotifications, 'productUpdates', value)} />
          <Button label={saving === 'notifications' ? 'Saving…' : 'Save notification choices'} disabled={Boolean(saving)} onPress={() => void saveNotifications()} />
        </SettingsCard>

        <SettingsCard title="LEGAL & COMMUNITY" icon="document-text-outline">
          {(Object.keys(legalLabels) as LegalDocumentKey[]).map((key) => <Pressable key={key} accessibilityRole="link" onPress={() => router.push(`/legal/${key}` as Href)} style={styles.documentRow}><View style={styles.documentText}><Text style={styles.rowTitle}>{legalLabels[key]}</Text><Text style={styles.rowDetail}>Version {legal[key]?.version || 'current'} · {legal[key]?.accepted ? 'Accepted' : 'Review required'}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.inkMuted} /></Pressable>)}
          {!allAccepted ? <><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptedChecked }} onPress={() => setAcceptedChecked((value) => !value)} style={styles.consent}><Ionicons name={acceptedChecked ? 'checkbox' : 'square-outline'} size={25} color={colors.primary} /><Text style={styles.consentText}>I have read and agree to all three current documents.</Text></Pressable><Button label={saving === 'legal' ? 'Recording…' : 'Accept current documents'} disabled={!acceptedChecked || Boolean(saving)} onPress={() => void acceptLegal()} /></> : <MessageBanner message="All current documents accepted." tone="success" />}
        </SettingsCard>

        <SettingsCard title="YOUR DATA" icon="download-outline">
          <Text style={styles.body}>Request a portable copy of your profile and account activity. Requests are limited to one every 24 hours.</Text>
          {latestExport ? <Text style={styles.status}>Latest request: {latestExport.status}</Text> : null}
          <Button label={saving === 'export' ? 'Requesting…' : 'Request data export'} variant="secondary" disabled={Boolean(saving)} onPress={() => void requestExport()} />
        </SettingsCard>

        <SettingsCard title="DELETE ACCOUNT" icon="warning-outline" danger>
          <Text style={styles.body}>Permanently deletes your profile, posts, messages, matches and account access. This cannot be undone.</Text>
          <Button label="Delete my account" variant="danger" onPress={() => setDeleteOpen(true)} />
        </SettingsCard>
      </>}
    </Screen>
    {deleteOpen ? <DeleteAccountModal email={session?.user.email ?? ''} onClose={() => setDeleteOpen(false)} /> : null}
  </>;
}

function changeNotification(setter: React.Dispatch<React.SetStateAction<NotificationPreferences>>, key: keyof NotificationPreferences, value: boolean) { setter((current) => ({ ...current, [key]: value })); }

function SettingsCard({ title, icon, danger = false, children }: React.PropsWithChildren<{ title: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }>) {
  return <Card style={[styles.card, danger && styles.dangerCard]}><View style={styles.cardTitle}><Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} /><Text style={[styles.label, danger && styles.dangerText]}>{title}</Text></View>{children}</Card>;
}

function ToggleRow({ label, detail, value, onChange, disabled = false }: { label: string; detail: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)} style={[styles.toggleRow, disabled && styles.disabled]}><View style={styles.documentText}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.rowDetail}>{detail}</Text></View><View style={[styles.toggle, value && styles.toggleOn]}><View style={[styles.knob, value && styles.knobOn]} /></View></Pressable>;
}

function DeleteAccountModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const remove = async () => {
    if (confirmation !== 'DELETE' || !password || loading) return;
    setLoading(true); setError('');
    const result = await permanentlyDeleteAccount(email, password);
    setLoading(false);
    if (result) { setError(result); return; }
    onClose(); router.replace('/');
  };
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Permanently delete account?</Text><Text style={styles.body}>Type DELETE and enter your password. Your account data will be removed immediately.</Text>{error ? <MessageBanner message={error} /> : null}<Field label="Type DELETE to confirm" autoCapitalize="characters" maxLength={6} value={confirmation} onChangeText={setConfirmation} /><PasswordField label="Current password" autoComplete="current-password" maxLength={128} value={password} onChangeText={setPassword} /><Button label={loading ? 'Deleting…' : 'Permanently delete'} variant="danger" disabled={confirmation !== 'DELETE' || !password || loading} onPress={() => void remove()} /><Button label="Cancel" variant="ghost" disabled={loading} onPress={onClose} /></View></KeyboardAvoidingView></Modal>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, headerTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' }, headerSpacer: { width: 42 },
  card: { gap: spacing.md }, dangerCard: { borderColor: '#E8B9B9' }, cardTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, label: { color: colors.primaryDark, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, dangerText: { color: colors.danger },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }, documentText: { flex: 1, minWidth: 0, gap: 3 }, rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, rowDetail: { color: colors.inkMuted, fontSize: 12, lineHeight: 17 }, toggle: { width: 48, height: 28, padding: 3, borderRadius: 14, backgroundColor: colors.border }, toggleOn: { backgroundColor: colors.primary }, knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white }, knobOn: { alignSelf: 'flex-end' }, disabled: { opacity: 0.45 },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderTopWidth: 1, borderTopColor: colors.border }, consent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }, consentText: { flex: 1, color: colors.ink, lineHeight: 20 }, body: { color: colors.inkMuted, lineHeight: 21 }, status: { color: colors.primaryDark, fontWeight: '700', textTransform: 'capitalize' },
  modalBackdrop: { flex: 1, padding: spacing.lg, backgroundColor: 'rgba(9,25,20,0.55)', justifyContent: 'center' }, modalCard: { alignSelf: 'center', width: '100%', maxWidth: 480, gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg }, modalTitle: { color: colors.ink, fontSize: 23, fontWeight: '900' },
});
