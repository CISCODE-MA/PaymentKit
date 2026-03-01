// test/unit/core/services/paypal-error-mapper.spec.ts

import { NormalizedErrorCode, type NormalizedError } from '@common/errors/normalized-error.model';
import { PaypalErrorMapper } from '@src/core/services/error-mapping/paypal-error-mapper';

describe('PaypalErrorMapper', () => {
  it('maps VALIDATION_ERROR to InvalidRequest', () => {
    const paypalError = {
      name: 'VALIDATION_ERROR',
      message: 'Request is not valid',
      details: [{ issue: 'INVALID_REQUEST', description: 'Bad data' }],
      statusCode: 400,
    };

    const normalized: NormalizedError = PaypalErrorMapper.map(paypalError);

    expect(normalized.gateway).toBe('paypal');
    expect(normalized.code).toBe(NormalizedErrorCode.InvalidRequest);
    expect(normalized.rawCode).toBe('VALIDATION_ERROR');
    expect(normalized.httpStatus).toBe(400);
  });

  it('maps UNAUTHORIZED to AuthenticationFailed', () => {
    const paypalError = {
      name: 'UNAUTHORIZED',
      message: 'Invalid credentials',
      statusCode: 401,
    };

    const normalized = PaypalErrorMapper.map(paypalError);

    expect(normalized.code).toBe(NormalizedErrorCode.AuthenticationFailed);
  });

  it('maps 500+ to InternalError and marks retriable', () => {
    const paypalError = {
      name: 'INTERNAL_SERVER_ERROR',
      message: 'PayPal is down',
      statusCode: 503,
    };

    const normalized = PaypalErrorMapper.map(paypalError);

    expect(normalized.code).toBe(NormalizedErrorCode.InternalError);
    expect(normalized.isRetriable).toBe(true);
  });

  it('falls back to Unknown for non-object errors', () => {
    const normalized = PaypalErrorMapper.map('weird');

    expect(normalized.code).toBe(NormalizedErrorCode.Unknown);
    expect(normalized.gateway).toBe('paypal');
  });
});
