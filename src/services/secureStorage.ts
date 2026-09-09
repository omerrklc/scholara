import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Supabase needs the browser storage model on web. Native session tokens are
// stored in the OS-protected Keychain/Keystore instead of plain AsyncStorage.
export const authStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);

    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue) return secureValue;

    // One-time migration for sessions created by older Scholara builds.
    const legacyValue = await AsyncStorage.getItem(key);
    if (!legacyValue) return null;
    await SecureStore.setItemAsync(key, legacyValue, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await AsyncStorage.removeItem(key);
    return legacyValue;
  },
  setItem: (key: string, value: string) => Platform.OS === 'web'
    ? AsyncStorage.setItem(key, value)
    : SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
  removeItem: (key: string) => Platform.OS === 'web'
    ? AsyncStorage.removeItem(key)
    : SecureStore.deleteItemAsync(key),
};
