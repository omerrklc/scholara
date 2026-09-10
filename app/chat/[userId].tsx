import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, MessageBanner, Screen } from '@/components/ui';
import { SafetySheet } from '@/components/SafetySheet';
import { fetchConversation, fetchConversationSummaries, markConversationRead, sendChatMessage, subscribeToConversation, type ChatMessage } from '@/services/messaging';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing } from '@/theme/tokens';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timeLabel = (value: string) => new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export default function ChatScreen() {
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const otherUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId ?? '';
  const { authReady, session } = useApp();
  const [partnerName, setPartnerName] = useState('Researcher');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showSafety, setShowSafety] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const loadMessages = useCallback(async (showLoading = false) => {
    if (!uuidPattern.test(otherUserId)) {
      setError('This conversation link is invalid.');
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    const result = await fetchConversation(otherUserId);
    setMessages(result.messages);
    setError(result.error ?? '');
    setLoading(false);
    if (!result.error) void markConversationRead(otherUserId);
  }, [otherUserId]);

  useEffect(() => {
    if (!session || !uuidPattern.test(otherUserId)) return;
    let active = true;
    void Promise.all([fetchConversationSummaries(), fetchConversation(otherUserId)]).then(([summaryResult, messageResult]) => {
      if (!active) return;
      const partner = summaryResult.conversations.find((item) => item.otherUserId === otherUserId);
      if (partner) setPartnerName(partner.name);
      setMessages(messageResult.messages);
      setError(messageResult.error ?? summaryResult.error ?? '');
      setLoading(false);
      if (!messageResult.error) void markConversationRead(otherUserId);
    });
    const unsubscribe = subscribeToConversation(session.user.id, otherUserId, () => void loadMessages());
    return () => { active = false; unsubscribe(); };
  }, [loadMessages, otherUserId, session]);

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    setError('');
    const result = await sendChatMessage(otherUserId, draft);
    if (result) setError(result);
    else {
      setDraft('');
      await loadMessages();
    }
    setSending(false);
  };

  if (!authReady) return <Screen scroll={false} style={styles.loading}><ActivityIndicator color={colors.primary} /></Screen>;
  if (!session) return <Redirect href="/sign-in" />;
  if (!uuidPattern.test(otherUserId)) return <Screen><MessageBanner message="This conversation link is invalid." /><Button label="Back to messages" onPress={() => router.replace('/(tabs)/messages')} /></Screen>;

  return <Screen scroll={false} style={styles.screen}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back to messages" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.ink} /></Pressable>
      <View style={styles.headerText}><Text numberOfLines={1} style={styles.name}>{partnerName}</Text><Text style={styles.subtitle}>Mutual academic match</Text></View>
      <Pressable accessibilityLabel={`Safety options for ${partnerName}`} accessibilityRole="button" onPress={() => setShowSafety(true)} style={styles.safety}><Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} /></Pressable>
    </View>
    {error ? <MessageBanner message={error} /> : null}
    {loading ? <Card style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.emptyText}>Loading messages…</Text></Card> : <FlatList
      ref={listRef}
      style={styles.listView}
      data={messages}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.list, messages.length === 0 && styles.emptyList]}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      renderItem={({ item }) => {
        const mine = item.senderId === session?.user.id;
        return <View style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.theirsWrap]}><View style={[styles.bubble, mine ? styles.mine : styles.theirs]}><Text style={[styles.body, mine && styles.mineBody]}>{item.body}</Text><Text style={[styles.time, mine && styles.mineTime]}>{timeLabel(item.createdAt)}</Text></View></View>;
      }}
      ListEmptyComponent={<View style={styles.empty}><Ionicons name="chatbubble-ellipses-outline" size={42} color={colors.primary} /><Text style={styles.emptyTitle}>Start the conversation</Text><Text style={styles.emptyText}>Introduce yourself and mention what sparked the match.</Text></View>}
    />}
    <View style={styles.composer}>
      <TextInput accessibilityLabel="Message" maxLength={2000} multiline placeholder="Write a message…" placeholderTextColor={colors.inkMuted} value={draft} onChangeText={setDraft} style={styles.input} />
      <View style={styles.send}><Button label={sending ? '…' : 'Send'} disabled={!draft.trim() || sending} onPress={() => void send()} /></View>
    </View>
    <Text style={styles.counter}>{draft.length}/2000</Text>
    {showSafety ? <SafetySheet targetId={otherUserId} targetName={partnerName} source="chat" onClose={() => setShowSafety(false)} onBlocked={() => router.replace('/(tabs)/messages')} /> : null}
  </Screen>;
}

const styles = StyleSheet.create({ screen: { paddingBottom: spacing.sm }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, back: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }, safety: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, headerText: { flex: 1, minWidth: 0 }, name: { color: colors.ink, fontSize: 17, fontWeight: '800' }, subtitle: { color: colors.inkMuted, fontSize: 11 }, loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }, listView: { flex: 1 }, list: { flexGrow: 1, paddingVertical: spacing.sm, gap: spacing.xs }, emptyList: { justifyContent: 'center' }, bubbleWrap: { width: '100%', flexDirection: 'row' }, mineWrap: { justifyContent: 'flex-end' }, theirsWrap: { justifyContent: 'flex-start' }, bubble: { maxWidth: '82%', borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 9, gap: 4 }, mine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 }, theirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 }, body: { color: colors.ink, fontSize: 15, lineHeight: 21 }, mineBody: { color: colors.white }, time: { color: colors.inkMuted, fontSize: 9, alignSelf: 'flex-end' }, mineTime: { color: '#CBE3DA' }, empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' }, emptyText: { color: colors.inkMuted, textAlign: 'center' }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, input: { flex: 1, minHeight: 52, maxHeight: 120, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontSize: 15 }, send: { width: 88 }, counter: { color: colors.inkMuted, fontSize: 10, textAlign: 'right' } });
