import { supabase } from '@/services/supabase';

export type ModerationRole = 'moderator' | 'admin';
export type ModerationStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export type ModerationReport = {
  id: string;
  reportedUserId: string | null;
  reportedName: string;
  reportedUsername: string;
  reasons: string[];
  details: string;
  source: string;
  status: ModerationStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string;
  communityPostId: string | null;
  communityCommentId: string | null;
  contentExcerpt: string;
};

type ModerationReportRow = {
  report_id: string;
  reported_user_id: string | null;
  reported_name: string;
  reported_username: string;
  reasons: string[];
  details: string;
  source: string;
  report_status: string;
  created_at: string;
  reviewed_at: string | null;
  review_notes: string;
  community_post_id: string | null;
  community_comment_id: string | null;
  content_excerpt: string;
};

const isModerationRole = (value: unknown): value is ModerationRole => value === 'moderator' || value === 'admin';
const isModerationStatus = (value: string): value is ModerationStatus => ['open', 'reviewing', 'resolved', 'dismissed'].includes(value);

export async function fetchModerationRole() {
  if (!supabase) return { role: null as ModerationRole | null, error: 'Moderation tools are not configured.' };
  const { data, error } = await supabase.rpc('get_my_moderation_role');
  if (error) return { role: null as ModerationRole | null, error: 'Moderation access could not be checked.' };
  return { role: isModerationRole(data) ? data : null, error: null };
}

export async function fetchModerationReports(status: ModerationStatus) {
  if (!supabase) return { reports: [] as ModerationReport[], error: 'Moderation tools are not configured.' };
  const { data, error } = await supabase.rpc('get_moderation_reports', { status_filter: status, page_size: 50 });
  if (error) return { reports: [] as ModerationReport[], error: 'Reports could not be loaded.' };

  const reports = ((data ?? []) as ModerationReportRow[])
    .filter((row) => isModerationStatus(row.report_status))
    .map((row) => ({
      id: row.report_id,
      reportedUserId: row.reported_user_id,
      reportedName: row.reported_name,
      reportedUsername: row.reported_username,
      reasons: row.reasons,
      details: row.details,
      source: row.source,
      status: row.report_status as ModerationStatus,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      communityPostId: row.community_post_id,
      communityCommentId: row.community_comment_id,
      contentExcerpt: row.content_excerpt,
    }));
  return { reports, error: null };
}

export async function reviewModerationReport(reportId: string, status: ModerationStatus, notes: string) {
  if (!supabase) return 'Moderation tools are not configured.';
  const { error } = await supabase.rpc('review_moderation_report', {
    target_report_id: reportId,
    next_status: status,
    moderator_notes: notes.trim().slice(0, 2000),
  });
  return error ? 'The report could not be updated. Refresh and try again.' : null;
}

