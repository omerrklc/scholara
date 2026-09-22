import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useApp } from '@/state/AppProvider';
import { colors } from '@/theme/tokens';
import { useI18n } from '@/i18n';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = { discover: 'compass', community: 'people', matches: 'git-compare', messages: 'chatbubbles', profile: 'person-circle' };

export default function TabLayout() {
  const { authReady, session, isSupabaseConfigured } = useApp();
  const { t } = useI18n();
  if (!authReady) return <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>;
  if (isSupabaseConfigured && !session) return <Redirect href="/sign-in" />;
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarHideOnKeyboard: true,
    tabBarInactiveTintColor: '#7B8681',
    tabBarStyle: { height: 68, paddingTop: 7, paddingBottom: 8, backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
    tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name] ?? 'ellipse'} color={color} size={size} />,
  })}>
    <Tabs.Screen name="discover" options={{ title: t('Discover') }} />
    <Tabs.Screen name="community" options={{ title: t('Community') }} />
    <Tabs.Screen name="matches" options={{ title: t('Matches') }} />
    <Tabs.Screen name="messages" options={{ title: t('Messages') }} />
    <Tabs.Screen name="profile" options={{ title: t('Profile') }} />
  </Tabs>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
