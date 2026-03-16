import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinksHub } from '@/components/sections/links-hub';

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock('@/lib/meta-pixel', () => ({
  trackMetaPixelEvent: vi.fn(),
}));

const { trackAnalyticsEvent } = await import('@/lib/analytics');
const { trackMetaPixelEvent } = await import('@/lib/meta-pixel');

const DEFAULT_CONTENT = {
  ariaLabel: 'Quick links',
  heading: 'Evolve Sprouts',
  tagline: 'Montessori-inspired guidance for families in Hong Kong',
  courseLabel: 'My Best Auntie Course',
  contactLabel: 'Contact Us',
  eventsLabel: 'Upcoming Events',
  whatsappLabel: 'WhatsApp Us',
};

const DEFAULT_PROPS = {
  content: DEFAULT_CONTENT,
  localizedCourseHref: '/en/services/my-best-auntie-training-course',
  localizedContactHref: '/en/contact-us',
  localizedEventsHref: '/en/events',
  whatsappHref: 'https://wa.me/85294479843',
};

describe('LinksHub', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading and tagline', () => {
    render(<LinksHub {...DEFAULT_PROPS} />);

    expect(screen.getByText('Evolve Sprouts')).toBeDefined();
    expect(
      screen.getByText('Montessori-inspired guidance for families in Hong Kong'),
    ).toBeDefined();
  });

  it('renders all four link buttons', () => {
    render(<LinksHub {...DEFAULT_PROPS} />);

    expect(screen.getByText('My Best Auntie Course')).toBeDefined();
    expect(screen.getByText('Contact Us')).toBeDefined();
    expect(screen.getByText('Upcoming Events')).toBeDefined();
    expect(screen.getByText('WhatsApp Us')).toBeDefined();
  });

  it('renders correct hrefs on link buttons', () => {
    render(<LinksHub {...DEFAULT_PROPS} />);

    const courseLink = screen.getByText('My Best Auntie Course').closest('a');
    expect(courseLink?.getAttribute('href')).toBe(
      '/en/services/my-best-auntie-training-course',
    );

    const contactLink = screen.getByText('Contact Us').closest('a');
    expect(contactLink?.getAttribute('href')).toBe('/en/contact-us');

    const eventsLink = screen.getByText('Upcoming Events').closest('a');
    expect(eventsLink?.getAttribute('href')).toBe('/en/events');
  });

  it('opens WhatsApp link in new tab', () => {
    render(<LinksHub {...DEFAULT_PROPS} />);

    const whatsappLink = screen.getByText('WhatsApp Us').closest('a');
    expect(whatsappLink?.getAttribute('target')).toBe('_blank');
    expect(whatsappLink?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('fires analytics event on course link click', () => {
    render(<LinksHub {...DEFAULT_PROPS} />);

    const courseLink = screen.getByText('My Best Auntie Course');
    fireEvent.click(courseLink);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('links_hub_click', {
      sectionId: 'links-hub',
      ctaLocation: 'links_page',
      params: { content_name: 'my_best_auntie_course' },
    });
    expect(trackMetaPixelEvent).toHaveBeenCalledWith('ViewContent', {
      content_name: 'my_best_auntie_course',
    });
  });

  it('fires whatsapp_click and Contact events on WhatsApp click', () => {
    render(<LinksHub {...DEFAULT_PROPS} />);

    const whatsappLink = screen.getByText('WhatsApp Us');
    fireEvent.click(whatsappLink);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('whatsapp_click', {
      sectionId: 'links-hub',
      ctaLocation: 'links_page',
    });
    expect(trackMetaPixelEvent).toHaveBeenCalledWith('Contact', {
      content_name: 'whatsapp',
    });
  });

  it('hides WhatsApp button when whatsappHref is empty', () => {
    render(<LinksHub {...DEFAULT_PROPS} whatsappHref='' />);

    expect(screen.queryByText('WhatsApp Us')).toBeNull();
  });

  it('renders the section with correct id and aria-label', () => {
    render(<LinksHub {...DEFAULT_PROPS} />);

    const section = document.querySelector('#links-hub');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('aria-label')).toBe('Quick links');
  });

  it('renders the logo image', () => {
    render(<LinksHub {...DEFAULT_PROPS} />);

    const logo = document.querySelector('img[src="/images/evolvesprouts-logo.svg"]');
    expect(logo).not.toBeNull();
  });
});
