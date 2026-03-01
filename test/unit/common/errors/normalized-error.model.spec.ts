import { NormalizedErrorCode, type NormalizedError } from '@common/errors/normalized-error.model';
import type { GatewayKey } from '@common/types/gateway.types';

describe('NormalizedError model', () => {
  it('represents a normalized error shape', () => {
    const gateway: GatewayKey = 'paypal';

    const error: NormalizedError = {
      code: NormalizedErrorCode.CardDeclined,
      message: 'Card was declined',
      gateway,
      rawCode: 'card_declined',
      rawMessage: 'Your card was declined.',
      httpStatus: 402,
      isRetriable: false,
    };

    expect(error.code).toBe(NormalizedErrorCode.CardDeclined);
    expect(error.gateway).toBe('paypal');
    expect(error.rawCode).toBe('card_declined');
    expect(error.httpStatus).toBe(402);
    expect(error.isRetriable).toBe(false);
  });

  it('supports unknown errors', () => {
    const error: NormalizedError = {
      code: NormalizedErrorCode.Unknown,
      message: 'Unknown error from gateway',
    };

    expect(error.code).toBe(NormalizedErrorCode.Unknown);
    expect(error.gateway).toBeUndefined();
  });
});
