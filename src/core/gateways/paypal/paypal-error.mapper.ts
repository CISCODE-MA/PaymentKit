import { NormalizedError, NormalizedErrorCode } from '@src/common/errors/normalized-error.model';

interface PaypalErrorDetail {
  issue?: string;
  description?: string;
}

interface PaypalErrorBody {
  name?: string;
  message?: string;
  details?: PaypalErrorDetail[];
}

/**
 * Input for PayPal → PaymentKit error mapping.
 */
export interface PaypalErrorInput {
  status: number;
  body: unknown;
}

/**
 * Map a Paypal HTTP error (status + body) to a PaymentKit NormalizedError.
 */
export function mapPaypalErrorToNormalizedError(input: PaypalErrorInput): NormalizedError {
  const { status } = input;
  const body = (input.body ?? {}) as PaypalErrorBody;

  const primaryCode = body.name ?? body.details?.[0]?.issue;
  const rawMessage = body.message;
  const message = rawMessage ?? 'PayPal request failed';

  const code = classifyPaypalErrorCode(status, primaryCode);

  const isRetriable =
    status >= 500 ||
    code === NormalizedErrorCode.RateLimited ||
    code === NormalizedErrorCode.NetworkError;

  return {
    code,
    message,
    gateway: 'paypal',
    rawCode: primaryCode,
    rawMessage,
    httpStatus: status,
    isRetriable,
  };
}

function classifyPaypalErrorCode(status: number, primaryCode?: string): NormalizedErrorCode {
  const normalizedPrimary = primaryCode?.toUpperCase() ?? '';

  // HTTP-status-driven mapping
  if (status === 400) {
    return NormalizedErrorCode.InvalidRequest;
  }
  if (status === 401) {
    return NormalizedErrorCode.AuthenticationFailed;
  }
  if (status === 403) {
    return NormalizedErrorCode.AuthorizationFailed;
  }
  if (status === 404) {
    return NormalizedErrorCode.InvalidRequest;
  }
  if (status === 429) {
    return NormalizedErrorCode.RateLimited;
  }
  if (status >= 500 && status < 600) {
    return NormalizedErrorCode.InternalError;
  }

  // Name / issue based mapping (best effort)
  if (normalizedPrimary.includes('VALIDATION')) {
    return NormalizedErrorCode.InvalidRequest;
  }
  if (normalizedPrimary.includes('AUTH') || normalizedPrimary.includes('CREDENTIAL')) {
    return NormalizedErrorCode.AuthenticationFailed;
  }
  if (normalizedPrimary.includes('PERMISSION') || normalizedPrimary.includes('NOT_AUTHORIZED')) {
    return NormalizedErrorCode.AuthorizationFailed;
  }
  if (normalizedPrimary.includes('RATE') || normalizedPrimary.includes('THROTTLE')) {
    return NormalizedErrorCode.RateLimited;
  }
  if (normalizedPrimary.includes('INTERNAL') || normalizedPrimary.includes('SERVER')) {
    return NormalizedErrorCode.InternalError;
  }
  return NormalizedErrorCode.Unknown;
}
