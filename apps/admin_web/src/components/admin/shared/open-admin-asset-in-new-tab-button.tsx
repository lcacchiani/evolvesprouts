'use client';

import type { MouseEvent } from 'react';

import OpenInNewTabIcon from '@/components/icons/svg/open-in-new-tab-icon.svg';
import { Button } from '@/components/ui/button';

export interface OpenAdminAssetInNewTabButtonProps {
  assetId: string;
  isOpening: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  onOpen: (assetId: string, event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
}

export function OpenAdminAssetInNewTabButton({
  assetId,
  isOpening,
  disabled = false,
  title = 'Open asset in new tab',
  ariaLabel = 'Open asset in new tab',
  onOpen,
}: OpenAdminAssetInNewTabButtonProps) {
  return (
    <Button
      type='button'
      size='sm'
      variant='outline'
      onClick={(event) => void onOpen(assetId, event)}
      disabled={disabled || isOpening}
      title={title}
      aria-label={ariaLabel}
      aria-busy={isOpening}
    >
      <OpenInNewTabIcon className='h-4 w-4' />
    </Button>
  );
}
