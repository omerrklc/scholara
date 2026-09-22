import { describe, expect, it } from 'vitest';
import type { CommunityComment } from './community';
import { buildCommentThread } from './communityThread';

const comment = (id: string, parentCommentId: string | null): CommunityComment => ({
  id,
  parentCommentId,
  authorId: `author-${id}`,
  authorName: `Author ${id}`,
  authorStage: 'PhD',
  authorUniversity: 'Test University',
  body: `Comment ${id}`,
  createdAt: '2026-09-22T00:00:00.000Z',
  viewerOwns: false,
});

describe('buildCommentThread', () => {
  it('places replies directly below their parent with increasing depth', () => {
    const thread = buildCommentThread([
      comment('root', null),
      comment('child', 'root'),
      comment('grandchild', 'child'),
      comment('second-root', null),
    ]);

    expect(thread.map(({ comment: item, depth }) => [item.id, depth])).toEqual([
      ['root', 0],
      ['child', 1],
      ['grandchild', 2],
      ['second-root', 0],
    ]);
  });

  it('keeps orphaned or cyclic data visible without looping', () => {
    const thread = buildCommentThread([
      comment('orphan', 'missing'),
      comment('cycle-a', 'cycle-b'),
      comment('cycle-b', 'cycle-a'),
    ]);

    expect(thread.map(({ comment: item }) => item.id)).toEqual(['orphan', 'cycle-a', 'cycle-b']);
  });

  it('hides replies until their parent thread is expanded', () => {
    const comments = [comment('root', null), comment('child', 'root'), comment('grandchild', 'child')];

    expect(buildCommentThread(comments, new Set()).map(({ comment: item, replyCount }) => [item.id, replyCount])).toEqual([
      ['root', 1],
    ]);
    expect(buildCommentThread(comments, new Set(['root'])).map(({ comment: item }) => item.id)).toEqual(['root', 'child']);
    expect(buildCommentThread(comments, new Set(['root', 'child'])).map(({ comment: item }) => item.id)).toEqual(['root', 'child', 'grandchild']);
  });
});
