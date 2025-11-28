import { StripeErrorMapper } from '@src/core/services/error-mapping/stripe-error-mapper';
import { NormalizedErrorCode, type NormalizedError } from '@common/errors/normalized-error.model';

describe('StripeErrorMapper', () => {
  it('maps card_declined to CardDeclined', () => {
    const stripeError = {
      code: 'card_declined',
      message: 'Your card was declined.',
      statusCode: 402,
    };

    const normalized: NormalizedError = StripeErrorMapper.map(stripeError);

    expect(normalized.code).toBe(NormalizedErrorCode.CardDeclined);
    expect(normalized.gateway).toBe('stripe');
    expect(normalized.rawCode).toBe('card_declined');
    expect(normalized.httpStatus).toBe(402);
    expect(normalized.isRetriable).toBe(false);
  });

  it('maps insufficient_funds to InsufficientFunds', () => {
    const stripeError = {
      code: 'insufficient_funds',
      message: 'Not enough funds.',
      statusCode: 402,
    };

    const normalized = StripeErrorMapper.map(stripeError);

    expect(normalized.code).toBe(NormalizedErrorCode.InsufficientFunds);
    expect(normalized.isRetriable).toBe(false);
  });

  it('maps 401 to AuthenticationFailed when no specific code', () => {
    const stripeError = {
      message: 'Invalid API key',
      statusCode: 401,
    };

    const normalized = StripeErrorMapper.map(stripeError);

    expect(normalized.code).toBe(NormalizedErrorCode.AuthenticationFailed);
  });

  it('maps 500+ to InternalError and marks retriable', () => {
    const stripeError = {
      message: 'Stripe is down',
      statusCode: 503,
    };

    const normalized = StripeErrorMapper.map(stripeError);

    expect(normalized.code).toBe(NormalizedErrorCode.InternalError);
    expect(normalized.isRetriable).toBe(true);
  });

  it('falls back to Unknown for non-object errors', () => {
    const normalized = StripeErrorMapper.map('something weird');

    expect(normalized.code).toBe(NormalizedErrorCode.Unknown);
    expect(normalized.gateway).toBe('stripe');
  });
});
