import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen, SectionTitle } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

const documents = {
  terms: { title: 'Terms of Service', sections: ['Use Scholara respectfully and provide accurate account information.', 'Do not misuse discovery, messaging, reporting, or community features.', 'Scholara may restrict accounts that threaten users, privacy, security, or service availability.'] },
  privacy: { title: 'Privacy Notice', sections: ['Scholara stores account, academic profile, connection, message, community and safety data in Supabase.', 'Location fields are private by default and shared in discovery only when you enable the relevant visibility choice.', 'You can request an export or permanently delete your account from Settings. Safety reports may retain limited records where legally necessary.'] },
  community_guidelines: { title: 'Community Guidelines', sections: ['Discuss ideas and evidence without attacking people.', 'No harassment, impersonation, spam, discriminatory abuse, sexual misconduct, or exposure of private information.', 'Use reporting and blocking for safety. Repeated or severe violations may lead to account restrictions.'] },
} as const;

export default function LegalDocumentScreen() {
  const { document } = useLocalSearchParams<{ document: string }>();
  const content = documents[document as keyof typeof documents];
  if (!content) return <Screen><SectionTitle title="Document not found" /><Pressable onPress={() => router.back()}><Text style={styles.link}>Return to settings</Text></Pressable></Screen>;
  return <Screen><View style={styles.header}><Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} color={colors.ink} /></Pressable><Text style={styles.version}>Version 2026-09-11</Text></View><SectionTitle eyebrow="Scholara" title={content.title} subtitle="Pre-release policy for the Scholara MVP. It will be reviewed before public launch." />{content.sections.map((section, index) => <Card key={section} style={styles.section}><Text style={styles.number}>{index + 1}</Text><Text style={styles.text}>{section}</Text></Card>)}</Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, version: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' }, section: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, number: { color: colors.primary, fontSize: 20, fontWeight: '900' }, text: { flex: 1, color: colors.ink, lineHeight: 22 }, link: { color: colors.primary, fontWeight: '700' } });
