import { NormalizedErrorCode, type NormalizedError } from '@common/errors/normalized-error.model';

interface StripeLikeError {
  code?: string;
  message?: string;
  type?: string;
  statusCode?: number;
}

/**
 * Map a Stripe-like error object into a NormalizedError.
 * This does not depend on the Stripe SDK; it works with shape-compatible objects.
 */
export class StripeErrorMapper {
  static map(error: unknown): NormalizedError {
    const base: NormalizedError = {
      code: NormalizedErrorCode.Unknown,
      message: 'Unknown error from Stripe',
      gateway: 'stripe',
    };

    const stripeError = StripeErrorMapper.toStripeLike(error);

    const rawMessage =
      stripeError?.message ?? (error instanceof Error ? error.message : undefined) ?? base.message;

    const statusCode = stripeError?.statusCode;
    const rawCode = stripeError?.code ?? stripeError?.type;

    const code = StripeErrorMapper.mapCode(rawCode, statusCode);

    const isRetriable = StripeErrorMapper.isRetriable(code, statusCode);

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

  private static toStripeLike(error: unknown): StripeLikeError | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const candidate = error as Partial<StripeLikeError>;

    return {
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      type: typeof candidate.type === 'string' ? candidate.type : undefined,
      statusCode: typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined,
    };
  }

  private static mapCode(
    rawCode: string | undefined,
    statusCode: number | undefined,
  ): NormalizedErrorCode {
    if (rawCode) {
      switch (rawCode) {
        case 'card_declined':
        case 'do_not_honor':
        case 'fraudulent':
          return NormalizedErrorCode.CardDeclined;
        case 'insufficient_funds':
          return NormalizedErrorCode.InsufficientFunds;
        case 'incorrect_number':
        case 'invalid_number':
        case 'invalid_expiry_month':
        case 'invalid_expiry_year':
        case 'invalid_cvc':
        case 'invalid_request_error':
          return NormalizedErrorCode.InvalidRequest;
        default:
          // fall through to HTTP-based mapping below
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
    if (code === NormalizedErrorCode.RateLimited) {
      return true;
    }

    if (code === NormalizedErrorCode.NetworkError) {
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
