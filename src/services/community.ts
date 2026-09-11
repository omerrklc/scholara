import { normalizeCommunityComment, normalizeCommunityPost } from '@/services/communityText';
import { supabase } from '@/services/supabase';

export type CommunityCategory = 'research' | 'relocation' | 'academic_life';

export type CommunityPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorStage: string;
  authorUniversity: string;
  category: CommunityCategory;
  body: string;
  createdAt: string;
  replyCount: number;
  helpfulCount: number;
  viewerHelpful: boolean;
  viewerOwns: boolean;
};

export type CommunityComment = {
  id: string;
  authorId: string;
  authorName: string;
  authorStage: string;
  authorUniversity: string;
  body: string;
  createdAt: string;
  viewerOwns: boolean;
};

type PostRow = {
  post_id: string; author_id: string; author_name: string; author_stage: string; author_university: string;
  category: CommunityCategory; body: string; created_at: string; reply_count: number | string;
  helpful_count: number | string; viewer_helpful: boolean; viewer_owns: boolean;
};

type CommentRow = {
  comment_id: string; author_id: string; author_name: string; author_stage: string; author_university: string;
  body: string; created_at: string; viewer_owns: boolean;
};

const mapPost = (row: PostRow): CommunityPost => ({
  id: row.post_id, authorId: row.author_id, authorName: row.author_name, authorStage: row.author_stage,
  authorUniversity: row.author_university, category: row.category, body: row.body, createdAt: row.created_at,
  replyCount: Number(row.reply_count) || 0, helpfulCount: Number(row.helpful_count) || 0,
  viewerHelpful: row.viewer_helpful, viewerOwns: row.viewer_owns,
});

export async function fetchCommunityPosts(category: CommunityCategory | null) {
  if (!supabase) return { posts: [] as CommunityPost[], error: 'Community is not configured.' };
  const { data, error } = await supabase.rpc('get_community_posts', {
    page_size: 30,
    ...(category ? { category_filter: category } : {}),
  });
  return error
    ? { posts: [] as CommunityPost[], error: 'Community posts could not be loaded.' }
    : { posts: ((data ?? []) as PostRow[]).map(mapPost), error: null };
}

export async function createCommunityPost(category: CommunityCategory, body: string) {
  if (!supabase) return 'Community is not configured.';
  const cleanBody = normalizeCommunityPost(body);
  if (cleanBody.length < 10) return 'Write at least 10 characters.';
  const { error } = await supabase.rpc('create_community_post', { post_category: category, post_body: cleanBody });
  if (!error) return null;
  if (error.message.toLowerCase().includes('rate limit')) return 'You have created several posts. Please wait before posting again.';
  return 'Your post could not be published.';
}

export async function deleteCommunityPost(postId: string) {
  if (!supabase) return 'Community is not configured.';
  const { data, error } = await supabase.rpc('delete_community_post', { target_post_id: postId });
  return error || !data ? 'Your post could not be deleted.' : null;
}

export async function toggleCommunityHelpful(postId: string) {
  if (!supabase) return { helpful: null, error: 'Community is not configured.' };
  const { data, error } = await supabase.rpc('toggle_community_post_helpful', { target_post_id: postId });
  return error
    ? { helpful: null, error: 'Your helpful vote could not be updated.' }
    : { helpful: Boolean(data), error: null };
}

export async function fetchCommunityComments(postId: string) {
  if (!supabase) return { comments: [] as CommunityComment[], error: 'Community is not configured.' };
  const { data, error } = await supabase.rpc('get_community_comments', { target_post_id: postId, page_size: 100 });
  if (error) return { comments: [] as CommunityComment[], error: 'Comments could not be loaded.' };
  const comments = ((data ?? []) as CommentRow[]).map((row) => ({
    id: row.comment_id, authorId: row.author_id, authorName: row.author_name, authorStage: row.author_stage,
    authorUniversity: row.author_university, body: row.body, createdAt: row.created_at, viewerOwns: row.viewer_owns,
  })).reverse();
  return { comments, error: null };
}

export async function createCommunityComment(postId: string, body: string) {
  if (!supabase) return 'Community is not configured.';
  const cleanBody = normalizeCommunityComment(body);
  if (!cleanBody) return 'Write a comment first.';
  const { error } = await supabase.rpc('create_community_comment', { target_post_id: postId, comment_body: cleanBody });
  if (!error) return null;
  if (error.message.toLowerCase().includes('rate limit')) return 'You are commenting too quickly. Please wait a moment.';
  return 'Your comment could not be published.';
}

export async function deleteCommunityComment(commentId: string) {
  if (!supabase) return 'Community is not configured.';
  const { data, error } = await supabase.rpc('delete_community_comment', { target_comment_id: commentId });
  return error || !data ? 'Your comment could not be deleted.' : null;
}
