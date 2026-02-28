import { describe, expect, it } from 'vitest';

import { generatePkcePair } from '@/lib/pkce';

describe('generatePkcePair', () => {
  it('returns verifier and challenge in URL-safe format', async () => {
    const { verifier, challenge } = await generatePkcePair();

    expect(verifier).toHaveLength(64);
    expect(verifier).toMatch(/^[A-Za-z0-9]+$/);
    expect(challenge.length).toBeGreaterThan(10);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toContain('=');
  });
});
