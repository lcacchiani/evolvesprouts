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
  it('keeps maintenance HTML files script-free with contact methods', () => {
    const indexHtml = readMaintenanceFile('index.html');
    const notFoundHtml = readMaintenanceFile('404.html');

    expect(indexHtml).toContain('/images/evolvesprouts-logo.svg');
    expect(indexHtml).toContain('Get in touch');
    expect(indexHtml).toContain('__NEXT_PUBLIC_EMAIL__');
    expect(indexHtml).toContain('__NEXT_PUBLIC_WHATSAPP_URL__');
    expect(indexHtml).toContain('__NEXT_PUBLIC_INSTAGRAM_URL__');
    expect(indexHtml).toContain('/images/whatsapp-qr.png');
    expect(indexHtml).toContain('/images/instagram-qr.png');
    expect(notFoundHtml).toContain('/images/evolvesprouts-logo.svg');
    expect(indexHtml).not.toContain('<script');
    expect(notFoundHtml).not.toContain('<script');
  });

  it('includes maintenance QR image assets', () => {
    const whatsappQr = path.join(maintenanceDirectory, 'images', 'whatsapp-qr.png');
    const instagramQr = path.join(maintenanceDirectory, 'images', 'instagram-qr.png');

    expect(fs.existsSync(whatsappQr)).toBe(true);
    expect(fs.existsSync(instagramQr)).toBe(true);
  });

  it('ships a deny-all robots policy for maintenance mode', () => {
    const robotsTxt = readMaintenanceFile('robots.txt');

    expect(robotsTxt).toContain('User-agent: *');
    expect(robotsTxt).toContain('Disallow: /');
  });
});
