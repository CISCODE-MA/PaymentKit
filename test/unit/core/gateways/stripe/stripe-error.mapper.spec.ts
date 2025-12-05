import { mapStripeErrorToNormalizedError } from '@src/core/gateways/stripe/stripe-error.mapper';
import { NormalizedErrorCode } from '@src/common/errors/normalized-error.model';

describe('mapStripeErrorToNormalizedError', () => {
  it('maps 400 invalid_request_error to InvalidRequest', () => {
    const error = mapStripeErrorToNormalizedError({
      status: 400,
      body: {
        type: 'invalid_request_error',
        message: 'Bad param',
        code: 'parameter_missing',
      },
    });

    expect(error.code).toBe(NormalizedErrorCode.InvalidRequest);
    expect(error.httpStatus).toBe(400);
    expect(error.gateway).toBe('stripe');
  });

  it('maps authentication_error / 401 to AuthenticationFailed', () => {
    const error = mapStripeErrorToNormalizedError({
      status: 401,
      body: {
        type: 'authentication_error',
        message: 'No API key provided',
      },
    });

    expect(error.code).toBe(NormalizedErrorCode.AuthenticationFailed);
  });

  it('maps permission_error / 403 to AuthorizationFailed', () => {
    const error = mapStripeErrorToNormalizedError({
      status: 403,
      body: {
        type: 'permission_error',
        message: 'Forbidden',
      },
    });

    expect(error.code).toBe(NormalizedErrorCode.AuthorizationFailed);
  });

  it('maps card_error with insufficient_funds to InsufficientFunds', () => {
    const error = mapStripeErrorToNormalizedError({
      status: 402,
      body: {
        type: 'card_error',
        decline_code: 'insufficient_funds',
        message: 'Not enough money',
      },
    });

    expect(error.code).toBe(NormalizedErrorCode.InsufficientFunds);
  });

  it('maps generic card_error to CardDeclined', () => {
    const error = mapStripeErrorToNormalizedError({
      status: 402,
      body: {
        type: 'card_error',
        decline_code: 'do_not_honor',
        message: 'Card declined',
      },
    });

    expect(error.code).toBe(NormalizedErrorCode.CardDeclined);
  });

  it('maps 429 to RateLimited and marks as retriable', () => {
    const error = mapStripeErrorToNormalizedError({
      status: 429,
      body: {
        message: 'Too many requests',
      },
    });

    expect(error.code).toBe(NormalizedErrorCode.RateLimited);
    expect(error.isRetriable).toBe(true);
  });

  it('maps 5xx to NetworkError and marks as retriable', () => {
    const error = mapStripeErrorToNormalizedError({
      status: 503,
      body: {
        type: 'api_error',
        message: 'Service unavailable',
      },
    });

    expect(error.code).toBe(NormalizedErrorCode.NetworkError);
    expect(error.isRetriable).toBe(true);
  });

  it('falls back to Unknown when no better mapping', () => {
    const error = mapStripeErrorToNormalizedError({
      status: 418,
      body: {
        message: "I'm a teapot",
      },
    });

    expect(error.code).toBe(NormalizedErrorCode.Unknown);
  });
});
