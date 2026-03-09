interface ErrorPayload {
  context: string;
  error: unknown;
  metadata?: Record<string, unknown>;
}

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    value: String(error),
  };
}

export function reportInternalError({
  context,
  error,
  metadata,
}: ErrorPayload) {
  console.error(`[internal-error:${context}]`, {
    ...metadata,
    error: normalizeError(error),
  });
}
