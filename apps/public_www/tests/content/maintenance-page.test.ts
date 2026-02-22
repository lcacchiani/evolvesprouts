import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const maintenanceDirectory = path.resolve(process.cwd(), 'maintenance');

function readMaintenanceFile(relativePath: string): string {
  return fs.readFileSync(
    path.join(maintenanceDirectory, relativePath),
    'utf-8',
  );
}

describe('maintenance static site assets', () => {
  it('keeps maintenance HTML files script-free and logo-only', () => {
    const indexHtml = readMaintenanceFile('index.html');
    const notFoundHtml = readMaintenanceFile('404.html');

    expect(indexHtml).toContain('/images/evolvesprouts-logo.svg');
    expect(notFoundHtml).toContain('/images/evolvesprouts-logo.svg');
    expect(indexHtml).not.toContain('<script');
    expect(notFoundHtml).not.toContain('<script');
  });

  it('ships a deny-all robots policy for maintenance mode', () => {
    const robotsTxt = readMaintenanceFile('robots.txt');

    expect(robotsTxt).toContain('User-agent: *');
    expect(robotsTxt).toContain('Disallow: /');
  });
});
