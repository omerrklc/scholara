import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ResearcherCard } from '@/components/ResearcherCard';
import { BrandMark, Screen, SectionTitle, SegmentedControl } from '@/components/ui';
import { researchers } from '@/data/mock';
import { useApp } from '@/state/AppProvider';
import { colors, spacing } from '@/theme/tokens';
import type { DiscoveryMode } from '@/types/domain';

export default function DiscoverScreen() {
  const { saved, connected, toggleSaved, connect } = useApp();
  const [mode, setMode] = useState<DiscoveryMode>('research');
  const [index, setIndex] = useState(0);
  const candidates = useMemo(() => mode === 'moving' ? researchers.filter((person) => person.destination) : researchers, [mode]);
  const person = candidates[index % candidates.length];
  const next = () => setIndex((current) => current + 1);
  return <Screen>
    <View style={styles.header}><BrandMark compact /><View><Text style={styles.greeting}>Good afternoon</Text><Text style={styles.question}>Who should you know?</Text></View></View>
    <SegmentedControl value={mode} onChange={(value) => { setMode(value); setIndex(0); }} options={[{ label: 'Research', value: 'research' }, { label: 'Moving', value: 'moving' }]} />
    <SectionTitle eyebrow={mode === 'research' ? 'Based on your research' : 'Based on your next city'} title={mode === 'research' ? 'A relevant researcher' : 'A useful local connection'} subtitle={mode === 'moving' ? 'People already there—or arriving around the same time.' : 'Similarity is explained, not hidden behind a score.'} />
    <ResearcherCard person={person} saved={saved.includes(person.id)} connected={connected.includes(person.id)} onPass={next} onSave={() => toggleSaved(person.id)} onConnect={() => connect(person.id)} />
    <Text style={styles.note}>Prototype recommendations use deterministic mock scores. The matching service will replace these in a later phase.</Text>
  </Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 }, greeting: { color: colors.inkMuted, fontSize: 12 }, question: { color: colors.ink, fontSize: 18, fontWeight: '800' }, note: { textAlign: 'center', color: colors.inkMuted, fontSize: 11, lineHeight: 16, paddingHorizontal: spacing.lg } });
