'use client';

import { useState, type ReactNode } from 'react';

export interface AdminCollapsibleSectionProps {
  /** Stable id prefix; panel id becomes `${id}-panel`. */
  id: string;
  title: string;
  children: ReactNode;
  /** When true, wraps body in a disabled fieldset (for example tag pickers while saving). */
  disabled?: boolean;
}

export function AdminCollapsibleSection({ id, title, children, disabled }: AdminCollapsibleSectionProps) {
  const panelId = `${id}-panel`;
  const [open, setOpen] = useState(false);

  const body = disabled ? (
    <fieldset disabled className='m-0 min-w-0 border-0 p-0'>
      {children}
    </fieldset>
  ) : (
    children
  );

  return (
    <details
      className='rounded-md border border-slate-200 bg-slate-50/40'
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary
        className='cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100/60'
        aria-controls={panelId}
      >
        {title}
      </summary>
      <div className='px-3 pb-3 pt-1' id={panelId}>
        {body}
      </div>
    </details>
  );
}
