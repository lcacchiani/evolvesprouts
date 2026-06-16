import type { FormAnswerState } from '@/components/forms/form-answer-state';
import { emptyFormAnswerState } from '@/components/forms/form-answer-state';

const STORAGE_PREFIX = 'evolvesprouts-form-progress:';

export interface StoredFormProgress {
  stepIndex: number;
  answersByQuestionId: Record<string, FormAnswerState>;
}

export function loadFormProgress(formSlug: string, sessionId: string): StoredFormProgress | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(storageKey(formSlug, sessionId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredFormProgress;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.stepIndex !== 'number' ||
      typeof parsed.answersByQuestionId !== 'object' ||
      parsed.answersByQuestionId === null
    ) {
      return null;
    }
    return {
      stepIndex: Math.max(0, parsed.stepIndex),
      answersByQuestionId: parsed.answersByQuestionId,
    };
  } catch {
    return null;
  }
}

export function saveFormProgress(
  formSlug: string,
  sessionId: string,
  progress: StoredFormProgress,
): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(storageKey(formSlug, sessionId), JSON.stringify(progress));
  } catch {
    // Ignore quota or privacy errors; resume is best-effort.
  }
}

export function mergeStoredAnswers(
  stored: Record<string, FormAnswerState> | undefined,
): Record<string, FormAnswerState> {
  if (!stored) {
    return {};
  }
  const merged: Record<string, FormAnswerState> = {};
  for (const [questionId, answer] of Object.entries(stored)) {
    merged[questionId] = {
      ...emptyFormAnswerState(),
      ...answer,
    };
  }
  return merged;
}

function storageKey(formSlug: string, sessionId: string): string {
  return `${STORAGE_PREFIX}${formSlug}:${sessionId}`;
}
