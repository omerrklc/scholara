import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Chip, Screen, SectionTitle } from '@/components/ui';
import { posts } from '@/data/mock';
import { colors, spacing } from '@/theme/tokens';

export default function CommunityScreen() {
  return <Screen>
    <SectionTitle eyebrow="Community" title="Questions travel farther together." subtitle="Learn from people who are living the same academic moments." />
    <View style={styles.filters}><Chip label="For you" selected /><Chip label="Research" /><Chip label="Relocation" /><Chip label="Academic life" /></View>
    <Card style={styles.prompt}><Ionicons name="create-outline" size={22} color={colors.primary} /><Text style={styles.promptText}>Ask the research community...</Text></Card>
    {posts.map((post) => <Card key={post.id} style={styles.post}>
      <View style={styles.postHeader}><View style={styles.avatar}><Text style={styles.avatarText}>{post.author.split(' ').map((word) => word[0]).join('')}</Text></View><View style={styles.postIdentity}><Text style={styles.author}>{post.author}</Text><Text style={styles.context}>{post.context}</Text></View><Chip label={post.community} /></View>
      <Text style={styles.body}>{post.body}</Text>
      <View style={styles.stats}><Text style={styles.stat}><Ionicons name="chatbubble-outline" size={14} /> {post.replies} replies</Text><Text style={styles.stat}><Ionicons name="arrow-up-circle-outline" size={15} /> {post.helpful} helpful</Text></View>
    </Card>)}
  </Screen>;
}

const styles = StyleSheet.create({ filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, prompt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderStyle: 'dashed' }, promptText: { color: colors.inkMuted }, post: { gap: 14 }, postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.primaryDark, fontWeight: '900' }, postIdentity: { flex: 1 }, author: { color: colors.ink, fontWeight: '800' }, context: { color: colors.inkMuted, fontSize: 11 }, body: { color: colors.ink, fontSize: 15, lineHeight: 22 }, stats: { flexDirection: 'row', gap: spacing.lg, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }, stat: { color: colors.inkMuted, fontSize: 12, fontWeight: '600' } });
