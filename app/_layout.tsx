import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/state/AppProvider';
import { PushNotificationObserver } from '@/components/PushNotificationObserver';
import { colors } from '@/theme/tokens';
import { I18nProvider } from '@/i18n';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider><I18nProvider><AppProvider><AppNavigation /></AppProvider></I18nProvider></ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>;
}

function AppNavigation() {
  const { resolvedTheme } = useTheme();
  return <><PushNotificationObserver /><StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} /></>;
}
