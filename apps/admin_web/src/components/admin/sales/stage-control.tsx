'use client';

import { useState } from 'react';

import { FUNNEL_STAGES } from '@/types/leads';
import type { FunnelStage } from '@/types/leads';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toTitleCase } from '@/lib/format';

import { getStageBadgeClass } from './stage-utils';

export interface StageControlProps {
  currentStage: FunnelStage;
  isLoading: boolean;
  onUpdateStage: (stage: FunnelStage, lostReason?: string) => Promise<void> | void;
}

export function StageControl({ currentStage, isLoading, onUpdateStage }: StageControlProps) {
  const [nextStage, setNextStage] = useState<FunnelStage>(currentStage);
  const [lostReason, setLostReason] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const needsLostReason = nextStage === 'lost';

  return (
    <Card title='Stage control' className='space-y-3'>
      <p className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStageBadgeClass(currentStage)}`}>
        Current: {toTitleCase(currentStage)}
      </p>
      <Select
        value={nextStage}
        onChange={(event) => {
          setNextStage(event.target.value as FunnelStage);
          setIsConfirming(false);
        }}
      >
        {FUNNEL_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {toTitleCase(stage)}
          </option>
        ))}
      </Select>
      {needsLostReason ? (
        <Textarea
          value={lostReason}
          onChange={(event) => setLostReason(event.target.value)}
          placeholder='Lost reason (required)'
        />
      ) : null}
      <div className='flex items-center gap-2'>
        {!isConfirming ? (
          <Button
            type='button'
            variant='outline'
            disabled={isLoading || (needsLostReason && lostReason.trim().length === 0)}
            onClick={() => setIsConfirming(true)}
          >
            Change stage
          </Button>
        ) : (
          <>
            <Button
              type='button'
              disabled={isLoading || (needsLostReason && lostReason.trim().length === 0)}
              onClick={async () => {
                await onUpdateStage(nextStage, lostReason.trim() || undefined);
                setIsConfirming(false);
              }}
            >
              Confirm {toTitleCase(currentStage)} → {toTitleCase(nextStage)}
            </Button>
            <Button type='button' variant='ghost' onClick={() => setIsConfirming(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
