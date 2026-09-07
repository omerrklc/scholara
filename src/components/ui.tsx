import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '@/theme/tokens';

export function Screen({ children, scroll = true, style }: PropsWithChildren<{ scroll?: boolean; style?: StyleProp<ViewStyle> }>) {
  const content = <View style={[styles.screenContent, style]}>{children}</View>;
  return <SafeAreaView edges={['top']} style={styles.safe}>{scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}</SafeAreaView>;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <View style={styles.brandRow}><View style={styles.brandIcon}><Text style={styles.brandGlyph}>S</Text></View>{!compact && <Text style={styles.brand}>Scholara</Text>}</View>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, icon }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; icon?: ReactNode }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${variant}`], pressed && styles.pressed, disabled && styles.disabled]}>{icon}<Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{label}</Text></Pressable>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const content = <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>;
  return onPress ? <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>{content}</Pressable> : <View style={[styles.chip, selected && styles.chipSelected]}>{content}</View>;
}

export function Field({ label, multiline = false, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.fieldWrap}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor="#8C9691" multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.textarea]} {...props} /></View>;
}

export function SegmentedControl<T extends string>({ value, options, onChange }: { value: T; options: { label: string; value: T }[]; onChange: (value: T) => void }) {
  return <View style={styles.segment}>{options.map((option) => <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.segmentItem, value === option.value && styles.segmentActive]}><Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</Text></Pressable>)}</View>;
}

export function SectionTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return <View style={styles.titleWrap}>{eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}<Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, alignItems: 'center' }, scroll: { flexGrow: 1 }, screenContent: { flex: 1, width: '100%', maxWidth: 560, padding: spacing.lg, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, brandGlyph: { color: colors.white, fontWeight: '800', fontSize: 18 }, brand: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  button: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1 }, button_primary: { backgroundColor: colors.primary, borderColor: colors.primary }, button_secondary: { backgroundColor: colors.surface, borderColor: colors.border }, button_ghost: { backgroundColor: 'transparent', borderColor: 'transparent' }, buttonText: { fontSize: 16, fontWeight: '700' }, buttonText_primary: { color: colors.white }, buttonText_secondary: { color: colors.ink }, buttonText_ghost: { color: colors.primary }, pressed: { opacity: 0.75 }, disabled: { opacity: 0.45 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow },
  chip: { borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: 'transparent' }, chipSelected: { backgroundColor: colors.primarySoft, borderColor: '#A8CFC1' }, chipText: { color: colors.inkMuted, fontSize: 13, fontWeight: '600' }, chipTextSelected: { color: colors.primaryDark },
  fieldWrap: { gap: 7 }, label: { color: colors.ink, fontSize: 14, fontWeight: '700' }, input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, color: colors.ink, fontSize: 16 }, textarea: { minHeight: 132, paddingTop: 14 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, padding: 4, borderRadius: radius.md }, segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }, segmentActive: { backgroundColor: colors.surface, ...shadow }, segmentText: { color: colors.inkMuted, fontWeight: '700' }, segmentTextActive: { color: colors.primaryDark },
  titleWrap: { gap: 7, marginBottom: 4 }, eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }, title: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -1 }, subtitle: { color: colors.inkMuted, fontSize: 16, lineHeight: 23 },
});
