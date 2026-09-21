import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { getPushDestination } from '@/services/pushRouting';
import { useApp } from '@/state/AppProvider';

export function PushNotificationObserver() {
  const { authReady, session } = useApp();
  const pending = useRef<Notifications.NotificationResponse | null>(null);
  const handledIdentifier = useRef('');

  const open = (response: Notifications.NotificationResponse) => {
    const identifier = response.notification.request.identifier;
    if (!session || handledIdentifier.current === identifier) {
      if (!session) pending.current = response;
      return;
    }
    const destination = getPushDestination(response.notification.request.content.data ?? {});
    handledIdentifier.current = identifier;
    pending.current = null;
    if (!destination) return;
    if (destination.screen === 'chat') {
      router.push({ pathname: '/chat/[userId]', params: { userId: destination.userId } });
    } else if (destination.screen === 'researcher') {
      router.push({ pathname: '/researcher/[userId]', params: { userId: destination.userId, mode: 'research' } });
    } else {
      router.push('/(tabs)/community');
    }
    void Notifications.clearLastNotificationResponseAsync();
  };

  useEffect(() => {
    let active = true;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (active && response) open(response);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      active = false;
      subscription.remove();
    };
  // The listener must be recreated when authentication changes so queued responses
  // can only navigate after a valid session exists.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  useEffect(() => {
    if (authReady && session && pending.current) open(pending.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, session]);

  return null;
}
