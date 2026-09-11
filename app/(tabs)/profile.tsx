import { Ionicons } from '@expo/vector-icons';
import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, MessageBanner, Screen } from '@/components/ui';
import { fetchBlockedUsers, unblockUser, type BlockedUser } from '@/services/moderation';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const { profile, onboardingComplete, session, signOut } = useApp();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedError, setBlockedError] = useState('');
  const [unblockingId, setUnblockingId] = useState('');

  const loadBlockedUsers = useCallback(async () => {
    if (!session) return;
    setBlockedLoading(true);
    setBlockedError('');
    const result = await fetchBlockedUsers();
    setBlockedUsers(result.users);
    setBlockedError(result.error ?? '');
    setBlockedLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => { void loadBlockedUsers(); }, [loadBlockedUsers]));

  const unblock = async (user: BlockedUser) => {
    if (unblockingId) return;
    setUnblockingId(user.id);
    setBlockedError('');
    const result = await unblockUser(user.id);
    setUnblockingId('');
    if (result) setBlockedError(result);
    else setBlockedUsers((current) => current.filter((item) => item.id !== user.id));
  };
  const logOut = async () => {
    const error = await signOut();
    if (!error) router.replace('/');
  };
  return <Screen>
    <View style={styles.hero}><View style={styles.avatar}><Text style={styles.initials}>{profile.fullName.split(' ').map((word) => word[0]).join('')}</Text></View><Text style={styles.name}>{profile.fullName}</Text><Text style={styles.handle}>@{profile.username}</Text><Text style={styles.meta}>{profile.academicStage || 'Academic stage not added'} · {profile.university || 'University not added'}</Text></View>
    {!onboardingComplete && <Card style={styles.notice}><Ionicons name="information-circle-outline" size={22} color={colors.primary} /><Text style={styles.noticeText}>This demo profile is incomplete. Finish onboarding to personalize Discover.</Text></Card>}
    <Card style={styles.section}><Text style={styles.label}>RESEARCH</Text><Text style={styles.research}>{profile.researchDescription || 'Add a concise description of your research question, methods, and context.'}</Text><View style={styles.tags}>{profile.researchInterests.length ? profile.researchInterests.map((tag) => <Chip key={tag} label={tag} />) : <Chip label="No interests yet" />}</View></Card>
    <Card style={styles.section}><Text style={styles.label}>ACADEMIC LOCATION</Text><Info icon="location-outline" text={profile.currentCity ? `${profile.currentCity}, ${profile.currentCountry}` : 'Current location not added'} />{profile.isRelocating && <Info icon="airplane-outline" text={`Moving to ${profile.destinationCity}, ${profile.destinationCountry} · ${profile.relocationDate}`} />}</Card>
    <Card style={styles.section}><Text style={styles.label}>TRUST & SAFETY</Text><Info icon="shield-checkmark-outline" text="Reports are private. Blocked researchers cannot find, match with or message you." /><Info icon="finger-print-outline" text="University email and ORCID verification prepared for V1.5." /></Card>
    <Card style={styles.section}>
      <Text style={styles.label}>BLOCKED USERS</Text>
      {blockedError ? <MessageBanner message={blockedError} /> : null}
      {blockedLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {!blockedLoading && blockedUsers.length === 0 ? <Text style={styles.empty}>You have not blocked anyone.</Text> : blockedUsers.map((user) => <View key={user.id} style={styles.blockedRow}><View style={styles.blockedDetail}><Text style={styles.blockedName}>{user.name}</Text><Text numberOfLines={1} style={styles.blockedMeta}>{user.stage}{user.university ? ` · ${user.university}` : ''}</Text></View><View style={styles.unblock}><Button label={unblockingId === user.id ? '…' : 'Unblock'} variant="secondary" disabled={Boolean(unblockingId)} onPress={() => void unblock(user)} /></View></View>)}
      <Button label="Refresh blocked users" variant="ghost" disabled={blockedLoading} onPress={() => void loadBlockedUsers()} />
    </Card>
    <Button label="Edit onboarding profile" variant="secondary" onPress={() => router.push('/onboarding')} />
    <Button label="Account & privacy settings" variant="secondary" icon={<Ionicons name="settings-outline" size={20} color={colors.ink} />} onPress={() => router.push('/settings' as Href)} />
    {session ? <Button label="Sign out" variant="ghost" onPress={() => void logOut()} /> : null}
  </Screen>;
}

function Info({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) { return <View style={styles.info}><Ionicons name={icon} size={19} color={colors.primary} /><Text style={styles.infoText}>{text}</Text></View>; }

const styles = StyleSheet.create({ hero: { alignItems: 'center', gap: 5, paddingVertical: spacing.md }, avatar: { width: 90, height: 90, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 7 }, initials: { color: colors.white, fontSize: 28, fontWeight: '900' }, name: { color: colors.ink, fontSize: 25, fontWeight: '900' }, handle: { color: colors.primary, fontWeight: '700' }, meta: { color: colors.inkMuted, textAlign: 'center' }, notice: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.primarySoft }, noticeText: { flex: 1, color: colors.primaryDark, lineHeight: 19 }, section: { gap: 12 }, label: { color: colors.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, research: { color: colors.ink, fontSize: 15, lineHeight: 22 }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, info: { flexDirection: 'row', alignItems: 'center', gap: 9 }, infoText: { flex: 1, color: colors.ink, lineHeight: 20 }, empty: { color: colors.inkMuted, fontSize: 13 }, blockedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, blockedDetail: { flex: 1, minWidth: 0, gap: 2 }, blockedName: { color: colors.ink, fontWeight: '800' }, blockedMeta: { color: colors.inkMuted, fontSize: 11 }, unblock: { width: 108 } });
