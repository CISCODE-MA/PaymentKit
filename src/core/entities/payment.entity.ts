import { GatewayKey } from '@src/common/types/gateway.types';
import { Money } from '../value-objects/money.value-object';
import { PaymentStatus } from './payment-status.enum';

/**
 * Unified representation of a payment across all gateways.
 */
export interface Payment {
  /**
   * Internal PaymentKit id.
   */
  id: string;

  /**
   * The gateway handling this payment (e.g. 'stripe)
   */
  gateway: GatewayKey;

  /**
   * Provider-specific payment id (e.g. Stripe PaymentIntent id).
   */
  gatewayPaymentId: string;

  /**
   * Total amount for this payment
   */
  amount: Money;

  status: PaymentStatus;

  createdAt: Date;
  updatedAt: Date;

  /**
   * Arbitrary user-defined metadata.
   */
  metadata?: Record<string, unknown>;
}
