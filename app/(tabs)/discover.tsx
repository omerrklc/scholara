import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ResearcherCard } from '@/components/ResearcherCard';
import { SafetySheet } from '@/components/SafetySheet';
import { BrandMark, Button, Card, MessageBanner, Screen, SectionTitle, SegmentedControl } from '@/components/ui';
import { fetchDiscoveryProfiles, rankResearchers } from '@/services/discovery';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';
import type { DiscoveryMode, Profile, Researcher } from '@/types/domain';

type DiscoveryProfile = Profile & { id: string };

export default function DiscoverScreen() {
  const { profile, session, saved, connectionStates, toggleSaved, connect } = useApp();
  const [mode, setMode] = useState<DiscoveryMode>('research');
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [passed, setPassed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [connectingId, setConnectingId] = useState('');
  const [safetyTarget, setSafetyTarget] = useState<Researcher | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    const result = await fetchDiscoveryProfiles(session.user.id);
    setProfiles(result.profiles);
    setError(result.error ?? '');
    setPassed([]);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void fetchDiscoveryProfiles(session.user.id).then((result) => {
      if (!active) return;
      setProfiles(result.profiles);
      setError(result.error ?? '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [session]);

  const candidates = useMemo(
    () => rankResearchers(profile, profiles, mode).filter((candidate) => !connectionStates[candidate.id]),
    [connectionStates, mode, profile, profiles],
  );
  const person = candidates.find((candidate) => !passed.includes(candidate.id));
  const next = () => person && setPassed((current) => [...current, person.id]);
  const changeMode = (value: DiscoveryMode) => { setMode(value); setPassed([]); };
  const savePerson = async () => {
    if (!person || savingId) return;
    setActionError('');
    setActionMessage('');
    setSavingId(person.id);
    const wasSaved = saved.includes(person.id);
    const result = await toggleSaved(person.id);
    setSavingId('');
    if (result) setActionError(result);
    else setActionMessage(wasSaved ? 'Removed from saved profiles.' : 'Profile saved.');
  };
  const connectPerson = async () => {
    if (!person || connectingId) return;
    setActionError('');
    setActionMessage('');
    setConnectingId(person.id);
    const result = await connect(person.id);
    setConnectingId('');
    if (result.error) setActionError(result.error);
    else setActionMessage(result.state === 'matched' ? `It's a match! You and ${person.name} can now connect.` : 'Connection request sent.');
  };

  return <Screen>
    <View style={styles.header}><BrandMark compact /><View><Text style={styles.greeting}>Good afternoon</Text><Text style={styles.question}>Who should you know?</Text></View></View>
    <SegmentedControl value={mode} onChange={changeMode} options={[{ label: 'Research', value: 'research' }, { label: 'Moving', value: 'moving' }]} />
    <SectionTitle eyebrow={mode === 'research' ? 'Based on your research' : 'Based on your next city'} title={mode === 'research' ? 'A relevant researcher' : 'A useful local connection'} subtitle={mode === 'moving' ? 'People already there—or arriving around the same time.' : 'Similarity is explained, not hidden behind a score.'} />
    {actionError ? <MessageBanner message={actionError} /> : null}
    {actionMessage ? <MessageBanner message={actionMessage} tone="success" /> : null}
    {loading ? <Card style={styles.state}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.stateTitle}>Finding relevant researchers…</Text><Text style={styles.stateText}>Comparing academic interests and relocation context.</Text></Card> : null}
    {!loading && error ? <><MessageBanner message="Discover profiles could not be loaded. Please check your connection and try again." /><Button label="Try again" variant="secondary" onPress={() => void loadProfiles()} /></> : null}
    {!loading && !error && person ? <ResearcherCard person={person} saved={saved.includes(person.id)} connectionState={connectionStates[person.id]} saving={savingId === person.id} connecting={connectingId === person.id} onPass={next} onSave={() => void savePerson()} onConnect={() => void connectPerson()} onSafety={() => setSafetyTarget(person)} /> : null}
    {!loading && !error && !person ? <Card style={styles.state}><Ionicons name={mode === 'moving' ? 'airplane-outline' : 'people-outline'} size={44} color={colors.primary} /><Text style={styles.stateTitle}>{profiles.length === 0 ? 'You are early to Scholara' : mode === 'moving' ? 'No relocation matches yet' : 'You reviewed everyone for now'}</Text><Text style={styles.stateText}>{profiles.length === 0 ? 'New researchers will appear here after they complete their academic profiles.' : mode === 'moving' ? 'Try again as more researchers add their destination details.' : 'Refresh to check for new completed profiles.'}</Text><Button label={passed.length ? 'Review again' : 'Refresh profiles'} variant="secondary" onPress={passed.length ? () => setPassed([]) : () => void loadProfiles()} /></Card> : null}
    {!loading && !error ? <Text style={styles.note}>Recommendations use completed Scholara profiles and transparent, deterministic matching signals.</Text> : null}
    {safetyTarget ? <SafetySheet targetId={safetyTarget.id} targetName={safetyTarget.name} source="discover" onClose={() => setSafetyTarget(null)} onBlocked={() => {
      setProfiles((current) => current.filter((item) => item.id !== safetyTarget.id));
      setPassed((current) => current.filter((id) => id !== safetyTarget.id));
      void loadProfiles();
    }} /> : null}
  </Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 }, greeting: { color: colors.inkMuted, fontSize: 12 }, question: { color: colors.ink, fontSize: 18, fontWeight: '800' }, state: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }, stateTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'center' }, stateText: { color: colors.inkMuted, textAlign: 'center', lineHeight: 21, marginBottom: spacing.xs }, note: { textAlign: 'center', color: colors.inkMuted, fontSize: 11, lineHeight: 16, paddingHorizontal: spacing.lg } });
