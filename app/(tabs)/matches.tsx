import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import { fetchDiscoveryProfiles, rankResearchers } from '@/services/discovery';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';
import type { Profile, Researcher } from '@/types/domain';

type DiscoveryProfile = Profile & { id: string };

export default function MatchesScreen() {
  const { connectionStates, connect, profile, refreshActions, session } = useApp();
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [connectingId, setConnectingId] = useState('');

  const load = async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    const [result, actionsError] = await Promise.all([
      fetchDiscoveryProfiles(session.user.id),
      refreshActions(),
    ]);
    setProfiles(result.profiles);
    setError(result.error ?? actionsError ?? '');
    setLoading(false);
  };

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
  const ranked = useMemo(() => rankResearchers(profile, profiles, 'research'), [profile, profiles]);
  const byId = useMemo(() => new Map(ranked.map((person) => [person.id, person])), [ranked]);
  const people = Object.entries(connectionStates).map(([id, state]) => ({ person: byId.get(id), state })).filter((item): item is { person: Researcher; state: 'sent' | 'received' | 'matched' } => Boolean(item.person));
  const accept = async (person: Researcher) => {
    if (connectingId) return;
    setError('');
    setMessage('');
    setConnectingId(person.id);
    const result = await connect(person.id);
    setConnectingId('');
    if (result.error) setError(result.error);
    else if (result.state === 'matched') setMessage(`It's a match! You and ${person.name} can now connect.`);
  };

  return <Screen>
    <SectionTitle eyebrow="Connections" title="Your academic connections." subtitle="Requests become matches when both researchers choose to connect." />
    {message ? <MessageBanner message={message} tone="success" /> : null}
    {loading ? <Card style={styles.empty}><ActivityIndicator color={colors.primary} /><Text style={styles.emptyText}>Loading your requests…</Text></Card> : null}
    {!loading && error ? <><MessageBanner message="Connection requests could not be loaded." /><Button label="Try again" variant="secondary" onPress={() => void load()} /></> : null}
    {!loading && !error && people.length === 0 ? <Card style={styles.empty}><Ionicons name="git-compare-outline" size={42} color={colors.primary} /><Text style={styles.emptyTitle}>No connection requests yet</Text><Text style={styles.emptyText}>When you tap Connect on a real profile in Discover, your request will appear here.</Text></Card> : people.map(({ person, state }) => <Card key={person.id} style={styles.match}><View style={[styles.avatar, { backgroundColor: person.color }]}><Text style={styles.initials}>{person.initials}</Text></View><View style={styles.detail}><Text style={styles.name}>{person.name}</Text><Text style={styles.meta}>{person.score}% research match · {state === 'matched' ? 'Matched' : state === 'received' ? 'Wants to connect' : 'Request sent'}</Text></View>{state === 'received' ? <View style={styles.accept}><Button label={connectingId === person.id ? 'Connecting…' : 'Connect back'} disabled={Boolean(connectingId)} onPress={() => void accept(person)} /></View> : <Ionicons name={state === 'matched' ? 'checkmark-circle' : 'time-outline'} size={23} color={state === 'matched' ? colors.primary : colors.accent} />}</Card>)}
  </Screen>;
}

const styles = StyleSheet.create({ empty: { alignItems: 'center', gap: 10, paddingVertical: spacing.xl }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' }, emptyText: { color: colors.inkMuted, textAlign: 'center', lineHeight: 21 }, match: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, initials: { color: colors.white, fontWeight: '900' }, detail: { flex: 1, minWidth: 0, gap: 3 }, name: { color: colors.ink, fontWeight: '800', fontSize: 16 }, meta: { color: colors.inkMuted, fontSize: 12 }, accept: { width: 132 } });
