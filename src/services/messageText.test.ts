import { describe, expect, it } from 'vitest';
import { normalizeMessageBody } from './messageText';

describe('normalizeMessageBody', () => {
  it('removes surrounding whitespace', () => {
    expect(normalizeMessageBody('  Hello researcher  ')).toBe('Hello researcher');
  });

  it('keeps messages within the server limit', () => {
    expect(normalizeMessageBody('x'.repeat(2100))).toHaveLength(2000);
  });

  it('rejects whitespace-only content at the client boundary', () => {
    expect(normalizeMessageBody('   \n  ')).toBe('');
  });
});
