import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Supabase migration versions', () => {
  it('keeps every migration timestamp unique', () => {
    const files = readdirSync(join(process.cwd(), 'supabase', 'migrations')).filter((file) => file.endsWith('.sql'));
    const versions = files.map((file) => file.split('_')[0]);
    const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);
    expect(duplicates).toEqual([]);
  });
});
