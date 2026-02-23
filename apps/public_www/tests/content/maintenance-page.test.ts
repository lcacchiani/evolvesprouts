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

function normalizeHtml(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

describe('maintenance static site assets', () => {
  it('keeps maintenance HTML files script-free with icon contact methods', () => {
    const indexHtml = readMaintenanceFile('index.html');
    const notFoundHtml = readMaintenanceFile('404.html');

    expect(indexHtml).toContain('/images/evolvesprouts-logo.svg');
    expect(indexHtml).toContain('Sprouting Something New!');
    expect(indexHtml).toContain(
      'In the meantime, we&#39;d love to hear from you!',
    );
    expect(indexHtml).toContain(
      'Thank you for your patience &ndash; every sprout needs time to bloom.',
    );
    expect(indexHtml).toContain('__NEXT_PUBLIC_EMAIL__');
    expect(indexHtml).toContain('__NEXT_PUBLIC_WHATSAPP_URL__');
    expect(indexHtml).toContain('__NEXT_PUBLIC_INSTAGRAM_URL__');
    expect(indexHtml).toContain('maintenance__contact-icon--whatsapp');
    expect(indexHtml).toContain('maintenance__contact-icon--instagram');
    expect(indexHtml).toContain('aria-label="Email Evolve Sprouts"');
    expect(indexHtml).toContain('aria-label="Instagram Evolve Sprouts"');
    expect(normalizeHtml(notFoundHtml)).toBe(normalizeHtml(indexHtml));
    expect(indexHtml).not.toContain('<script');
    expect(notFoundHtml).not.toContain('<script');
  });

  it('keeps branded maintenance icon colors and reduced logo top spacing in CSS', () => {
    const stylesCss = readMaintenanceFile('styles.css');

    expect(stylesCss).toMatch(/--maintenance-color-whatsapp:\s*#25d366;/i);
    expect(stylesCss).toMatch(/--maintenance-color-instagram:\s*#e4405f;/i);
    expect(stylesCss).toContain('padding: 0.1875rem 1.5rem 1.5rem;');
    expect(stylesCss).toMatch(
      /\.maintenance__contact-icon\s*\{[^}]*width:\s*3\.75rem;[^}]*height:\s*3\.75rem;/s,
    );
    expect(stylesCss).toMatch(
      /\.maintenance__contact-icon--whatsapp\s*\{[^}]*width:\s*3\.5rem;[^}]*height:\s*3\.5rem;[^}]*color:\s*var\(--maintenance-color-whatsapp\);/s,
    );
    expect(stylesCss).toMatch(
      /\.maintenance__contact-icon--instagram\s*\{[^}]*color:\s*var\(--maintenance-color-instagram\);/s,
    );
  });

  it('does not reference maintenance QR image assets', () => {
    const indexHtml = readMaintenanceFile('index.html');
    const notFoundHtml = readMaintenanceFile('404.html');
    const maintenanceImagesDirectory = path.join(maintenanceDirectory, 'images');

    expect(indexHtml).not.toMatch(/\/images\/[A-Za-z0-9_-]*qr[A-Za-z0-9_-]*\.png/i);
    expect(notFoundHtml).not.toMatch(/\/images\/[A-Za-z0-9_-]*qr[A-Za-z0-9_-]*\.png/i);

    if (!fs.existsSync(maintenanceImagesDirectory)) {
      return;
    }

    const maintenanceImageFileNames = fs.readdirSync(maintenanceImagesDirectory);
    expect(
      maintenanceImageFileNames.some((fileName) => /qr[A-Za-z0-9_-]*\.png/i.test(fileName)),
    ).toBe(false);
  });

  it('ships a deny-all robots policy for maintenance mode', () => {
    const robotsTxt = readMaintenanceFile('robots.txt');

    expect(robotsTxt).toContain('User-agent: *');
    expect(robotsTxt).toContain('Disallow: /');
  });
});
