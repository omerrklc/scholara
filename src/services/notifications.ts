import { createProfilePhotoUrls } from '@/services/profilePhotos';
import { supabase } from '@/services/supabase';

export type NotificationKind = 'connection_request' | 'match' | 'message' | 'community_comment' | 'community_helpful';

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  actorId: string | null;
  actorName: string;
  actorAvatarUrl?: string;
  resourceId: string | null;
  createdAt: string;
  readAt: string | null;
};

type NotificationRow = {
  notification_id: string;
  kind: NotificationKind;
  actor_id: string | null;
  actor_name: string;
  actor_avatar_path: string;
  resource_id: string | null;
  created_at: string;
  read_at: string | null;
};

export async function fetchNotifications(beforeTime?: string) {
  if (!supabase) return { notifications: [] as NotificationItem[], error: 'Notifications are not configured.' };
  const { data, error } = await supabase.rpc('get_notifications', {
    page_size: 30,
    ...(beforeTime ? { before_time: beforeTime } : {}),
  });
  if (error) return { notifications: [] as NotificationItem[], error: 'Notifications could not be loaded.' };

  const rows = (data ?? []) as unknown as NotificationRow[];
  const photoUrls = await createProfilePhotoUrls(rows.map((row) => row.actor_avatar_path));
  return {
    notifications: rows.map((row) => ({
      id: row.notification_id,
      kind: row.kind,
      actorId: row.actor_id,
      actorName: row.actor_name,
      actorAvatarUrl: row.actor_avatar_path ? photoUrls.get(row.actor_avatar_path) : undefined,
      resourceId: row.resource_id,
      createdAt: row.created_at,
      readAt: row.read_at,
    })),
    error: null,
  };
}

export async function fetchUnreadNotificationCount() {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('get_unread_notification_count');
  return error ? 0 : Number(data) || 0;
}

export async function markNotificationRead(notificationId: string) {
  if (!supabase) return 'Notifications are not configured.';
  const { data, error } = await supabase.rpc('mark_notification_read', { target_notification_id: notificationId });
  return error || !data ? 'The notification could not be updated.' : null;
}

export async function markAllNotificationsRead() {
  if (!supabase) return 'Notifications are not configured.';
  const { error } = await supabase.rpc('mark_all_notifications_read');
  return error ? 'Notifications could not be updated.' : null;
}
