import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';

export type FormSubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface CaptchaErrorContent {
  requiredError: string;
  loadError: string;
  unavailableError: string;
}

export function resolveCaptchaErrorMessage(
  state: {
    isCaptchaConfigured: boolean;
    hasCaptchaLoadError: boolean;
    hasCaptchaValidationError: boolean;
  },
  content: CaptchaErrorContent,
): string {
  if (!state.isCaptchaConfigured) {
    return content.unavailableError;
  }
  if (state.hasCaptchaLoadError) {
    return content.loadError;
  }
  if (state.hasCaptchaValidationError) {
    return content.requiredError;
  }
  return '';
}

interface UseFormSubmissionOptions {
  turnstileSiteKey: string;
}

export function useFormSubmission({ turnstileSiteKey }: UseFormSubmissionOptions) {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaTouched, setIsCaptchaTouched] = useState(false);
  const [hasCaptchaLoadError, setHasCaptchaLoadError] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<FormSubmissionStatus>('idle');
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');

  const isCaptchaConfigured = turnstileSiteKey.trim() !== '';
  const isCaptchaUnavailable = !isCaptchaConfigured || hasCaptchaLoadError;
  const hasCaptchaValidationError = isCaptchaTouched && !captchaToken;
  const isSubmitting = submissionStatus === 'submitting';
  const hasSuccessfulSubmission = submissionStatus === 'success';

  function markCaptchaTouched() {
    setIsCaptchaTouched(true);
  }

  function handleCaptchaTokenChange(token: string | null) {
    setCaptchaToken(token);
    if (token) {
      setIsCaptchaTouched(false);
      setHasCaptchaLoadError(false);
    }
  }

  function handleCaptchaLoadError() {
    setHasCaptchaLoadError(true);
  }

  const clearSubmissionError = useCallback(() => {
    setSubmitErrorMessage('');
    setSubmissionStatus((currentStatus) =>
      currentStatus === 'error' ? 'idle' : currentStatus,
    );
  }, []);

  const setSubmissionError = useCallback((errorMessage: string) => {
    setSubmitErrorMessage(errorMessage);
    setSubmissionStatus('error');
  }, []);

  function markSubmissionSuccess() {
    setSubmitErrorMessage('');
    setSubmissionStatus('success');
  }

  async function withSubmitting<T>(request: () => Promise<T>): Promise<T> {
    // Ensure the loading UI (e.g. submit button gear) commits before the async
    // request runs, so fast responses still produce at least one painted frame.
    flushSync(() => {
      setSubmissionStatus('submitting');
    });
    try {
      return await request();
    } finally {
      setSubmissionStatus((currentStatus) =>
        currentStatus === 'submitting' ? 'idle' : currentStatus,
      );
    }
  }

  return {
    captchaToken,
    hasCaptchaLoadError,
    hasCaptchaValidationError,
    hasSuccessfulSubmission,
    isCaptchaConfigured,
    isCaptchaTouched,
    isCaptchaUnavailable,
    isSubmitting,
    markCaptchaTouched,
    handleCaptchaLoadError,
    handleCaptchaTokenChange,
    clearSubmissionError,
    markSubmissionSuccess,
    setSubmissionError,
    submitErrorMessage,
    withSubmitting,
  };
}
