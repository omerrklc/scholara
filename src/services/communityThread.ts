import type { CommunityComment } from '@/services/community';

export type ThreadedComment = { comment: CommunityComment; depth: number };

export function buildCommentThread(comments: CommunityComment[]): ThreadedComment[] {
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
    result.push({ comment, depth });
    (children.get(comment.id) ?? []).forEach((child) => append(child, depth + 1));
  };

  roots.forEach((comment) => append(comment, 0));
  comments.forEach((comment) => append(comment, 0));
  return result;
}
