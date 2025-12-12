import { NormalizedErrorCode, type NormalizedError } from '@common/errors/normalized-error.model';

interface AdyenLikeError {
  errorCode?: string;
  message?: string;
  status?: number;
}

/**
 * Map an Adyen-like error object into a NormalizedError.
 */
export class AdyenErrorMapper {
  static map(error: unknown): NormalizedError {
    const base: NormalizedError = {
      code: NormalizedErrorCode.Unknown,
      message: 'Unknown error from Adyen',
      gateway: 'adyen',
    };

    const adyenError = AdyenErrorMapper.toAdyenLike(error);

    const rawMessage =
      adyenError?.message ?? (error instanceof Error ? error.message : undefined) ?? base.message;

    const rawCode = adyenError?.errorCode;
    const statusCode = adyenError?.status;

    const code = AdyenErrorMapper.mapCode(rawCode, statusCode);
    const isRetriable = AdyenErrorMapper.isRetriable(code, statusCode);

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

  private static toAdyenLike(error: unknown): AdyenLikeError | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const candidate = error as Partial<AdyenLikeError>;

    return {
      errorCode: typeof candidate.errorCode === 'string' ? candidate.errorCode : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      status: typeof candidate.status === 'number' ? candidate.status : undefined,
    };
  }

  private static mapCode(
    rawCode: string | undefined,
    statusCode: number | undefined,
  ): NormalizedErrorCode {
    if (rawCode) {
      switch (rawCode) {
        case '14_009': // insufficient funds (example code)
          return NormalizedErrorCode.InsufficientFunds;
        case '14_003': // refused / card declined (example code)
          return NormalizedErrorCode.CardDeclined;
        case '901':
        case '702':
          return NormalizedErrorCode.InternalError;
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
