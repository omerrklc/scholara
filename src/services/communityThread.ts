import type { CommunityComment } from '@/services/community';

export type ThreadedComment = { comment: CommunityComment; depth: number; replyCount: number };

export function buildCommentThread(comments: CommunityComment[], expanded?: ReadonlySet<string>): ThreadedComment[] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const children = new Map<string, CommunityComment[]>();
  const roots: CommunityComment[] = [];

  comments.forEach((comment) => {
    if (!comment.parentCommentId || !byId.has(comment.parentCommentId)) roots.push(comment);
    else children.set(comment.parentCommentId, [...(children.get(comment.parentCommentId) ?? []), comment]);
  });

  const result: ThreadedComment[] = [];
  const visited = new Set<string>();
  const append = (comment: CommunityComment, depth: number) => {
    if (visited.has(comment.id)) return;
    visited.add(comment.id);
    const replies = children.get(comment.id) ?? [];
    result.push({ comment, depth, replyCount: replies.length });
    if (!expanded || expanded.has(comment.id)) replies.forEach((child) => append(child, depth + 1));
  };

  roots.forEach((comment) => append(comment, 0));
  comments.forEach((comment) => {
    if (visited.has(comment.id)) return;
    const ancestors = new Set<string>();
    let current: CommunityComment | undefined = comment;
    while (current?.parentCommentId && byId.has(current.parentCommentId)) {
      if (ancestors.has(current.id)) {
        append(comment, 0);
        break;
      }
      ancestors.add(current.id);
      current = byId.get(current.parentCommentId);
    }
  });
  return result;
}
