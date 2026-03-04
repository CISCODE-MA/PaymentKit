import type { GatewayKey } from '../types/gateway.types';

/**
 * High-level normalized error codes exposed by PaymentKit.
 */
export enum NormalizedErrorCode {
  InvalidRequest = 'invalid_request',
  AuthenticationFailed = 'authentication_failed',
  AuthorizationFailed = 'authorization_failed',
  CardDeclined = 'card_declined',
  InsufficientFunds = 'insufficient_funds',
  RateLimited = 'rate_limited',
  NetworkError = 'network_error',
  InternalError = 'internal_error',
  Unknown = 'unknown',
}

/**
 * Unified error shape returned by the engine and gateways.
 */
export interface NormalizedError {
  code: NormalizedErrorCode;

  /**
   * Human-readable message sage for logs and, optionally, UI.
   */
  message: string;

  /**
   * Gateway that produced the error, in known.
   */
  gateway?: GatewayKey;

  /**
   * Raw provider error code (e.g. Stripe decline code).
   */
  rawCode?: string | number;

  /**
   * Raw provider error message
   */
  rawMessage?: string;

  /**
   * HTTP status code if applicable.
   */
  httpStatus?: number;

  /**
   * Whether this error is considered safe to retry.
   */
  isRetriable?: boolean;
}
