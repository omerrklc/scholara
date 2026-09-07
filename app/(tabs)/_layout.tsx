import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '@/theme/tokens';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = { discover: 'compass', community: 'people', matches: 'git-compare', messages: 'chatbubbles', profile: 'person-circle' };

export default function TabLayout() {
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: '#7B8681',
    tabBarStyle: { height: 68, paddingTop: 7, paddingBottom: 8, backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
    tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name] ?? 'ellipse'} color={color} size={size} />,
  })}>
    <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
    <Tabs.Screen name="community" options={{ title: 'Community' }} />
    <Tabs.Screen name="matches" options={{ title: 'Matches' }} />
    <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
  </Tabs>;
}
