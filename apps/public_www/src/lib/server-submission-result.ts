import { CrmApiRequestError } from '@/lib/crm-api-client';

interface ResolveServerSubmissionResultOptions {
  request: () => Promise<unknown>;
  failureMessage: string;
}

export class ServerSubmissionResult {
  readonly isSuccess: boolean;
  readonly errorMessage: string;
  readonly statusCode: number | null;

  private constructor({
    isSuccess,
    errorMessage,
    statusCode,
  }: {
    isSuccess: boolean;
    errorMessage: string;
    statusCode: number | null;
  }) {
    this.isSuccess = isSuccess;
    this.errorMessage = errorMessage;
    this.statusCode = statusCode;
  }

  static success(): ServerSubmissionResult {
    return new ServerSubmissionResult({
      isSuccess: true,
      errorMessage: '',
      statusCode: null,
    });
  }

  static failure(
    errorMessage: string,
    statusCode: number | null = null,
  ): ServerSubmissionResult {
    return new ServerSubmissionResult({
      isSuccess: false,
      errorMessage,
      statusCode,
    });
  }

  static async resolve({
    request,
    failureMessage,
  }: ResolveServerSubmissionResultOptions): Promise<ServerSubmissionResult> {
    try {
      await request();
      return ServerSubmissionResult.success();
    } catch (error) {
      if (error instanceof CrmApiRequestError) {
        return ServerSubmissionResult.failure(failureMessage, error.statusCode);
      }

      return ServerSubmissionResult.failure(failureMessage);
    }
  }
}
