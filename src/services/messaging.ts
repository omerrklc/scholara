import { supabase } from '@/services/supabase';
import { normalizeMessageBody } from '@/services/messageText';

export type ConversationSummary = {
  otherUserId: string;
  name: string;
  stage: string;
  university: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

type SummaryRow = {
  other_user_id: string;
  other_name: string;
  other_stage: string;
  other_university: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number | string;
};

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export async function fetchConversationSummaries() {
  if (!supabase) return { conversations: [] as ConversationSummary[], error: 'Messaging is not configured.' };
  const { data, error } = await supabase.rpc('get_conversation_summaries');
  if (error) return { conversations: [] as ConversationSummary[], error: 'Conversations could not be loaded.' };

  return {
    conversations: ((data ?? []) as SummaryRow[]).map((row) => ({
      otherUserId: row.other_user_id,
      name: row.other_name,
      stage: row.other_stage,
      university: row.other_university,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      unreadCount: Number(row.unread_count) || 0,
    })),
    error: null,
  };
}

export async function fetchConversation(otherUserId: string) {
  if (!supabase) return { messages: [] as ChatMessage[], error: 'Messaging is not configured.' };
  const { data, error } = await supabase.rpc('get_conversation_messages', {
    other_user_id: otherUserId,
    before_time: null,
    page_size: 100,
  });
  if (error) return { messages: [] as ChatMessage[], error: 'Messages could not be loaded.' };

  const messages = ((data ?? []) as MessageRow[]).map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  })).reverse();
  return { messages, error: null };
}

export async function sendChatMessage(otherUserId: string, body: string) {
  if (!supabase) return 'Messaging is not configured.';
  const cleanBody = normalizeMessageBody(body);
  if (!cleanBody) return 'Write a message first.';

  const { error } = await supabase.rpc('send_message', {
    target_user_id: otherUserId,
    message_body: cleanBody,
  });
  if (!error) return null;
  if (error.message.toLowerCase().includes('rate limit')) return 'You are sending messages too quickly. Please wait a moment.';
  return 'Your message could not be sent.';
}

export async function markConversationRead(otherUserId: string) {
  if (!supabase) return;
  await supabase.rpc('mark_conversation_read', { other_user_id: otherUserId });
}

export function subscribeToConversation(userId: string, otherUserId: string, onMessage: () => void) {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel(`messages:${userId}:${otherUserId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const row = payload.new as Partial<MessageRow>;
      const belongsToConversation = (row.sender_id === userId && row.recipient_id === otherUserId)
        || (row.sender_id === otherUserId && row.recipient_id === userId);
      if (belongsToConversation) onMessage();
    })
    .subscribe();

  return () => { void client.removeChannel(channel); };
}
