import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';
import { supabase } from '@/services/supabase';

export type PushRegistrationState = 'idle' | 'registering' | 'registered' | 'denied' | 'unsupported' | 'error';

const deviceIdKey = 'scholara.push-device-id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function createDeviceId() {
  const random = Array.from({ length: 4 }, () => Math.floor(Math.random() * 0x100000000).toString(36)).join('');
  return `device-${Date.now().toString(36)}-${random}`.slice(0, 96);
}

async function getDeviceId() {
  const existing = await SecureStore.getItemAsync(deviceIdKey);
  if (existing) return existing;
  const created = createDeviceId();
  await SecureStore.setItemAsync(deviceIdKey, created, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return created;
}

function getProjectId() {
  return Constants.easConfig?.projectId
    ?? (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
}

async function prepareAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Scholara notifications',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    lightColor: '#14795F',
  });
}

export async function syncPushRegistration(requestPermission: boolean): Promise<PushRegistrationState> {
  if (Platform.OS === 'web' || !supabase) return 'unsupported';

  try {
    await prepareAndroidChannel();
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== Notifications.PermissionStatus.GRANTED && requestPermission) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (permission.status !== Notifications.PermissionStatus.GRANTED) {
      return permission.canAskAgain ? 'idle' : 'denied';
    }

    const projectId = getProjectId();
    if (!projectId) return 'error';
    const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const deviceIdentifier = await getDeviceId();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const { data, error } = await supabase.rpc('register_push_token', {
      push_token: pushToken,
      device_identifier: deviceIdentifier,
      device_platform: platform,
    });
    return error || !data ? 'error' : 'registered';
  } catch {
    return 'unsupported';
  }
}

export async function unregisterCurrentPushDevice() {
  if (Platform.OS === 'web' || !supabase) return;
  const deviceIdentifier = await SecureStore.getItemAsync(deviceIdKey);
  if (deviceIdentifier) {
    await supabase.rpc('unregister_push_token', { device_identifier: deviceIdentifier });
  }
  // Invalidate the OS registration as a privacy fallback even if the network
  // request above could not reach Supabase during sign-out.
  await Notifications.unregisterForNotificationsAsync().catch(() => undefined);
}

export async function openNotificationSettings() {
  await Linking.openSettings();
}
