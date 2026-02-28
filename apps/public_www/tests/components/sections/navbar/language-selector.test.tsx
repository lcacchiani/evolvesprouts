/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  LanguageSelectorButton,
  resolveLanguageSelectorContent,
} from '@/components/sections/navbar/language-selector';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('language-selector', () => {
  it('normalizes selector content from navbar copy', () => {
    const selector = resolveLanguageSelectorContent(enContent.navbar);

    expect(selector.menuAriaLabel).toBe(enContent.navbar.languageSelector.menuAriaLabel);
    expect(selector.selectedLanguageAriaPrefix).toBe(
      enContent.navbar.languageSelector.selectedLanguageAriaPrefix,
    );
    expect(selector.options).toHaveLength(3);
  });

  it('renders language options and localized hrefs', () => {
    const selector = resolveLanguageSelectorContent(enContent.navbar);
    render(
      <LanguageSelectorButton
        className='h-11'
        currentLocale='en'
        currentPathname='/en/about-us'
        languageSelector={selector}
      />,
    );

    const toggle = screen.getByRole('button', {
      name: /Selected language: English/i,
    });
    fireEvent.click(toggle);

    const menu = screen.getByRole('menu', { name: selector.menuAriaLabel });
    expect(menu).toBeInTheDocument();

    const simplifiedOption = screen.getByRole('menuitem', { name: /简体中文/i });
    const traditionalOption = screen.getByRole('menuitem', { name: /繁體中文/i });

    expect(simplifiedOption).toHaveAttribute('href', '/zh-CN/about-us');
    expect(traditionalOption).toHaveAttribute('href', '/zh-HK/about-us');
  });
});
