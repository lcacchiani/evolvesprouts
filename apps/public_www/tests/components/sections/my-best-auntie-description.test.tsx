import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MyBestAuntieDescription } from '@/components/sections/my-best-auntie-description';
import enContent from '@/content/en.json';

describe('MyBestAuntieDescription section', () => {
  it('uses migrated section background class and left-aligned heading', () => {
    render(<MyBestAuntieDescription content={enContent.myBestAuntieDescription} />);

    const section = screen.getByRole('region', {
      name: enContent.myBestAuntieDescription.title,
    });

    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-my-best-auntie-description-section');

    const title = screen.getByRole('heading', {
      level: 2,
      name: enContent.myBestAuntieDescription.title,
    });
    const titleWrapperClassName = title.parentElement?.className ?? '';

    expect(titleWrapperClassName).toContain('text-left');
    expect(titleWrapperClassName).not.toContain('text-center');
  });

  it('keeps controls in the same header row as the title', () => {
    render(<MyBestAuntieDescription content={enContent.myBestAuntieDescription} />);

    const header = screen.getByTestId('my-best-auntie-description-header');
    const controls = screen.getByTestId('my-best-auntie-description-controls');

    expect(header.className).toContain('md:flex-row');
    expect(header.className).toContain('md:items-end');
    expect(controls.parentElement).toBe(header);
    expect(controls.className).toContain('hidden');
    expect(controls.className).toContain('md:flex');
  });

  it('renders highlight cards without box shadow', () => {
    render(<MyBestAuntieDescription content={enContent.myBestAuntieDescription} />);

    const cardHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(cardHeadings).toHaveLength(enContent.myBestAuntieDescription.items.length);
    expect(
      screen.queryByRole('link', {
        name: enContent.myBestAuntieDescription.items[0]?.ctaLabel,
      }),
    ).not.toBeInTheDocument();

    const firstCardTitle = enContent.myBestAuntieDescription.items[0]?.title;
    expect(firstCardTitle).toBeDefined();

    const cardHeading = screen.getByRole('heading', {
      level: 3,
      name: firstCardTitle,
    });
    const cardArticle = cardHeading.closest('article');

    expect(cardArticle?.className).toContain('es-my-best-auntie-description-card');
    expect(cardArticle?.getAttribute('style')).toBeNull();
    expect(cardHeading.className).toContain('es-my-best-auntie-description-card-title');

    const cardBody = cardArticle?.querySelector('p');
    expect(cardBody?.className).toContain('es-my-best-auntie-description-card-description');
  });

  it('applies icon masks and repeats green-blue-red tones', () => {
    const { container } = render(
      <MyBestAuntieDescription content={enContent.myBestAuntieDescription} />,
    );

    const icons = container.querySelectorAll('.es-my-best-auntie-description-icon');
    expect(icons).toHaveLength(enContent.myBestAuntieDescription.items.length);

    const expectedMaskClasses = [
      'es-my-best-auntie-description-icon--training',
      'es-my-best-auntie-description-icon--coaching',
      'es-my-best-auntie-description-icon--call',
      'es-my-best-auntie-description-icon--community',
      'es-my-best-auntie-description-icon--toolbox',
      'es-my-best-auntie-description-icon--support',
      'es-my-best-auntie-description-icon--review',
      'es-my-best-auntie-description-icon--graduation',
    ];
    const expectedToneClasses = [
      'es-my-best-auntie-description-icon-tone--green',
      'es-my-best-auntie-description-icon-tone--blue',
      'es-my-best-auntie-description-icon-tone--red',
      'es-my-best-auntie-description-icon-tone--green',
      'es-my-best-auntie-description-icon-tone--blue',
      'es-my-best-auntie-description-icon-tone--red',
      'es-my-best-auntie-description-icon-tone--green',
      'es-my-best-auntie-description-icon-tone--blue',
    ];

    icons.forEach((icon, index) => {
      expect(icon.className).toContain(expectedMaskClasses[index]);
      expect(icon.className).toContain(expectedToneClasses[index]);
    });
  });
});
