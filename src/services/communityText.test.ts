import { describe, expect, it } from 'vitest';
import { normalizeCommunityComment, normalizeCommunityPost } from './communityText';

describe('community text normalization', () => {
  it('trims posts and limits them to 2000 characters', () => {
    expect(normalizeCommunityPost(`  ${'p'.repeat(2100)}  `)).toHaveLength(2000);
  });

  it('trims comments and limits them to 1000 characters', () => {
    expect(normalizeCommunityComment(`  ${'c'.repeat(1100)}  `)).toHaveLength(1000);
  });
});
