'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { NAVBAR_LOCAL_DATETIME_OPTIONS } from '@/lib/format';

import CloseIcon from './icons/svg/close-icon.svg';
import MenuIcon from './icons/svg/menu-icon.svg';
import { Button } from './ui/button';

export interface AppShellNavItem {
  key: string;
  label: string;
  href: string;
}

export interface AppShellProps {
  navItems: AppShellNavItem[];
  activeKey: string;
  onLogout: () => void;
  userEmail?: string;
  lastAuthTime?: string;
  children: ReactNode;
}

function formatGmtOffset(value: Date): string {
  const offsetMinutesEast = -value.getTimezoneOffset();
  const sign = offsetMinutesEast >= 0 ? '+' : '-';
  const absoluteOffsetMinutes = Math.abs(offsetMinutesEast);
  const hours = Math.floor(absoluteOffsetMinutes / 60);
  const minutes = absoluteOffsetMinutes % 60;
  if (minutes === 0) {
    return `GMT${sign}${hours}`;
  }
  return `GMT${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
}

function formatTimestamp(value?: string): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const localTimestamp = parsedDate.toLocaleString(undefined, NAVBAR_LOCAL_DATETIME_OPTIONS);
  return `${localTimestamp} ${formatGmtOffset(parsedDate)}`;
}

export function AppShell({
  navItems,
  activeKey,
  onLogout,
  userEmail,
  lastAuthTime,
  children,
}: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const activeLabel = useMemo(
    () => navItems.find((item) => item.key === activeKey)?.label ?? '',
    [activeKey, navItems]
  );
  const formattedLastLoginTime = formatTimestamp(lastAuthTime);

  return (
    <div className='min-h-screen bg-slate-50 text-slate-900'>
      <a
        href='#main-content'
        className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg'
      >
        Skip to main content
      </a>
      <header className='sticky top-0 z-30 border-b border-slate-200 bg-white'>
        <div className='mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6'>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => setIsMobileMenuOpen((previous) => !previous)}
              className='inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 lg:hidden'
              aria-expanded={isMobileMenuOpen}
              aria-label='Toggle navigation'
            >
              {isMobileMenuOpen ? (
                <CloseIcon className='h-4 w-4' />
              ) : (
                <MenuIcon className='h-4 w-4' />
              )}
            </button>
            <Image
              src='/images/evolvesprouts-logo.svg'
              alt=''
              aria-hidden
              width={100}
              height={100}
              className='h-11 w-11 shrink-0 lg:mr-[-20px] lg:mt-[-20px] lg:mb-[-20px] lg:h-[100px] lg:w-[100px]'
            />
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.25em] text-slate-500'>
                Evolve Sprouts Admin
              </p>
              <h1 className='text-lg font-semibold'>{activeLabel || 'Admin'}</h1>
            </div>
          </div>
          <div className='hidden items-center gap-3 lg:flex'>
            {userEmail ? (
              <div className='text-right'>
                <p className='text-sm text-slate-700'>{userEmail}</p>
                {formattedLastLoginTime ? (
                  <p className='text-xs text-slate-500'>Last login: {formattedLastLoginTime}</p>
                ) : null}
              </div>
            ) : null}
            <Button type='button' variant='outline' onClick={onLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className='mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]'>
        <aside
          className={`${isMobileMenuOpen ? 'block' : 'hidden'} rounded-xl border border-slate-200 bg-white p-3 lg:block`}
        >
          {userEmail ? (
            <div className='mb-3 border-b border-slate-200 pb-3 lg:hidden'>
              <p className='text-sm text-slate-700'>{userEmail}</p>
              {formattedLastLoginTime ? (
                <p className='mt-1 text-xs text-slate-500'>Last login: {formattedLastLoginTime}</p>
              ) : null}
            </div>
          ) : null}
          <nav className='space-y-1'>
            {navItems.map((item) => {
              const isActive = item.key === activeKey;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className='mt-3 border-t border-slate-200 pt-3 lg:hidden'>
            <Button
              type='button'
              variant='outline'
              className='w-full'
              onClick={() => {
                setIsMobileMenuOpen(false);
                onLogout();
              }}
            >
              Sign out
            </Button>
          </div>
        </aside>

        <main id='main-content' className='min-w-0'>
          {children}
        </main>
      </div>
    </div>
  );
}
