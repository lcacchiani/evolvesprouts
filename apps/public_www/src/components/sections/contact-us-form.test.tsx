import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContactUsForm } from '@/components/sections/contact-us-form';
import enContent from '@/content/en.json';

describe('ContactUsForm section', () => {
  it('uses the hero decorative background styling on the left panel', () => {
    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const leftPanelHeading = screen.getByRole('heading', {
      level: 1,
      name: enContent.contactUs.contactUsForm.title,
    });
    const leftPanel = leftPanelHeading.closest('section');
    expect(leftPanel).not.toBeNull();

    const decorativeLayer = leftPanel?.querySelector(
      'div[aria-hidden="true"]',
    ) as HTMLDivElement | null;
    expect(decorativeLayer).not.toBeNull();
    expect(decorativeLayer?.style.backgroundImage).toContain(
      '/images/evolvesprouts-logo.svg',
    );
    expect(decorativeLayer?.style.width).toBe('1500px');
    expect(decorativeLayer?.style.height).toBe('750px');
    expect(decorativeLayer?.style.backgroundSize).toBe('cover');
    expect(decorativeLayer?.style.backgroundPosition).toBe('-750px -250px');
    expect(decorativeLayer?.style.filter).toBe(
      'sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)',
    );
    expect(decorativeLayer?.style.maskImage).toContain(
      'linear-gradient(black 60%, transparent 90%)',
    );
  });
});
