import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/LocalizedText';
import { SafetySheet } from '@/components/SafetySheet';
import { Button, Card, Chip, MessageBanner, Screen } from '@/components/ui';
import { setSavedProfile, type ConnectionState } from '@/services/connections';
import { toResearcher } from '@/services/discovery';
import { fetchProfileDetail, type ProfileDetail } from '@/services/profileDetails';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';
import type { DiscoveryMode } from '@/types/domain';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function ResearcherProfileScreen() {
  const params = useLocalSearchParams<{ userId?: string | string[]; mode?: string | string[] }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId ?? '';
  const requestedMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const mode: DiscoveryMode = requestedMode === 'moving' ? 'moving' : 'research';
  const validUserId = uuidPattern.test(userId);
  const { authReady, connect, profile: viewerProfile, refreshActions, session } = useApp();
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
  const [savedState, setSavedState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'save' | 'connect' | ''>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showSafety, setShowSafety] = useState(false);

  useEffect(() => {
    if (!session || !validUserId) return;
    let active = true;
    void fetchProfileDetail(userId).then((result) => {
      if (!active) return;
      setDetail(result.detail);
      setConnectionState(result.detail?.connectionState ?? null);
      setSavedState(result.detail?.viewerSaved ?? false);
      setError(result.error ?? '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [session, userId, validUserId]);

  const person = useMemo(() => detail ? toResearcher(viewerProfile, {
    id: detail.id,
    ...detail.profile,
    avatarUrl: detail.avatarUrl,
  }, mode) ?? toResearcher(viewerProfile, {
    id: detail.id,
    ...detail.profile,
    avatarUrl: detail.avatarUrl,
  }, 'research') : null, [detail, mode, viewerProfile]);

  const isSaved = savedState;

  const saveProfile = async () => {
    if (!detail || !session || busyAction) return;
    setBusyAction('save');
    setError('');
    setMessage('');
    const result = await setSavedProfile(session.user.id, detail.id, !isSaved);
    setBusyAction('');
    if (result) setError(result);
    else {
      setSavedState(!isSaved);
      void refreshActions();
      setMessage(isSaved ? 'Removed from saved profiles.' : 'Profile saved.');
    }
  };

  const connectProfile = async () => {
    if (!detail || busyAction) return;
    setBusyAction('connect');
    setError('');
    setMessage('');
    const result = await connect(detail.id);
    setBusyAction('');
    if (result.error) setError(result.error);
    else {
      setConnectionState(result.state);
      setMessage(result.state === 'matched' ? `It's a match! You can now message ${detail.profile.fullName}.` : 'Connection request sent.');
    }
  };

  if (!authReady) return <Screen style={styles.center}><ActivityIndicator color={colors.primary} /></Screen>;
  if (!session) return <Redirect href="/sign-in" />;
  if (!validUserId) return <Screen><View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}><Ionicons name="arrow-back" size={22} color={colors.ink} /></Pressable><Text style={styles.headerTitle}>Academic profile</Text><View style={styles.iconButtonPlaceholder} /></View><Card style={styles.center}><Ionicons name="link-outline" size={44} color={colors.inkMuted} /><Text style={styles.unavailable}>Invalid profile link</Text><Button label="Go back" variant="secondary" onPress={() => router.back()} /></Card></Screen>;

  return <Screen>
    <View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}><Ionicons name="arrow-back" size={22} color={colors.ink} /></Pressable><Text style={styles.headerTitle}>Academic profile</Text>{detail ? <Pressable accessibilityLabel={`Safety options for ${detail.profile.fullName}`} accessibilityRole="button" onPress={() => setShowSafety(true)} style={styles.iconButton}><Ionicons name="shield-checkmark-outline" size={21} color={colors.primary} /></Pressable> : <View style={styles.iconButtonPlaceholder} />}</View>
    {loading ? <Card style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Loading academic profile…</Text></Card> : null}
    {!loading && error && !detail ? <Card style={styles.center}><Ionicons name="person-remove-outline" size={44} color={colors.inkMuted} /><Text style={styles.unavailable}>Profile unavailable</Text><Text style={styles.muted}>{error}</Text><Button label="Go back" variant="secondary" onPress={() => router.back()} /></Card> : null}
    {!loading && detail && person ? <>
      <View style={styles.hero}><View style={[styles.avatar, { backgroundColor: person.color }]}>{detail.avatarUrl ? <Image accessibilityLabel={`${person.name} profile photo`} source={{ uri: detail.avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.initials}>{person.initials}</Text>}</View><Text style={styles.name}>{person.name}</Text><Text style={styles.username}>@{detail.profile.username}</Text><Text style={styles.academic}>{detail.profile.academicStage}</Text><Text style={styles.university}>{detail.profile.university}</Text>{detail.profile.department ? <Text style={styles.muted}>{detail.profile.department}{detail.profile.program ? ` · ${detail.profile.program}` : ''}</Text> : null}</View>
      <Card style={styles.matchCard}><View style={styles.matchTop}><Text style={styles.sectionLabel}>WHY YOU MATCH</Text><Text style={styles.score}>{person.score}%</Text></View><Text style={styles.body}>{person.reason}</Text></Card>
      <Card style={styles.section}><Text style={styles.sectionLabel}>RESEARCH</Text><Text style={styles.body}>{detail.profile.researchDescription}</Text><View style={styles.chips}>{detail.profile.researchInterests.map((interest) => <Chip key={interest} label={interest} />)}</View></Card>
      <Card style={styles.section}><Text style={styles.sectionLabel}>LANGUAGES</Text><View style={styles.chips}>{detail.profile.languages.map((language) => <Chip key={`${language.name}-${language.proficiency}`} label={`${language.name} · ${language.proficiency}`} />)}</View></Card>
      <Card style={styles.section}><Text style={styles.sectionLabel}>ACADEMIC GOALS</Text><View style={styles.chips}>{detail.profile.intents.map((intent) => <Chip key={intent} label={intent} />)}</View></Card>
      <Card style={styles.section}><Text style={styles.sectionLabel}>LOCATION & RELOCATION</Text>{person.location ? <Info icon="location-outline" text={person.location} /> : <Info icon="lock-closed-outline" text="Current location is private" />}{person.destination ? <Info icon="airplane-outline" text={`Moving to ${person.destination}${person.arrival ? ` · ${person.arrival}` : ''}`} /> : detail.profile.isRelocating ? <Info icon="lock-closed-outline" text="Relocation details are private" /> : <Info icon="home-outline" text="No relocation plan shared" />}</Card>
      {error ? <MessageBanner message={error} /> : null}{message ? <MessageBanner message={message} tone="success" /> : null}
      <View style={styles.actions}><Button label={busyAction === 'save' ? 'Saving…' : isSaved ? 'Remove saved profile' : 'Save profile'} variant="secondary" disabled={Boolean(busyAction)} icon={<Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={colors.ink} />} onPress={() => void saveProfile()} />
        {connectionState === 'matched' ? <Button label="Send message" icon={<Ionicons name="chatbubble-outline" size={20} color={colors.white} />} onPress={() => router.push({ pathname: '/chat/[userId]', params: { userId: detail.id } })} /> : <Button label={busyAction === 'connect' ? 'Connecting…' : connectionState === 'sent' ? 'Request sent' : connectionState === 'received' ? 'Connect back' : 'Connect'} disabled={Boolean(busyAction) || connectionState === 'sent'} onPress={() => void connectProfile()} />}
      </View>
      {connectionState !== 'matched' ? <Text style={styles.messageHint}>Messaging becomes available after you both connect.</Text> : null}
      {showSafety ? <SafetySheet targetId={detail.id} targetName={detail.profile.fullName} source="profile" onClose={() => setShowSafety(false)} onBlocked={() => router.replace('/(tabs)/discover')} /> : null}
    </> : null}
  </Screen>;
}

function Info({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.info}><Ionicons name={icon} size={19} color={colors.primary} /><Text style={styles.infoText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }, iconButtonPlaceholder: { width: 42, height: 42 }, center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md }, hero: { alignItems: 'center', gap: 4, paddingVertical: spacing.sm }, avatar: { width: 112, height: 112, borderRadius: 38, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.sm }, avatarImage: { width: '100%', height: '100%' }, initials: { color: colors.white, fontSize: 32, fontWeight: '900' }, name: { color: colors.ink, fontSize: 27, fontWeight: '900', textAlign: 'center' }, username: { color: colors.primary, fontWeight: '800' }, academic: { color: colors.ink, fontWeight: '700', marginTop: spacing.xs }, university: { color: colors.ink, textAlign: 'center' }, muted: { color: colors.inkMuted, textAlign: 'center', lineHeight: 20 }, unavailable: { color: colors.ink, fontSize: 20, fontWeight: '800' }, section: { gap: spacing.md }, sectionLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, body: { color: colors.ink, fontSize: 15, lineHeight: 22 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, matchCard: { gap: spacing.sm, backgroundColor: '#F7F1E4', borderColor: '#E8D8B4' }, matchTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, score: { color: colors.primaryDark, fontSize: 24, fontWeight: '900' }, info: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, infoText: { flex: 1, color: colors.ink, lineHeight: 20 }, actions: { gap: spacing.sm }, messageHint: { color: colors.inkMuted, fontSize: 12, textAlign: 'center', marginTop: -spacing.xs, marginBottom: spacing.md },
});
