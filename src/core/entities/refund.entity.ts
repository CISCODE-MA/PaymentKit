import type { Money } from '@core/value-objects/money.value-object';
import type { GatewayKey } from '@common/types/gateway.types';
import { PaymentStatus } from './payment-status.enum';

/**
 * Unified representation of a refund across all gateways.
 */
export interface Refund {
  /**
   * Internal PaymentKit refund id.
   */
  id: string;

  /**
   * Associated PaymentKit payment id.
   */
  paymentId: string;

  gateway: GatewayKey;

  /**
   * Provider-specific refund id.
   */
  gatewayRefundId: string;

  amount: Money;

  /**
   * We reuse PaymentStatus here (typically Refunded / PartiallyRefunded / Failed).
   */
  status: PaymentStatus;

  createdAt: Date;
  updatedAt: Date;

  metadata?: Record<string, unknown>;
}
