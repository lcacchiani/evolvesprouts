import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildPollPath,
  getAllPollSlugs,
  getPollContent,
  isValidPollSlug,
} from '@/lib/polls';

describe('polls registry', () => {
  it('returns registered slugs and resolves content', () => {
    const slugs = getAllPollSlugs();
    expect(slugs).toContain('workshop-food-jun-26');
    const content = getPollContent('workshop-food-jun-26');
    expect(content?.title).toBeTruthy();
    expect(content?.slug).toBe('workshop-food-jun-26');
    expect(content?.questions.length).toBeGreaterThan(0);
  });

  it('validates slugs', () => {
    expect(isValidPollSlug('workshop-food-jun-26')).toBe(true);
    expect(isValidPollSlug('missing')).toBe(false);
    expect(getPollContent('missing')).toBeNull();
  });

  it('builds poll paths', () => {
    expect(buildPollPath('workshop-food-jun-26')).toBe('/polls/workshop-food-jun-26/');
  });

  it('every content json file is registered with matching slug field', () => {
    const dir = path.resolve(__dirname, '../../src/content/polls');
    const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
    const registered = new Set(getAllPollSlugs());
    for (const fileName of files) {
      const slug = fileName.replace(/\.json$/, '');
      expect(registered.has(slug)).toBe(true);
      const raw = JSON.parse(readFileSync(path.join(dir, fileName), 'utf8')) as {
        slug: string;
      };
      expect(raw.slug).toBe(slug);
    }
  });

  it('uses dynamic poll route page', () => {
    const appPollPage = path.resolve(__dirname, '../../src/app/polls/[slug]/page.tsx');
    expect(existsSync(appPollPage)).toBe(true);
  });
});
