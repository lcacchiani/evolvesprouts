import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sectionsDirectory = path.resolve(__dirname, '../../../src/components/sections');

const pageSectionFiles = [
  'hero-banner.tsx',
  'my-best-auntie-overview.tsx',
  'course-highlights.tsx',
  'free-resources-for-gentle-parenting.tsx',
  'testimonials.tsx',
  'ida.tsx',
  'my-history.tsx',
  'my-journey.tsx',
  'why-us.tsx',
  'faq.tsx',
  'contact-us-form.tsx',
  'reach-out.tsx',
  'connect.tsx',
  'events.tsx',
  'my-best-auntie-booking.tsx',
  'my-best-auntie-description.tsx',
  'sprouts-squad-community.tsx',
] as const;

describe('Page section structure contract', () => {
  it.each(pageSectionFiles)(
    '%s uses shared section primitives and identifiers',
    (relativeFilePath) => {
      const absoluteFilePath = path.join(sectionsDirectory, relativeFilePath);
      const source = readFileSync(absoluteFilePath, 'utf-8');

      expect(source).toContain('<SectionShell');
      expect(source).toContain('<SectionContainer');
      expect(source).toContain('<SectionHeader');
      expect(source).toMatch(
        /<SectionShell[\s\S]*?id='[a-z0-9-]+'[\s\S]*?dataFigmaNode='[a-z0-9-]+'/,
      );
    },
  );
});
