import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, Chip, Field, MessageBanner, Screen, SectionTitle } from '@/components/ui';
import { chooseAndUploadProfilePhoto, createProfilePhotoUrl, removeProfilePhoto } from '@/services/profilePhotos';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';
import type { AcademicStage, Profile } from '@/types/domain';

const stages: AcademicStage[] = ['Final-year undergraduate', "Master's student", 'PhD student', 'Postdoc'];
const intents = ['Find researchers like me', 'Find collaborators', 'Discuss my research', 'Meet graduate students', 'Moving abroad', 'Find research opportunities'];
const suggestedTags = ['Urban Planning', 'Sustainable Mobility', 'GIS', 'Pedestrianisation', 'Micromobility'];
const proficiencyLevels = ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Beginner'];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const { profile: storedProfile, completeOnboarding, session } = useApp();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>(storedProfile);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const progress = `${step + 1} of 8`;
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((current) => ({ ...current, [key]: value }));
  const toggle = (key: 'intents' | 'researchInterests', value: string) => update(key, profile[key].includes(value) ? profile[key].filter((item) => item !== value) : [...profile[key], value]);

  useEffect(() => {
    let active = true;
    if (!profile.avatarPath) {
      return () => { active = false; };
    }
    void createProfilePhotoUrl(profile.avatarPath).then((url) => { if (active) setPhotoUri(url); });
    return () => { active = false; };
  }, [profile.avatarPath]);

  const updateLanguage = (index: number, key: 'name' | 'proficiency', value: string) => {
    update('languages', profile.languages.map((language, itemIndex) => itemIndex === index ? { ...language, [key]: value } : language));
  };

  const choosePhoto = async () => {
    if (!session || photoBusy) return;
    setPhotoBusy(true);
    setSaveError('');
    const result = await chooseAndUploadProfilePhoto(session.user.id);
    setPhotoBusy(false);
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    if (result.avatarPath) {
      update('avatarPath', result.avatarPath);
      setPhotoUri(result.previewUri);
    }
  };

  const removePhoto = async () => {
    if (!session || photoBusy) return;
    setPhotoBusy(true);
    setSaveError('');
    const error = await removeProfilePhoto(session.user.id);
    setPhotoBusy(false);
    if (error) {
      setSaveError(error);
      return;
    }
    update('avatarPath', '');
    setPhotoUri(null);
  };

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(
      profile.fullName.trim()
      && /^[a-z0-9_]{3,30}$/.test(profile.username.trim().toLocaleLowerCase())
      && profile.academicStage
    );
    if (step === 1) return Boolean(profile.university.trim() && profile.department.trim());
    if (step === 2) return profile.researchDescription.trim().length >= 30;
    if (step === 3) return profile.intents.length > 0;
    if (step === 4) return Boolean(profile.currentCity.trim() && profile.currentCountry.trim() && (!profile.isRelocating || (profile.destinationCity.trim() && profile.destinationCountry.trim())));
    if (step === 5) {
      const names = profile.languages.map((language) => language.name.trim().toLocaleLowerCase());
      return profile.languages.length > 0
        && profile.languages.every((language) => language.name.trim() && language.proficiency.trim())
        && new Set(names).size === names.length;
    }
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
    {step === 0 && <><SectionTitle eyebrow="Academic identity" title="How should researchers find you?" subtitle="Use the name and username you want shown across Scholara." /><Field label="Full name" maxLength={100} placeholder="e.g. Ömer Kılıç" value={profile.fullName} onChangeText={(value) => update('fullName', value)} /><Field label="Username" autoCapitalize="none" autoCorrect={false} maxLength={30} placeholder="e.g. omer_kilic" value={profile.username} onChangeText={(value) => update('username', value.toLocaleLowerCase().replace(/[^a-z0-9_]/g, ''))} /><Text style={styles.helper}>3–30 characters · lowercase letters, numbers and underscore only</Text><Text style={styles.label}>Academic stage</Text><View style={styles.options}>{stages.map((stage) => <Chip key={stage} label={stage} selected={profile.academicStage === stage} onPress={() => update('academicStage', stage)} />)}</View></>}
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
    {step === 5 && <><SectionTitle eyebrow="Languages" title="How do you connect?" subtitle="Add each language and choose your current proficiency." />
      {profile.languages.map((language, index) => <Card key={`language-${index}`} style={styles.languageCard}>
        <View style={styles.languageHeader}><Text style={styles.languageName}>Language {index + 1}</Text>{profile.languages.length > 1 ? <Pressable accessibilityLabel={`Remove language ${index + 1}`} accessibilityRole="button" hitSlop={8} onPress={() => update('languages', profile.languages.filter((_, itemIndex) => itemIndex !== index))}><Ionicons name="trash-outline" size={21} color={colors.danger} /></Pressable> : null}</View>
        <Field label="Language" maxLength={50} placeholder="e.g. Turkish" value={language.name} onChangeText={(value) => updateLanguage(index, 'name', value)} />
        <Text style={styles.label}>Proficiency</Text><View style={styles.options}>{proficiencyLevels.map((level) => <Chip key={level} label={level} selected={language.proficiency === level} onPress={() => updateLanguage(index, 'proficiency', level)} />)}</View>
      </Card>)}
      {new Set(profile.languages.map((language) => language.name.trim().toLocaleLowerCase())).size !== profile.languages.length ? <MessageBanner message="Add each language only once." /> : null}
      <Button label={profile.languages.length >= 10 ? 'Maximum 10 languages' : 'Add another language'} variant="secondary" disabled={profile.languages.length >= 10} onPress={() => update('languages', [...profile.languages, { name: '', proficiency: 'Intermediate' }])} />
    </>}
    {step === 6 && <><SectionTitle eyebrow="Profile photo" title="Put a face to your research." subtitle="Choose a clear square photo. It is optional and can be changed later." /><View style={styles.photo}>{photoUri ? <Image accessibilityLabel="Your profile photo" source={{ uri: photoUri }} style={styles.photoImage} /> : <Ionicons name="person-outline" size={54} color={colors.primary} />}</View><Button label={photoBusy ? 'Preparing photo…' : photoUri ? 'Change photo' : 'Choose a photo'} variant="secondary" disabled={!session || photoBusy} onPress={() => void choosePhoto()} />{photoUri ? <Button label="Remove photo" variant="ghost" disabled={photoBusy} onPress={() => void removePhoto()} /> : null}<Text style={styles.centerHelper}>JPEG only · maximum 5 MB after optimization · you can safely skip this step.</Text></>}
    {step === 7 && <><SectionTitle eyebrow="Profile preview" title="Ready to meet your academic world?" /><Card style={styles.preview}><View style={styles.previewTop}><View style={styles.previewAvatar}>{photoUri ? <Image accessibilityLabel="Your profile photo preview" source={{ uri: photoUri }} style={styles.photoImage} /> : <Text style={styles.previewInitials}>{profile.fullName.split(' ').map((word) => word[0]).join('')}</Text>}</View><View style={styles.half}><Text style={styles.previewName}>{profile.fullName}</Text><Text style={styles.helper}>{profile.academicStage}</Text><Text style={styles.helper}>{profile.university}</Text></View></View><Text style={styles.previewResearch}>{profile.researchDescription || 'Your research description will appear here.'}</Text><View style={styles.options}>{profile.researchInterests.map((tag) => <Chip key={tag} label={tag} />)}</View><View style={styles.options}>{profile.languages.map((language) => <Chip key={language.name} label={`${language.name} · ${language.proficiency}`} />)}</View>{profile.isRelocating && <Text style={styles.moving}>Moving to {profile.destinationCity}, {profile.destinationCountry} · {profile.relocationDate || 'Date to be confirmed'}</Text>}</Card></>}
    {saveError ? <MessageBanner message={saveError} /> : null}
    {!session ? <MessageBanner message="Create an account or sign in before saving your academic profile." tone="info" /> : null}
    <View style={styles.footer}><Button label={saving ? 'Saving profile…' : step === 7 ? 'Start discovering' : 'Continue'} disabled={!canContinue || saving} onPress={() => step === 7 ? void finish() : setStep(step + 1)} /></View>
  </Screen>;
}

