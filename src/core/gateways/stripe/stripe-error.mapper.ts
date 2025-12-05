import { NormalizedError, NormalizedErrorCode } from '@src/common/errors/normalized-error.model';
import { GatewayKey } from '@src/common/types/gateway.types';

const STRIPE_GATEWAY_KEY: GatewayKey = 'stripe';

export interface StripeErrorLike {
  type?: string; // e.g. 'card_error', 'invalid_request_error'
  code?: string; // e.g. 'invalid_expiry_year'
  decline_code?: string; // e.g. 'insufficient_funds'
  message?: string;
  statusCode?: number;
  [key: string]: unknown;
}

export interface StripeErrorContext {
  /**
   * HTTP status code from the Stripe API response.
   */
  status: number;
  /**
   * Parsed Stripe error payload if available.
   */
  body: unknown;
}

/**
 * Map a Stripe error HTTP response into a NormalizedError.
 * This keeps Stripe-specific logic out of the core engine.
 */
export function mapStripeErrorToNormalizedError(context: StripeErrorContext): NormalizedError {
  const { status, body } = context;

  const stripeError: StripeErrorLike =
    body && typeof body === 'object' ? (body as StripeErrorLike) : {};

  const type = (stripeError.type ?? '').toLowerCase();
  const code = stripeError.code ?? stripeError.decline_code;
  const message =
    stripeError.message ?? (typeof body === 'string' ? body : 'Stripe request failed');

  const base: NormalizedError = {
    code: NormalizedErrorCode.Unknown,
    message,
    gateway: STRIPE_GATEWAY_KEY,
    rawCode: code,
    rawMessage: message,
    httpStatus: status || stripeError.statusCode,
    isRetriable: false,
  };

  // 1) HTTP-status based mapping
  if (status === 400) {
    return { ...base, code: NormalizedErrorCode.InvalidRequest };
  }

  if (status === 401) {
    return { ...base, code: NormalizedErrorCode.AuthenticationFailed };
  }

  if (status === 403) {
    return { ...base, code: NormalizedErrorCode.AuthorizationFailed };
  }

  if (status === 404) {
    return { ...base, code: NormalizedErrorCode.InvalidRequest };
  }

  if (status === 429) {
    return { ...base, code: NormalizedErrorCode.RateLimited, isRetriable: true };
  }

  if (status >= 500 && status <= 599) {
    return {
      ...base,
      code: NormalizedErrorCode.NetworkError,
      isRetriable: true,
    };
  }

  // 2) Stripe "type" based mapping
  if (type === 'invalid_request_error') {
    return { ...base, code: NormalizedErrorCode.InvalidRequest };
  }

  if (type === 'authentication_error') {
    return { ...base, code: NormalizedErrorCode.AuthenticationFailed };
  }

  if (type === 'permission_error') {
    return { ...base, code: NormalizedErrorCode.AuthorizationFailed };
  }

  if (type === 'api_error') {
    return { ...base, code: NormalizedErrorCode.InternalError, isRetriable: true };
  }

  if (type === 'card_error') {
    const decline = (stripeError.decline_code ?? '').toLowerCase();

    if (decline === 'insufficient_funds') {
      return { ...base, code: NormalizedErrorCode.InsufficientFunds };
    }

    // other decline codes → generic card declined
    return { ...base, code: NormalizedErrorCode.CardDeclined };
  }

  // 3) Fallback based mostly on status
  if (!status) {
    return {
      ...base,
      code: NormalizedErrorCode.NetworkError,
      isRetriable: true,
    };
  }

  return base;
}
