import type { NavbarContent } from '@/content';

interface NavbarProps {
  content: NavbarContent;
}

export function Navbar({ content }: NavbarProps) {
  return (
    <header
      data-figma-node="navbar"
      className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="text-xl font-bold tracking-tight">
          {content.brand}
        </a>
        <ul className="hidden gap-6 md:flex">
          {Object.entries(content.links).map(([key, label]) => (
            <li key={key}>
              <a
                href={`#${key}`}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
