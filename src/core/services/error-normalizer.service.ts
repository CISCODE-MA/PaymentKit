import type { NormalizedError } from '@src/common/errors/normalized-error.model';
import { NormalizedErrorCode } from '@src/common/errors/normalized-error.model';
import type { GatewayKey } from '@src/common/types/gateway.types';

import { PaypalErrorMapper } from './error-mapping/paypal-error-mapper';
import { StripeErrorMapper } from './error-mapping/stripe-error-mapper';

export interface ErrorNormalizer {
  normalize(error: unknown, contexxt: { gateway: GatewayKey }): NormalizedError;
}

/**
 * Default implementation that delegates mapping to per-gateway mappers.
 */
export class DefaultErrorNormalizer implements ErrorNormalizer {
  normalize(error: unknown, context: { gateway: GatewayKey }): NormalizedError {
    switch (context.gateway) {
      case 'stripe':
        return StripeErrorMapper.map(error);
      case 'paypal':
        return PaypalErrorMapper.map(error);
      default:
        return {
          code: NormalizedErrorCode.Unknown,
          message: 'Unknown error from payment gateway',
          gateway: context.gateway,
          rawMessage: error instanceof Error ? error.message : String(error),
        };
    }
  }
}
