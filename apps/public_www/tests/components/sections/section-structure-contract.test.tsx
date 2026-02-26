import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sectionsDirectory = path.resolve(__dirname, '../../../src/components/sections');
const srcDirectory = path.resolve(__dirname, '../../../src');
const appDirectory = path.resolve(__dirname, '../../../src/app');
const publicScriptsDirectory = path.resolve(__dirname, '../../../public/scripts');

const pageSectionFiles = [
  'hero-banner.tsx',
  'ida-intro.tsx',
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

function collectAppSourceFiles(targetDirectory: string): string[] {
  const entries = readdirSync(targetDirectory, { withFileTypes: true });
  const sourceFiles: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const absoluteEntryPath = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      sourceFiles.push(...collectAppSourceFiles(absoluteEntryPath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      sourceFiles.push(absoluteEntryPath);
    }
  }

  return sourceFiles;
}

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

describe('App source typography class contract', () => {
  it('does not use inline text clamp utility classes', () => {
    const sourceFiles = collectAppSourceFiles(srcDirectory);
    const filesWithInlineClampClass = sourceFiles
      .filter((filePath) => readFileSync(filePath, 'utf-8').includes('text-[clamp('))
      .map((filePath) => path.relative(srcDirectory, filePath))
      .sort((left, right) => left.localeCompare(right));

    expect(filesWithInlineClampClass).toEqual([]);
  });
});

describe('No-CSS fallback contract', () => {
  it('keeps the stylesheet marker and duplicate-hiding script wired', () => {
    const layoutSource = readFileSync(path.join(appDirectory, 'layout.tsx'), 'utf-8');
    const baseCssSource = readFileSync(
      path.join(appDirectory, 'styles/original/base.css'),
      'utf-8',
    );
    const fallbackScriptSource = readFileSync(
      path.join(publicScriptsDirectory, 'hide-css-sensitive-duplicates.js'),
      'utf-8',
    );

    expect(layoutSource).toContain('/scripts/hide-css-sensitive-duplicates.js');
    expect(baseCssSource).toContain('--es-css-loaded: loaded;');
    expect(fallbackScriptSource).toContain("var cssLoadedMarkerName = '--es-css-loaded';");
    expect(fallbackScriptSource).toContain('[data-css-fallback="');
    expect(fallbackScriptSource).toContain("setAttribute('hidden', '')");
  });
});
