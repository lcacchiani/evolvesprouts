import { useState } from 'react';

export type FormSubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

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

  function clearSubmissionError() {
    setSubmitErrorMessage('');
    if (submissionStatus === 'error') {
      setSubmissionStatus('idle');
    }
  }

  function setSubmissionError(errorMessage: string) {
    setSubmitErrorMessage(errorMessage);
    setSubmissionStatus('error');
  }

  function markSubmissionSuccess() {
    setSubmitErrorMessage('');
    setSubmissionStatus('success');
  }

  async function withSubmitting<T>(request: () => Promise<T>): Promise<T> {
    setSubmissionStatus('submitting');
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
