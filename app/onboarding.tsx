import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, Chip, Field, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';
import type { AcademicStage, Profile } from '@/types/domain';

const stages: AcademicStage[] = ['Final-year undergraduate', "Master's student", 'PhD student', 'Postdoc'];
const intents = ['Find researchers like me', 'Find collaborators', 'Discuss my research', 'Meet graduate students', 'Moving abroad', 'Find research opportunities'];
const suggestedTags = ['Urban Planning', 'Sustainable Mobility', 'GIS', 'Pedestrianisation', 'Micromobility'];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const { profile: storedProfile, completeOnboarding, session } = useApp();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>(storedProfile);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const progress = `${step + 1} of 8`;
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((current) => ({ ...current, [key]: value }));
  const toggle = (key: 'intents' | 'researchInterests', value: string) => update(key, profile[key].includes(value) ? profile[key].filter((item) => item !== value) : [...profile[key], value]);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(profile.academicStage);
    if (step === 1) return Boolean(profile.university.trim() && profile.department.trim());
    if (step === 2) return profile.researchDescription.trim().length >= 30;
    if (step === 3) return profile.intents.length > 0;
    if (step === 4) return Boolean(profile.currentCity.trim() && profile.currentCountry.trim() && (!profile.isRelocating || (profile.destinationCity.trim() && profile.destinationCountry.trim())));
    if (step === 5) return profile.languages.length > 0;
    return true;
  }, [step, profile]);

  const finish = async () => {
    setSaving(true);
    setSaveError('');
    const error = await completeOnboarding(profile);
    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }
    router.replace('/(tabs)/discover');
  };
  return <Screen>
    <View style={styles.top}><Pressable onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} color={colors.ink} /></Pressable><Text style={styles.progressText}>{progress}</Text><Text numberOfLines={1} style={styles.skip}>Profile setup</Text></View>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((step + 1) / 8) * 100}%` }]} /></View>
    {step === 0 && <><SectionTitle eyebrow="Academic stage" title="Where are you in your academic journey?" subtitle="This helps us suggest peers with useful shared context." /><View style={styles.options}>{stages.map((stage) => <Chip key={stage} label={stage} selected={profile.academicStage === stage} onPress={() => update('academicStage', stage)} />)}</View></>}
    {step === 1 && <><SectionTitle eyebrow="Institution" title="Where do you study or research?" /><Field label="University" maxLength={160} placeholder="e.g. Istanbul Technical University" value={profile.university} onChangeText={(value) => update('university', value)} /><Field label="Department / field" maxLength={120} placeholder="e.g. Urban and Regional Planning" value={profile.department} onChangeText={(value) => update('department', value)} /><Field label="Program (optional)" maxLength={160} placeholder="e.g. MSc Urban Planning" value={profile.program} onChangeText={(value) => update('program', value)} /></>}
    {step === 2 && <><SectionTitle eyebrow="Your research" title="What do you research?" subtitle="Describe it in your own words. We use this to find people working on related questions." /><Field label="Research description" multiline maxLength={3000} placeholder="I'm studying how pedestrianisation and micromobility affect accessibility in historic city centres..." value={profile.researchDescription} onChangeText={(value) => update('researchDescription', value)} /><Text style={styles.helper}>{profile.researchDescription.trim().length}/30 minimum · 3000 maximum</Text><Text style={styles.label}>Suggested interests</Text><View style={styles.options}>{suggestedTags.map((tag) => <Chip key={tag} label={tag} selected={profile.researchInterests.includes(tag)} onPress={() => toggle('researchInterests', tag)} />)}</View></>}
    {step === 3 && <><SectionTitle eyebrow="Your goals" title="What are you here for?" subtitle="Choose as many as you like." /><View style={styles.options}>{intents.map((intent) => <Chip key={intent} label={intent} selected={profile.intents.includes(intent)} onPress={() => toggle('intents', intent)} />)}</View></>}
    {step === 4 && <>
      <SectionTitle eyebrow="Location" title="Where are you now—and where are you going?" subtitle="Your location details stay private unless you choose to share them." />
      <View style={[styles.row, width < 420 && styles.rowCompact]}><View style={styles.half}><Field label="Current city" maxLength={100} placeholder="Istanbul" value={profile.currentCity} onChangeText={(value) => update('currentCity', value)} /></View><View style={styles.half}><Field label="Country" maxLength={100} placeholder="Türkiye" value={profile.currentCountry} onChangeText={(value) => update('currentCountry', value)} /></View></View>
      <VisibilityChoice label="Show my current city in Discover" value={profile.showCurrentLocation} onChange={(value) => update('showCurrentLocation', value)} />
      <Text style={styles.label}>Planning to move for study or research?</Text>
      <View style={styles.row}><View style={styles.half}><Chip label="Yes" selected={profile.isRelocating} onPress={() => update('isRelocating', true)} /></View><View style={styles.half}><Chip label="Not yet" selected={!profile.isRelocating} onPress={() => update('isRelocating', false)} /></View></View>
      {profile.isRelocating && <>
        <View style={[styles.row, width < 420 && styles.rowCompact]}><View style={styles.half}><Field label="Destination city" maxLength={100} placeholder="Stockholm" value={profile.destinationCity} onChangeText={(value) => update('destinationCity', value)} /></View><View style={styles.half}><Field label="Country" maxLength={100} placeholder="Sweden" value={profile.destinationCountry} onChangeText={(value) => update('destinationCountry', value)} /></View></View>
        <VisibilityChoice label="Show my destination in Discover" value={profile.showRelocationDestination} onChange={(value) => update('showRelocationDestination', value)} />
        <Field label="Expected month and year" maxLength={30} placeholder="September 2027" value={profile.relocationDate} onChangeText={(value) => update('relocationDate', value)} />
        <VisibilityChoice label="Show my expected moving date" value={profile.showRelocationDate} onChange={(value) => update('showRelocationDate', value)} />
      </>}
    </>}
    {step === 5 && <><SectionTitle eyebrow="Languages" title="How do you connect?" subtitle="Add proficiency later; English is included for the prototype." /><Card><View style={styles.languageRow}><View><Text style={styles.languageName}>English</Text><Text style={styles.helper}>Fluent</Text></View><Ionicons name="checkmark-circle" size={26} color={colors.primary} /></View></Card><Button label="Add another language" variant="secondary" onPress={() => update('languages', [...profile.languages, { name: 'Turkish', proficiency: 'Native' }])} /></>}
    {step === 6 && <><SectionTitle eyebrow="Profile photo" title="Put a face to your research." subtitle="A photo is encouraged, but never required. You can add one from your device after the prototype phase." /><View style={styles.photo}><Ionicons name="person-outline" size={54} color={colors.primary} /></View><Button label="Choose a photo" variant="secondary" onPress={() => {}} /><Text style={styles.centerHelper}>You can safely skip this step.</Text></>}
    {step === 7 && <><SectionTitle eyebrow="Profile preview" title="Ready to meet your academic world?" /><Card style={styles.preview}><View style={styles.previewTop}><View style={styles.previewAvatar}><Text style={styles.previewInitials}>{profile.fullName.split(' ').map((word) => word[0]).join('')}</Text></View><View style={styles.half}><Text style={styles.previewName}>{profile.fullName}</Text><Text style={styles.helper}>{profile.academicStage}</Text><Text style={styles.helper}>{profile.university}</Text></View></View><Text style={styles.previewResearch}>{profile.researchDescription || 'Your research description will appear here.'}</Text><View style={styles.options}>{profile.researchInterests.map((tag) => <Chip key={tag} label={tag} />)}</View>{profile.isRelocating && <Text style={styles.moving}>Moving to {profile.destinationCity}, {profile.destinationCountry} · {profile.relocationDate || 'Date to be confirmed'}</Text>}</Card></>}
    {saveError ? <MessageBanner message={saveError} /> : null}
    {!session ? <MessageBanner message="Create an account or sign in before saving your academic profile." tone="info" /> : null}
    <View style={styles.footer}><Button label={saving ? 'Saving profile…' : step === 7 ? 'Start discovering' : 'Continue'} disabled={!canContinue || saving} onPress={() => step === 7 ? void finish() : setStep(step + 1)} /></View>
  </Screen>;
}

function VisibilityChoice({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Card style={styles.visibility}><View style={styles.visibilityText}><Ionicons name={value ? 'eye-outline' : 'lock-closed-outline'} size={20} color={colors.primary} /><Text style={styles.visibilityLabel}>{label}</Text></View><View style={styles.row}><Chip label="Visible" selected={value} onPress={() => onChange(true)} /><Chip label="Private" selected={!value} onPress={() => onChange(false)} /></View></Card>;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, progressText: { color: colors.primary, fontWeight: '800' }, skip: { color: colors.inkMuted, fontSize: 12 }, progressTrack: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginBottom: spacing.md }, progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, helper: { color: colors.inkMuted, fontSize: 13 }, label: { color: colors.ink, fontSize: 14, fontWeight: '700' }, row: { flexDirection: 'row', gap: 10 }, rowCompact: { flexDirection: 'column' }, half: { flex: 1 }, visibility: { gap: spacing.sm, backgroundColor: colors.primarySoft }, visibilityText: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, visibilityLabel: { flex: 1, color: colors.primaryDark, fontWeight: '700' }, footer: { marginTop: 'auto', paddingTop: spacing.lg }, languageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, languageName: { color: colors.ink, fontWeight: '800', fontSize: 16 }, photo: { alignSelf: 'center', width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderStyle: 'dashed', borderColor: '#A8CFC1', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.lg }, centerHelper: { textAlign: 'center', color: colors.inkMuted }, preview: { gap: spacing.md, padding: 20 }, previewTop: { flexDirection: 'row', alignItems: 'center', gap: 14 }, previewAvatar: { width: 68, height: 68, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, previewInitials: { color: colors.white, fontWeight: '900', fontSize: 22 }, previewName: { color: colors.ink, fontWeight: '900', fontSize: 21 }, previewResearch: { color: colors.ink, lineHeight: 22 }, moving: { color: colors.primaryDark, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, fontWeight: '700' },
});
