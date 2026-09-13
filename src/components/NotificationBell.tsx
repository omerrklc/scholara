import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/state/AppProvider';
import { colors } from '@/theme/tokens';

export function NotificationBell() {
  const { refreshNotifications, unreadNotifications } = useApp();
  useFocusEffect(useCallback(() => { void refreshNotifications(); }, [refreshNotifications]));

  return <Pressable accessibilityLabel={unreadNotifications ? `${unreadNotifications} unread notifications` : 'Notifications'} accessibilityRole="button" onPress={() => router.push('/notifications')} style={styles.button}>
    <Ionicons name={unreadNotifications ? 'notifications' : 'notifications-outline'} size={22} color={colors.primary} />
    {unreadNotifications > 0 ? <View style={styles.badge}><Text maxFontSizeMultiplier={1} style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text></View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({ button: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, badge: { position: 'absolute', right: -3, top: -4, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.background }, badgeText: { color: colors.white, fontSize: 9, fontWeight: '900' } });
