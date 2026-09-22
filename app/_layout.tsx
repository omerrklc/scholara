import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/state/AppProvider';
import { PushNotificationObserver } from '@/components/PushNotificationObserver';
import { colors } from '@/theme/tokens';
import { I18nProvider } from '@/i18n';

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <I18nProvider>
        <AppProvider>
          <PushNotificationObserver />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} />
        </AppProvider>
      </I18nProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>;
}
