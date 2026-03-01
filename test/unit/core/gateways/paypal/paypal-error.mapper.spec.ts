import { NormalizedErrorCode } from '@src/common/errors/normalized-error.model';
import { mapPaypalErrorToNormalizedError } from '@src/core/gateways/paypal/paypal-error.mapper';

describe('mapPaypalErrorToNormalizedError', () => {
  it('maps validation error (400) to InvalidRequest', () => {
    const err = mapPaypalErrorToNormalizedError({
      status: 400,
      body: {
        name: 'VALIDATION_ERROR',
        message: 'Request is not well-formed',
        details: [
          {
            issue: 'INVALID_REQUEST',
            description: 'Field X is required',
          },
        ],
      },
    });

    expect(err.code).toBe(NormalizedErrorCode.InvalidRequest);
    expect(err.gateway).toBe('paypal');
    expect(err.rawCode).toBe('VALIDATION_ERROR');
    expect(err.httpStatus).toBe(400);
    expect(err.isRetriable).toBe(false);
  });

  it('maps 401 to AuthenticationFailed', () => {
    const err = mapPaypalErrorToNormalizedError({
      status: 401,
      body: {
        name: 'AUTHENTICATION_FAILURE',
        message: 'Invalid credentials',
      },
    });

    expect(err.code).toBe(NormalizedErrorCode.AuthenticationFailed);
    expect(err.isRetriable).toBe(false);
  });

  it('maps 403 to AuthorizationFailed', () => {
    const err = mapPaypalErrorToNormalizedError({
      status: 403,
      body: {
        name: 'NOT_AUTHORIZED',
        message: 'User is not allowed to perform this action',
      },
    });

    expect(err.code).toBe(NormalizedErrorCode.AuthorizationFailed);
  });

  it('maps 429 to RateLimited and marks as retriable', () => {
    const err = mapPaypalErrorToNormalizedError({
      status: 429,
      body: {
        name: 'RATE_LIMIT_REACHED',
        message: 'Too many requests',
      },
    });

    expect(err.code).toBe(NormalizedErrorCode.RateLimited);
    expect(err.isRetriable).toBe(true);
  });

  it('maps 500+ to InternalError and marks as retriable', () => {
    const err = mapPaypalErrorToNormalizedError({
      status: 503,
      body: {
        name: 'INTERNAL_SERVER_ERROR',
        message: 'PayPal service is temporarily unavailable',
      },
    });

    expect(err.code).toBe(NormalizedErrorCode.InternalError);
    expect(err.isRetriable).toBe(true);
  });

  it('falls back to Unknown when status and name are not recognized', () => {
    const err = mapPaypalErrorToNormalizedError({
      status: 418,
      body: {
        name: 'TEAPOT',
        message: "I'm a teapot",
      },
    });

    expect(err.code).toBe(NormalizedErrorCode.Unknown);
    expect(err.isRetriable).toBe(false);
  });

  it('uses a default message when none is provided', () => {
    const err = mapPaypalErrorToNormalizedError({
      status: 400,
      body: {
        name: 'VALIDATION_ERROR',
      },
    });

    expect(err.message).toMatch(/PayPal request failed/i);
  });
});
