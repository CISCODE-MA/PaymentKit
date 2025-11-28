// test/unit/core/services/adyen-error-mapper.spec.ts

import { AdyenErrorMapper } from '@src/core/services/error-mapping/adyen-error-mapper';
import { NormalizedErrorCode, type NormalizedError } from '@common/errors/normalized-error.model';

describe('AdyenErrorMapper', () => {
  it('maps 14_003 to CardDeclined', () => {
    const adyenError = {
      errorCode: '14_003',
      message: 'Refused',
      status: 402,
    };

    const normalized: NormalizedError = AdyenErrorMapper.map(adyenError);

    expect(normalized.gateway).toBe('adyen');
    expect(normalized.code).toBe(NormalizedErrorCode.CardDeclined);
    expect(normalized.rawCode).toBe('14_003');
    expect(normalized.httpStatus).toBe(402);
  });

  it('maps 14_009 to InsufficientFunds', () => {
    const adyenError = {
      errorCode: '14_009',
      message: 'Insufficient funds',
      status: 402,
    };

    const normalized = AdyenErrorMapper.map(adyenError);

    expect(normalized.code).toBe(NormalizedErrorCode.InsufficientFunds);
  });

  it('maps 500+ to InternalError and marks retriable', () => {
    const adyenError = {
      errorCode: '901',
      message: 'Adyen internal error',
      status: 500,
    };

    const normalized = AdyenErrorMapper.map(adyenError);

    expect(normalized.code).toBe(NormalizedErrorCode.InternalError);
    expect(normalized.isRetriable).toBe(true);
  });

  it('falls back to Unknown for non-object errors', () => {
    const normalized = AdyenErrorMapper.map(42);

    expect(normalized.code).toBe(NormalizedErrorCode.Unknown);
    expect(normalized.gateway).toBe('adyen');
  });
});
