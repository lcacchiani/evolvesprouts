import type { FooterContent } from '@/content';

interface FooterProps {
  content: FooterContent;
}

export function Footer({ content }: FooterProps) {
  return (
    <footer
      data-figma-node="footer"
      className="w-full border-t border-slate-200 px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm font-semibold">{content.brand}</p>
        <nav className="flex gap-4">
          {Object.entries(content.links).map(([key, label]) => (
            <a
              key={key}
              href={`/${key}`}
              className="text-sm text-slate-500 transition-colors hover:text-slate-700"
            >
              {label}
            </a>
          ))}
        </nav>
        <p className="text-xs text-slate-400">{content.copyright}</p>
      </div>
    </footer>
  );
}
