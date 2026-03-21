'use client';

import { Button } from '@/components/ui/button';

export interface AdminTabItem<T extends string = string> {
  key: T;
  label: string;
}

export interface AdminTabStripProps<T extends string> {
  items: readonly AdminTabItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  'aria-label'?: string;
}

export function AdminTabStrip<T extends string>({
  items,
  activeKey,
  onChange,
  'aria-label': ariaLabel,
}: AdminTabStripProps<T>) {
  return (
    <div className='flex flex-wrap gap-2' role='tablist' aria-label={ariaLabel}>
      {items.map((item) => (
        <Button
          key={item.key}
          type='button'
          role='tab'
          aria-selected={activeKey === item.key}
          variant={activeKey === item.key ? 'secondary' : 'ghost'}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
