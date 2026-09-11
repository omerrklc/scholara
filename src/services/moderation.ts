import { supabase } from '@/services/supabase';

export type ReportReason = 'spam' | 'harassment' | 'impersonation' | 'inappropriate_content' | 'privacy' | 'other';
export type SafetySource = 'discover' | 'matches' | 'chat' | 'profile' | 'community';

export type BlockedUser = {
  id: string;
  name: string;
  stage: string;
  university: string;
  blockedAt: string;
};

type BlockedUserRow = {
  user_id: string;
  full_name: string;
  academic_stage: string;
  university: string;
  blocked_at: string;
};

type DirectBlockRow = {
  blocked_user_id: string;
  created_at: string;
};

export async function reportUser(targetUserId: string, reasons: ReportReason[], details: string, source: SafetySource) {
  if (!supabase) return 'Reporting is not configured.';
  const { error } = await supabase.rpc('report_user', {
    target_user_id: targetUserId,
    report_reasons: reasons,
    report_details: details.trim().slice(0, 1000),
    report_source: source,
  });
  if (!error) return null;
  if (error.message.toLowerCase().includes('daily report limit')) return 'You have reached today\'s report limit.';
  return 'Your report could not be submitted. Please try again.';
}

export async function reportCommunityPost(postId: string, reasons: ReportReason[], details: string) {
  if (!supabase) return 'Reporting is not configured.';
  const { error } = await supabase.rpc('report_community_post', {
    target_post_id: postId,
    report_reasons: reasons,
    report_details: details.trim().slice(0, 1000),
  });
  if (!error) return null;
  if (error.message.toLowerCase().includes('daily report limit')) return 'You have reached today\'s report limit.';
  return 'Your report could not be submitted. Please try again.';
}

export async function reportCommunityComment(commentId: string, reasons: ReportReason[], details: string) {
  if (!supabase) return 'Reporting is not configured.';
  const { error } = await supabase.rpc('report_community_comment', {
    target_comment_id: commentId,
    report_reasons: reasons,
    report_details: details.trim().slice(0, 1000),
  });
  if (!error) return null;
  if (error.message.toLowerCase().includes('daily report limit')) return 'You have reached today\'s report limit.';
  return 'Your report could not be submitted. Please try again.';
}

export async function blockUser(targetUserId: string) {
  if (!supabase) return 'Blocking is not configured.';
  const { error } = await supabase.rpc('block_user', { target_user_id: targetUserId });
  return error ? 'This user could not be blocked. Please try again.' : null;
}

export async function unblockUser(targetUserId: string) {
  if (!supabase) return 'Blocking is not configured.';
  const { error } = await supabase.rpc('unblock_user', { target_user_id: targetUserId });
  return error ? 'This user could not be unblocked. Please try again.' : null;
}

export async function fetchBlockedUsers() {
  if (!supabase) return { users: [] as BlockedUser[], error: 'Blocking is not configured.' };
  const { data, error } = await supabase.rpc('get_blocked_users');
  const users = ((data ?? []) as BlockedUserRow[]).map((row) => ({
      id: row.user_id,
      name: row.full_name,
      stage: row.academic_stage,
      university: row.university,
      blockedAt: row.blocked_at,
  }));
  if (!error && users.length) return { users, error: null };

  // The owner-only table is a safe fallback and still lets the user undo a
  // block if profile metadata is temporarily unavailable.
  const direct = await supabase.from('blocked_users').select('blocked_user_id, created_at').order('created_at', { ascending: false });
  if (direct.error) return { users: [] as BlockedUser[], error: 'Blocked users could not be loaded.' };
  return {
    users: ((direct.data ?? []) as DirectBlockRow[]).map((row) => ({
      id: row.blocked_user_id,
      name: 'Blocked researcher',
      stage: '',
      university: '',
      blockedAt: row.created_at,
    })),
    error: null,
  };
}
