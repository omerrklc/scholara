import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, useWindowDimensions, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '@/theme/tokens';

export function Screen({ children, scroll = true, style }: PropsWithChildren<{ scroll?: boolean; style?: StyleProp<ViewStyle> }>) {
  const { height, width } = useWindowDimensions();
  const compact = width < 380 || height < 720;
  const content = <View style={[styles.screenContent, compact && styles.screenContentCompact, style]}>{children}</View>;
  return <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safe}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} style={styles.keyboard}>
      {scroll ? <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >{content}</ScrollView> : content}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <View style={styles.brandRow}><View style={styles.brandIcon}><Text maxFontSizeMultiplier={1.2} style={styles.brandGlyph}>S</Text></View>{!compact && <Text maxFontSizeMultiplier={1.2} style={styles.brand}>Scholara</Text>}</View>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, icon }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; icon?: ReactNode }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${variant}`], pressed && styles.pressed, disabled && styles.disabled]}>{icon}<Text maxFontSizeMultiplier={1.3} style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{label}</Text></Pressable>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const content = <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>;
  return onPress ? <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>{content}</Pressable> : <View style={[styles.chip, selected && styles.chipSelected]}>{content}</View>;
}

export function Field({ label, multiline = false, accessory, ...props }: TextInputProps & { label: string; accessory?: ReactNode }) {
  return <View style={styles.fieldWrap}>
    <Text maxFontSizeMultiplier={1.3} style={styles.label}>{label}</Text>
    <View style={styles.inputWrap}>
      <TextInput accessibilityLabel={label} maxFontSizeMultiplier={1.3} placeholderTextColor="#8C9691" multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.textarea, accessory ? styles.inputWithAccessory : undefined]} {...props} />
      {accessory ? <View style={styles.inputAccessory}>{accessory}</View> : null}
    </View>
  </View>;
}

export function PasswordField(props: Omit<TextInputProps, 'secureTextEntry'> & { label: string }) {
  const [visible, setVisible] = useState(false);
  return <Field
    {...props}
    autoCapitalize="none"
    autoCorrect={false}
    secureTextEntry={!visible}
    accessory={<Pressable
      accessibilityLabel={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => setVisible((current) => !current)}
      style={styles.passwordToggle}
    ><Ionicons color={colors.inkMuted} name={visible ? 'eye-off-outline' : 'eye-outline'} size={23} /></Pressable>}
  />;
}

export function SegmentedControl<T extends string>({ value, options, onChange }: { value: T; options: { label: string; value: T }[]; onChange: (value: T) => void }) {
  return <View style={styles.segment}>{options.map((option) => <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.segmentItem, value === option.value && styles.segmentActive]}><Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</Text></Pressable>)}</View>;
}

export function SectionTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const { height, width } = useWindowDimensions();
  const compact = width < 380 || height < 720;
  return <View style={[styles.titleWrap, compact && styles.titleWrapCompact]}>{eyebrow && <Text maxFontSizeMultiplier={1.25} style={styles.eyebrow}>{eyebrow}</Text>}<Text maxFontSizeMultiplier={1.2} style={[styles.title, compact && styles.titleCompact]}>{title}</Text>{subtitle && <Text maxFontSizeMultiplier={1.25} style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text>}</View>;
}

export function MessageBanner({ message, tone = 'error' }: { message: string; tone?: 'error' | 'success' | 'info' }) {
  return <View accessibilityRole="alert" style={[styles.banner, styles[`banner_${tone}`]]}><Text style={[styles.bannerText, styles[`bannerText_${tone}`]]}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, keyboard: { flex: 1, width: '100%' }, scrollView: { flex: 1, width: '100%' }, scroll: { flexGrow: 1, width: '100%', alignItems: 'center' }, screenContent: { boxSizing: 'border-box', flexGrow: 1, width: '100%', maxWidth: 560, minWidth: 0, padding: spacing.lg, gap: spacing.md }, screenContentCompact: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, brandGlyph: { color: colors.white, fontWeight: '800', fontSize: 18 }, brand: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  button: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1 }, button_primary: { backgroundColor: colors.primary, borderColor: colors.primary }, button_secondary: { backgroundColor: colors.surface, borderColor: colors.border }, button_ghost: { backgroundColor: 'transparent', borderColor: 'transparent' }, buttonText: { fontSize: 16, fontWeight: '700' }, buttonText_primary: { color: colors.white }, buttonText_secondary: { color: colors.ink }, buttonText_ghost: { color: colors.primary }, pressed: { opacity: 0.75 }, disabled: { opacity: 0.45 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow },
  chip: { borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: 'transparent' }, chipSelected: { backgroundColor: colors.primarySoft, borderColor: '#A8CFC1' }, chipText: { color: colors.inkMuted, fontSize: 13, fontWeight: '600' }, chipTextSelected: { color: colors.primaryDark },
  fieldWrap: { gap: 7, minWidth: 0 }, label: { color: colors.ink, fontSize: 14, fontWeight: '700' }, inputWrap: { width: '100%', minWidth: 0 }, input: { width: '100%', minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, color: colors.ink, fontSize: 16 }, inputWithAccessory: { paddingRight: 54 }, inputAccessory: { position: 'absolute', right: 5, top: 0, bottom: 0, justifyContent: 'center' }, passwordToggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }, textarea: { minHeight: 132, paddingTop: 14 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, padding: 4, borderRadius: radius.md }, segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }, segmentActive: { backgroundColor: colors.surface, ...shadow }, segmentText: { color: colors.inkMuted, fontWeight: '700' }, segmentTextActive: { color: colors.primaryDark },
  titleWrap: { gap: 7, marginBottom: 4 }, titleWrapCompact: { gap: 4, marginBottom: 0 }, eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }, title: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -1 }, titleCompact: { fontSize: 25, lineHeight: 30, letterSpacing: -0.6 }, subtitle: { color: colors.inkMuted, fontSize: 16, lineHeight: 23 }, subtitleCompact: { fontSize: 14, lineHeight: 20 },
  banner: { borderRadius: radius.md, padding: 13, borderWidth: 1 }, banner_error: { backgroundColor: '#FBECEC', borderColor: '#E8B9B9' }, banner_success: { backgroundColor: colors.primarySoft, borderColor: '#A8CFC1' }, banner_info: { backgroundColor: '#EDF2F7', borderColor: '#C9D5E1' }, bannerText: { fontSize: 13, lineHeight: 19, fontWeight: '600' }, bannerText_error: { color: colors.danger }, bannerText_success: { color: colors.primaryDark }, bannerText_info: { color: colors.ink },
});
