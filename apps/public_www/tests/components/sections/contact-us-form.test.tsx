import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContactUsForm } from '@/components/sections/contact-us-form';
import enContent from '@/content/en.json';

describe('ContactUsForm section', () => {
  it('uses class-based decorative background styling on the left panel', () => {
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
    expect(decorativeLayer?.className).toContain('es-contact-us-left-decor');
    expect(decorativeLayer?.getAttribute('style')).toBeNull();
  });

  it('uses the same input styling pattern as the booking form', () => {
    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const firstNameInput = screen.getByLabelText(
      enContent.contactUs.contactUsForm.firstNameLabel,
    );
    const emailInput = screen.getByLabelText(
      `${enContent.contactUs.contactUsForm.emailFieldLabel} (*)`,
    );
    const phoneInput = screen.getByLabelText(
      enContent.contactUs.contactUsForm.phoneLabel,
    );
    const messageInput = screen.getByLabelText(
      `${enContent.contactUs.contactUsForm.messageLabel} (*)`,
    );

    for (const input of [firstNameInput, emailInput, phoneInput, messageInput]) {
      expect(input.className).toContain('es-modal-input');
      expect(input.className).toContain('rounded-[14px]');
      expect(input.className).toContain('text-[16px]');
      expect(input.className).toContain('font-semibold');
    }
  });

  it('renders promise items as bulleted text without background cards', () => {
    render(<ContactUsForm content={enContent.contactUs.contactUsForm} />);

    const promiseList = screen
      .getByRole('heading', {
        level: 2,
        name: enContent.contactUs.contactUsForm.promiseTitle,
      })
      .nextElementSibling as HTMLUListElement | null;
    expect(promiseList).not.toBeNull();
    expect(promiseList?.className).toContain('list-disc');

    const listItems = promiseList?.querySelectorAll('li') ?? [];
    expect(listItems.length).toBeGreaterThan(0);
    for (const listItem of listItems) {
      expect(listItem.className).not.toContain('bg-white');
      expect(listItem.className).not.toContain('shadow-');
    }
  });
});
