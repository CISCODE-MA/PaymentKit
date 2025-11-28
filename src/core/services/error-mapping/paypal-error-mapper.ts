import { NormalizedErrorCode, type NormalizedError } from '@common/errors/normalized-error.model';

interface PaypalLikeError {
  name?: string;
  message?: string;
  details?: Array<{ issue?: string; description?: string }>;
  statusCode?: number;
}

/**
 * Map a PayPal-like error object into a NormalizedError.
 */
export class PaypalErrorMapper {
  static map(error: unknown): NormalizedError {
    const base: NormalizedError = {
      code: NormalizedErrorCode.Unknown,
      message: 'Unknown error from PayPal',
      gateway: 'paypal',
    };

    const paypalError = PaypalErrorMapper.toPaypalLike(error);

    const detailMessage = paypalError?.details?.[0]?.description;
    const rawMessage =
      detailMessage ??
      paypalError?.message ??
      (error instanceof Error ? error.message : undefined) ??
      base.message;

    const rawCode = paypalError?.name ?? paypalError?.details?.[0]?.issue;
    const statusCode = paypalError?.statusCode;

    const code = PaypalErrorMapper.mapCode(rawCode, statusCode);
    const isRetriable = PaypalErrorMapper.isRetriable(code, statusCode);

    return {
      ...base,
      code,
      message: rawMessage,
      rawCode,
      rawMessage,
      httpStatus: statusCode,
      isRetriable,
    };
  }

  private static toPaypalLike(error: unknown): PaypalLikeError | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const candidate = error as Partial<PaypalLikeError>;

    return {
      name: typeof candidate.name === 'string' ? candidate.name : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      details: Array.isArray(candidate.details) ? candidate.details : undefined,
      statusCode: typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined,
    };
  }

  private static mapCode(
    rawCode: string | undefined,
    statusCode: number | undefined,
  ): NormalizedErrorCode {
    if (rawCode) {
      switch (rawCode) {
        case 'VALIDATION_ERROR':
        case 'INVALID_REQUEST':
          return NormalizedErrorCode.InvalidRequest;
        case 'UNAUTHORIZED':
          return NormalizedErrorCode.AuthenticationFailed;
        case 'FORBIDDEN':
          return NormalizedErrorCode.AuthorizationFailed;
        default:
          break;
      }
    }

    if (statusCode === 400 || statusCode === 422) {
      return NormalizedErrorCode.InvalidRequest;
    }

    if (statusCode === 401) {
      return NormalizedErrorCode.AuthenticationFailed;
    }

    if (statusCode === 403) {
      return NormalizedErrorCode.AuthorizationFailed;
    }

    if (statusCode === 429) {
      return NormalizedErrorCode.RateLimited;
    }

    if (statusCode && statusCode >= 500) {
      return NormalizedErrorCode.InternalError;
    }

    return NormalizedErrorCode.Unknown;
  }

  private static isRetriable(code: NormalizedErrorCode, statusCode: number | undefined): boolean {
    if (code === NormalizedErrorCode.RateLimited || code === NormalizedErrorCode.NetworkError) {
      return true;
    }

    if (code === NormalizedErrorCode.InternalError) {
      return true;
    }

    if (statusCode && statusCode >= 500) {
      return true;
    }

    return false;
  }
}
