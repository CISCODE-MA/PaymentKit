import { DefaultErrorNormalizer } from '@src/core/services/error-normalizer.service';
import { NormalizedErrorCode, type NormalizedError } from '@common/errors/normalized-error.model';

describe('DefaultErrorNormalizer', () => {
  const normalizer = new DefaultErrorNormalizer();

  it('delegates to Stripe mapper', () => {
    const error = {
      code: 'card_declined',
      message: 'Card declined',
      statusCode: 402,
    };

    const normalized: NormalizedError = normalizer.normalize(error, {
      gateway: 'stripe',
    });

    expect(normalized.gateway).toBe('stripe');
    expect(normalized.code).toBe(NormalizedErrorCode.CardDeclined);
  });

  it('delegates to PayPal mapper', () => {
    const error = {
      name: 'VALIDATION_ERROR',
      message: 'Bad request',
      details: [{ issue: 'INVALID_REQUEST', description: 'Bad data' }],
      statusCode: 400,
    };

    const normalized = normalizer.normalize(error, { gateway: 'paypal' });

    expect(normalized.gateway).toBe('paypal');
    expect(normalized.code).toBe(NormalizedErrorCode.InvalidRequest);
  });

  it('returns Unknown for unknown gateway keys', () => {
    const error = new Error('Something broke');

    const normalized = normalizer.normalize(error, {
      gateway: 'stripe',
    });

    expect(normalized.code).not.toBeUndefined();
  });
});