function VisibilityChoice({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Card style={styles.visibility}><View style={styles.visibilityText}><Ionicons name={value ? 'eye-outline' : 'lock-closed-outline'} size={20} color={colors.primary} /><Text style={styles.visibilityLabel}>{label}</Text></View><View style={styles.row}><Chip label="Visible" selected={value} onPress={() => onChange(true)} /><Chip label="Private" selected={!value} onPress={() => onChange(false)} /></View></Card>;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, progressText: { color: colors.primary, fontWeight: '800' }, skip: { color: colors.inkMuted, fontSize: 12 }, progressTrack: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginBottom: spacing.md }, progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, helper: { color: colors.inkMuted, fontSize: 13 }, label: { color: colors.ink, fontSize: 14, fontWeight: '700' }, row: { flexDirection: 'row', gap: 10 }, rowCompact: { flexDirection: 'column' }, half: { flex: 1 }, visibility: { gap: spacing.sm, backgroundColor: colors.primarySoft }, visibilityText: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, visibilityLabel: { flex: 1, color: colors.primaryDark, fontWeight: '700' }, footer: { marginTop: 'auto', paddingTop: spacing.lg }, languageCard: { gap: spacing.md }, languageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, languageName: { color: colors.ink, fontWeight: '800', fontSize: 16 }, photo: { alignSelf: 'center', width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderStyle: 'dashed', borderColor: '#A8CFC1', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.lg, overflow: 'hidden' }, photoImage: { width: '100%', height: '100%' }, centerHelper: { textAlign: 'center', color: colors.inkMuted }, preview: { gap: spacing.md, padding: 20 }, previewTop: { flexDirection: 'row', alignItems: 'center', gap: 14 }, previewAvatar: { width: 68, height: 68, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, previewInitials: { color: colors.white, fontWeight: '900', fontSize: 22 }, previewName: { color: colors.ink, fontWeight: '900', fontSize: 21 }, previewResearch: { color: colors.ink, lineHeight: 22 }, moving: { color: colors.primaryDark, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, fontWeight: '700' },
});
